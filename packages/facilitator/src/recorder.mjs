// Off-chain refusal records (planning/SPEC/INTEGRATION_AND_MIRROR.md §2–§3). The facilitator posts
// each refusal of a proven payer to the recorder route; the route writes it to Arkiv as one
// readonly `fail` edge owned by W_SYNC (T3's recordEdge), with a unique ref. The mirror folds
// it into the tallies. A refusal is attributed to an agent's name only when the paying wallet is
// bound to that node; otherwise it is written from the wallet's own reverse name.

import { z } from 'zod';
import { keccak256, namehash, toHex } from 'viem';
import { bearerOk, errorNames, json, readJson } from './http.mjs';
import { RateLimiter } from './limits.mjs';

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const ZERO32 = `0x${'0'.repeat(64)}`;

export const attemptSchema = z
  .object({
    onchain: z.literal(false),
    status: z.literal('rejected'),
    reason: z.string().regex(/^[A-Za-z0-9_]{1,40}$/),
    orderId: hex32,
    payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    payerName: z.string().max(255),
    payerNode: hex32,
    payerEpoch: z.number().int().min(0).max(0xffffffff).optional(),
    shopName: z.string().min(1).max(255),
    amountMicro: z.string().regex(/^[0-9]{1,20}$/),
    at: z.number().int().positive(),
    test: z.boolean().optional(),
  })
  .strict()
  // Attributed means the name hashes to the node (the facilitator checked the wallet's binding;
  // the mirror checks it again); unattributed means both are empty.
  .refine((e) => (e.payerNode === ZERO32 ? e.payerName === '' && e.payerEpoch === undefined : safeNamehash(e.payerName) === e.payerNode.toLowerCase()), 'attribution');

function safeNamehash(name) {
  try {
    return namehash(name);
  } catch {
    return null;
  }
}

// The facilitator's side: fire and forget, with a timeout; an outage never blocks a decision.
export function recorderClient({ url, token, fetchImpl = fetch, timeoutMs = 5_000 }) {
  return {
    async refused(entry) {
      if (!url || !token) return;
      await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      }).catch(() => {});
    },
  };
}

// The edge T3's recordEdge writes. ref = att:<orderId>:<payer wallet>:<8 hex of keccak(reason)>
// (122 bytes: Arkiv refuses a str over 128, and the reason itself is in the payload), so the signing
// wallet is always on the record (Join's mirror reads it from the ref and the payload) and a
// replayed refusal is the same edge, which readers and the reconcile job de-duplicate by ref.
export function attemptEdge(entry) {
  const payer = entry.payer.toLowerCase();
  const attributed = entry.payerNode !== ZERO32 && entry.payerName !== '';
  return {
    ref: `att:${entry.orderId.toLowerCase()}:${payer}:${keccak256(toHex(entry.reason)).slice(2, 10)}`,
    kind: 'fail',
    from: attributed ? { ens: entry.payerName, epoch: entry.payerEpoch ?? 0 } : { ens: `${payer.slice(2)}.addr.reverse`, epoch: 0 },
    to: { ens: entry.shopName, epoch: 0 },
    amountMicro: BigInt(entry.amountMicro),
    ts: Math.floor(entry.at / 1000),
    orderId: entry.orderId,
    payload: toHex(JSON.stringify({ onchain: false, status: entry.status, reason: entry.reason, payer, ...(entry.test ? { test: true } : {}) })),
  };
}

// The route: POST …/attempts with the bearer RECORDER_TOKEN. write(edge) is recordEdge over a
// W_SYNC connection, or null until the writer is configured (the route then answers 503 and the
// facilitator carries on).
export function recorderHandler({ token, write, log = console.error, clock = () => Date.now() }) {
  const bucket = new RateLimiter(120, 60_000, clock);
  return async function handle(request) {
    try {
      if (request.method !== 'POST' || !new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/attempts')) {
        return json(404, { error: 'not found' });
      }
      if (!bearerOk(request, token)) return json(401, { error: 'unauthorized' });
      if (!write) return json(503, { error: 'recorder not configured' });
      if (!bucket.take('all')) return json(429, { error: 'rate limited' });
      const body = await readJson(request, 8 * 1024);
      if (body.error) return json(body.error, { error: 'bad request' });
      const parsed = attemptSchema.safeParse(body.value);
      if (!parsed.success) return json(400, { error: 'bad request' });
      const written = await write(attemptEdge(parsed.data));
      return json(201, { entityKey: written.entityKey, txHash: written.txHash, recovered: written.recovered });
    } catch (e) {
      log(`recorder: ${errorNames(e)}`);
      return json(500, { error: 'internal error' });
    }
  };
}
