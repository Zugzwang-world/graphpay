// Friday activity (planning/EVENT_ADDENDUM.md 6–8; ADR-0033, ADR-0035; MASTER_PLAN §4
// item 1), all written by W_DIRECTORY and gone by themselves when not renewed:
//   shop_open       a shop's Open toggle: open_until, patched and extended while on (15 min)
//   agent_presence  an agent at work: readonly, extended while it runs (15 min)
//   handoff         one agent passing work to another in a run: readonly (30 min)
// A renewal reads $expiresAt first and never pushes expiry past now + the lifetime (an
// extension sets max(current, now + lifetime)). Vercel instances share W_DIRECTORY's
// nonces, so a transaction found by nonce is adopted only if it carries this write.

import { ExpirationTime, key as keyValue, str } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { checkedOwner, findOne, readAll } from '@graphpay/arkiv-graph';
import { normalizedName } from './identity.mjs';
import { ENTITIES, LIFETIME, writerAddresses } from './model.mjs';

const directory = () => writerAddresses().W_DIRECTORY;
const attrs = (e) => e?.$attributes ?? e?.attributes;
const lower = (v) => String(v ?? '').toLowerCase();

function needWriter(arkiv, what) {
  if (!arkiv?.writer) throw new Error(`money-graph: ${what} needs a W_DIRECTORY connection with a writer`);
}

// Extends `key` to now + `minutes` unless it already reaches that far; returns false if
// the row is gone (lapsed), so the caller creates a new one.
async function renew(arkiv, def, key, minutes, patch = null) {
  const e = await arkiv.publicClient.getEntity(key).catch(() => null);
  if (!e) return false;
  const expiration = ExpirationTime.fromMinutes(minutes);
  const head = await arkiv.publicClient.getBlockNumber({ cacheTime: 0 }); // viem caches the head for seconds
  const extend = BigInt(e.$expiresAt ?? 0n) < head + expiration.minLifetime;
  if (!extend && !patch) return true;
  const ours = async () => {
    const now = await arkiv.publicClient.getEntity(key).catch(() => null);
    if (!now) return false;
    if (patch) return Object.entries(patch).every(([k, v]) => String(attrs(now)?.[k]?.value) === String(v));
    return BigInt(now.$expiresAt ?? 0n) >= head + expiration.minLifetime;
  };
  await arkiv.writer.send(
    { patches: patch ? [{ def, key, values: patch }] : [], extensions: extend ? [{ key, expiration }] : [] },
    { verifyRecovered: ours },
  );
  return true;
}

async function create(arkiv, def, values, minutes, ours) {
  const { createdKeys, txs } = await arkiv.writer.send(
    { creates: [{ def, values, expiration: ExpirationTime.fromMinutes(minutes) }] },
    { verifyRecovered: async ([k]) => ours(attrs(await arkiv.publicClient.getEntity(k).catch(() => null))) },
  );
  return { key: createdKeys[0], txHash: txs[0].hash };
}

// ---- shop_open ---------------------------------------------------------------------

// The Open toggle, on: creates the row or patches open_until and extends it. `key` is the
// row from the last call (or found by shop_key). Returns { key, created }.
export async function openShop(arkiv, { shopKey, shopEns, now = Math.floor(Date.now() / 1000), key = null }) {
  needWriter(arkiv, 'openShop');
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(shopKey))) throw new Error('money-graph: a shop key is 32-byte hex');
  const openUntil = BigInt(now + LIFETIME.openMinutes * 60);
  const k = key ?? (await findOne(arkiv.publicClient, ENTITIES.shop_open, { owner: arkiv.owner, where: [eq('shop_key', keyValue(lower(shopKey)))] }).catch(() => null))?.$key ?? null;
  if (k && (await renew(arkiv, ENTITIES.shop_open, k, LIFETIME.openMinutes, { open_until: openUntil }))) return { key: k, created: false };
  const values = { shop_key: shopKey, shop_ens: normalizedName(shopEns), open_until: openUntil };
  const res = await create(arkiv, ENTITIES.shop_open, values, LIFETIME.openMinutes, (a) => lower(a?.shop_key?.value) === lower(shopKey) && String(a?.open_until?.value) === String(openUntil));
  return { key: res.key, created: true };
}

// The Open toggle, off: open_until now. The row lapses by itself within 15 minutes; "open
// now" reads open_until, so the shop drops out at once.
export async function closeShop(arkiv, { key, now = Math.floor(Date.now() / 1000) }) {
  needWriter(arkiv, 'closeShop');
  const e = await arkiv.publicClient.getEntity(key).catch(() => null);
  if (!e) return { closed: true, gone: true };
  const values = { open_until: BigInt(now) };
  await arkiv.writer.send({ patches: [{ def: ENTITIES.shop_open, key, values }] }, { verifyRecovered: async () => String(attrs(await arkiv.publicClient.getEntity(key))?.open_until?.value) === String(values.open_until) });
  return { closed: true, gone: false };
}

// shop keys open now: a live row from W_DIRECTORY whose open_until is still ahead.
export async function openShopKeys(publicClient, { owner = directory(), now = Math.floor(Date.now() / 1000) } = {}) {
  const rows = await readAll(publicClient, ENTITIES.shop_open, { owner: checkedOwner(owner), cap: 500, truncate: true });
  return new Set(rows.filter((r) => Number(r.open_until) > now).map((r) => lower(r.shop_key)));
}

// ---- agent_presence ----------------------------------------------------------------

// An agent starts (no key) or renews (its key). A lapsed row is created again.
export async function markPresence(arkiv, { agentEns, ownerEns, role, session, key = null }) {
  needWriter(arkiv, 'markPresence');
  if (key && (await renew(arkiv, ENTITIES.agent_presence, key, LIFETIME.presenceMinutes))) return { key, created: false };
  const values = { agent_ens: normalizedName(agentEns), owner_ens: normalizedName(ownerEns), role: String(role), session: String(session) };
  const res = await create(arkiv, ENTITIES.agent_presence, values, LIFETIME.presenceMinutes, (a) => a?.agent_ens?.value === values.agent_ens && a?.session?.value === values.session);
  return { key: res.key, created: true };
}

// Agents online (live presence rows), optionally for one owner or one run.
export async function agentsOnline(publicClient, { owner = directory(), ownerEns = null, session = null } = {}) {
  const where = [];
  if (ownerEns) where.push(eq('owner_ens', str(normalizedName(ownerEns))));
  if (session) where.push(eq('session', str(String(session))));
  const rows = await readAll(publicClient, ENTITIES.agent_presence, { owner: checkedOwner(owner), where, cap: 500, truncate: true });
  return rows.map((r) => ({ key: r.$key, agentEns: r.agent_ens, ownerEns: r.owner_ens, role: r.role, session: r.session, expiresAt: r.$expiresAt }));
}

// ---- handoff -----------------------------------------------------------------------

export async function recordHandoff(arkiv, { requestId, fromAgent, toAgent, step }) {
  needWriter(arkiv, 'recordHandoff');
  const values = { request_id: String(requestId), from_agent: normalizedName(fromAgent), to_agent: normalizedName(toAgent), step: String(step) };
  return create(arkiv, ENTITIES.handoff, values, LIFETIME.handoffMinutes, (a) => ['request_id', 'from_agent', 'to_agent', 'step'].every((c) => a?.[c]?.value === values[c]));
}

// The handoffs of one run, oldest first.
export async function handoffsFor(publicClient, requestId, { owner = directory() } = {}) {
  const rows = await readAll(publicClient, ENTITIES.handoff, { owner: checkedOwner(owner), where: [eq('request_id', str(String(requestId)))], cap: 500, truncate: true });
  return rows
    .map((r) => ({ key: r.$key, requestId: r.request_id, fromAgent: r.from_agent, toAgent: r.to_agent, step: r.step, createdAt: r.$createdAt ?? null }))
    .sort((a, b) => (BigInt(a.createdAt ?? 0) < BigInt(b.createdAt ?? 0) ? -1 : 1));
}

// ---- the agents' hooks (packages/agents createActivity) ----------------------------

// `hooks` for runErrand: presence('start' | 'renew', info) and handoff(from, to, step,
// { requestId }). One presence row per agent and run; the agents package catches errors.
export function activityHooks(arkiv) {
  const keys = new Map();
  return {
    async presence(_phase, { agentEns, ownerEns, role, session }) {
      const id = `${agentEns}|${session}`;
      const { key } = await markPresence(arkiv, { agentEns, ownerEns, role, session, key: keys.get(id) ?? null });
      keys.set(id, key);
    },
    async handoff(from, to, step, { requestId }) {
      await recordHandoff(arkiv, { requestId, fromAgent: from, toAgent: to, step });
    },
  };
}
