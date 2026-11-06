// The ENS watcher (planning/SPEC/IDENTITY_ENS.md §8, docs/plan/amendments/M5-ens.md §3): a
// library the single workers process hosts (never Vercel cron). It reads registry and resolver
// events of the tracked names with one shared checkpoint and keeps the Whitechain AgentPolicy
// and the Arkiv node standing in step with ENS state.
//
// What it never does: create a policy, copy an ENS address into one, or let an ENS cap raise one.
// Policies (wallet and cap) come from the payments setup's configured list, through the sink. The
// owner's ENS cap reaches a live policy only as min(owner's cap, configured cap), through the sink
// (the Coordinator's decision, Fri 6 Nov): a stolen owner key can lower a pass, never lift one.
// A time lapse emits no event, so a ticker compares chain time with the stored expiry. A mark
// (revoked, expired) is set only after the
// sink call succeeded, and a failed batch leaves the checkpoint where it was, so the next poll
// repeats it (every handler is idempotent).
//
// Sink interface (every call may be repeated safely):
//   updatePolicy({ node, epoch, revoked?, expiry? })   no wallet, no cap: the sink adds them
//                                                      from its configured list; a no-op without a policy
//   updatePolicy({ node, epoch, ownerCapMicro })       the owner's ENS cap; the sink writes at most the configured cap
//   patchNode(node, { status?, expiry?, epoch?, ensCapMicro? })
// onRevoked({ name, node, epoch, why }) runs after a revocation was applied (the host provisions
// a fresh spare after a disposable agent's kill); it is never awaited and its failure is only logged.

import { getAddress, isAddressEqual, zeroAddress } from 'viem';
import { permissionedRegistryAbi, permissionedResolverAbi } from './abi.generated.mjs';
import { locate } from './actions.mjs';
import { namehash, canonicalId, epochOf, labelId, STATUS } from './names.mjs';
import { readText, registryState } from './reads.mjs';
import { KEYS, WHITECHAIN_COIN_TYPE } from './records.mjs';

const eventsOf = (abi, names) => abi.filter((x) => x.type === 'event' && names.includes(x.name));
export const REGISTRY_EVENTS = eventsOf(permissionedRegistryAbi, ['LabelRegistered', 'LabelUnregistered', 'ExpiryUpdated', 'TokenResource']);
export const RESOLVER_EVENTS = eventsOf(permissionedResolverAbi, ['TextUpdated', 'AddressUpdated']);

const LOG_RANGE = 1000n;
// Each poll re-reads the last blocks too: the public RPC is load balanced and a log query can lag the head
// that getBlockNumber reported. Every handler re-reads chain state, so a replayed event changes nothing.
const REPLAY_BLOCKS = 6n;
const RETRY_UNTRACKED_EVERY = 10; // polls
const ADDRESSES_PER_QUERY = 8; // the public Sepolia RPC refuses 19 addresses in one getLogs and accepts 10 (measured)
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));
const sortLogs = (logs) => [...logs].sort((a, b) => Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex);
const sameAddress = (a, b) => isAddressEqual(a, b);

// names: the tracked names (agents and owners). epochs: the hand-off's epochs, used only for a
// name that is not REGISTERED when the watcher starts. checkpoint: { get(), set(bigint) } shared
// by the backfill and the live watching (default: in memory).
export function createEnsWatcher({
  client,
  names,
  sink,
  reader,
  gate,
  epochs = {},
  checkpoint = memoryCheckpoint(),
  now = async () => (await client.getBlock({ blockTag: 'latest' })).timestamp,
  log = () => {},
  onRevoked = () => {},
}) {
  const tracked = new Map(); // name → { name, node, label, registry, resolver, epoch, expiry, revoked, expired, textStatus }
  const untracked = new Set();
  let polls = 0;
  let queue = Promise.resolve();
  const serial = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  const byToken = (registry, tokenId) => {
    const id = canonicalId(tokenId);
    return [...tracked.values()].find((t) => sameAddress(t.registry, registry) && canonicalId(labelId(t.label)) === id);
  };
  const byLabel = (registry, label) => [...tracked.values()].find((t) => sameAddress(t.registry, registry) && t.label === label);
  const byResolver = (resolver) => [...tracked.values()].find((t) => !isAddressEqual(t.resolver, zeroAddress) && sameAddress(t.resolver, resolver));

  async function resolveTracked() {
    for (const name of names) {
      try {
        const at = await locate(client, name);
        const prev = tracked.get(at.name);
        const t = prev ?? { name: at.name, node: namehash(at.name), revoked: false, expired: false, textStatus: undefined };
        t.label = at.label;
        t.registry = at.registry;
        if (at.state.status === STATUS.REGISTERED) {
          t.resolver = at.resolver;
          t.epoch = at.state.epoch;
          t.expiry = at.state.expiry;
        } else {
          t.resolver = t.resolver ?? zeroAddress;
          t.epoch = t.epoch ?? epochs[at.name];
          t.expiry = t.expiry ?? at.state.expiry;
        }
        t.state = at.state;
        tracked.set(at.name, t);
        untracked.delete(at.name);
      } catch (e) {
        untracked.add(name);
        log(`watcher: ${name} is not tracked yet (${e.message})`);
      }
    }
  }

  const patch = (t, fields) => sink.patchNode(t.node, fields);

  async function revoke(t, why) {
    if (t.epoch === undefined) return log(`watcher: ${t.name} ${why}, but its epoch is unknown: policy left as it is`);
    await sink.updatePolicy({ node: t.node, epoch: t.epoch, revoked: true });
    await patch(t, { status: 'revoked' });
    t.revoked = true; // marks only after the sinks succeeded
    gate?.invalidate(t.name);
    log(`watcher: ${t.name} ${why}: policy revoked at epoch ${t.epoch}, node revoked`);
    Promise.resolve()
      .then(() => onRevoked({ name: t.name, node: t.node, epoch: t.epoch, why }))
      .catch((e) => log(`watcher: after ${t.name} was revoked: ${e?.message ?? e}`));
  }

  async function onUnregistered(t) {
    // A stale event (replayed, or followed by a re-registration) must not revoke a live label.
    const st = await registryState(client, t.registry, t.label);
    if (st.status === STATUS.REGISTERED) return log(`watcher: ${t.name} unregister event is stale (REGISTERED at epoch ${st.epoch}): ignored`);
    if (t.revoked) return; // already applied (the poll window overlaps the last one)
    await revoke(t, 'unregistered');
  }

  async function onExpiry(t, ev) {
    // Re-read the registry: renew() on an unregistered label also emits ExpiryUpdated and leaves it
    // RESERVED, so un-revoking on the event alone would re-activate a killed agent (§8).
    const st = await registryState(client, t.registry, t.label);
    if (st.status !== STATUS.REGISTERED || (t.epoch !== undefined && st.epoch !== t.epoch)) {
      log(`watcher: ${t.name} renewed but is not REGISTERED at its stored epoch: ignored`);
      return;
    }
    const expiry = st.expiry; // from the re-read, not the event
    if (t.revoked) {
      await sink.updatePolicy({ node: t.node, epoch: t.epoch ?? st.epoch, revoked: false, expiry });
      await patch(t, { status: t.textStatus === 'paused' ? 'paused' : 'active', expiry });
      t.revoked = false;
      t.expired = false;
      log(`watcher: ${t.name} is live again at epoch ${st.epoch}`);
    } else if (t.expired) {
      // A lapse never touched the policy: only the expiry moves, nothing is un-revoked.
      await sink.updatePolicy({ node: t.node, epoch: t.epoch ?? st.epoch, expiry });
      await patch(t, { status: t.textStatus === 'paused' ? 'paused' : 'active', expiry });
      t.expired = false;
      log(`watcher: ${t.name} renewed after a lapse (epoch ${st.epoch})`);
    } else {
      await sink.updatePolicy({ node: t.node, epoch: t.epoch ?? st.epoch, expiry });
      await patch(t, { expiry });
    }
    t.expiry = expiry;
    t.epoch = st.epoch;
    gate?.invalidate(t.name);
  }

  async function onRegistered(t, ev, resources) {
    // Only a label that is REGISTERED now, at the epoch the event announced, moves the policy: a
    // replayed registration of a label that was unregistered since must not lift its revocation.
    const st = await registryState(client, t.registry, t.label);
    const fromTx = resources.get(`${ev.transactionHash}:${canonicalId(ev.args.tokenId)}`);
    const epoch = fromTx !== undefined ? epochOf(fromTx) : st.epoch;
    if (st.status !== STATUS.REGISTERED || st.epoch !== epoch) return log(`watcher: ${t.name} registration at epoch ${epoch} is not current: ignored`);
    t.resolver = await client.readContract({ address: t.registry, abi: permissionedRegistryAbi, functionName: 'getResolver', args: [t.label] });
    t.epoch = epoch;
    t.expiry = st.expiry;
    await sink.updatePolicy({ node: t.node, epoch, revoked: false, expiry: st.expiry });
    await patch(t, { epoch, status: t.textStatus === 'paused' ? 'paused' : 'active', expiry: st.expiry });
    t.revoked = false;
    t.expired = false;
    gate?.invalidate(t.name);
    log(`watcher: ${t.name} registered at epoch ${epoch}`);
  }

  async function onResolverEvent(t, ev) {
    if (ev.eventName === 'AddressUpdated') {
      if (BigInt(ev.args.coinType) === WHITECHAIN_COIN_TYPE) {
        reader?.invalidatePayee(t.name);
        log(`watcher: ${t.name} Whitechain address record changed: payee cache cleared (no policy touched)`);
      }
      return;
    }
    const { key, value } = ev.args;
    if (key === KEYS.status) {
      t.textStatus = value;
      if (!t.revoked && !t.expired && (value === 'paused' || value === 'active')) await patch(t, { status: value });
      gate?.invalidate(t.name);
    } else if (key === KEYS.capMicro) {
      await patch(t, { ensCapMicro: value }); // shown on the node
      await syncCap(t);
      gate?.invalidate(t.name);
    } else if (key === KEYS.acceptsText) {
      reader?.invalidateAccepts(t.name);
    }
  }

  // The owner's cap reaches the policy only for a live name at its known epoch, from the record as it
  // is now (a replayed batch carries older values: the event's own is never sent), and the sink bounds
  // it. A failed read or write never holds up the batch, since a kill behind it must go through: the
  // ticker tries again.
  async function syncCap(t) {
    if (t.revoked || t.expired || t.epoch === undefined) {
      t.capDue = false;
      return;
    }
    try {
      const st = await registryState(client, t.registry, t.label);
      const value = st.status === STATUS.REGISTERED && st.epoch === t.epoch && st.expiry > BigInt(await now()) ? await readText(client, t.name, KEYS.capMicro) : null;
      if (value !== null && /^(?:0|[1-9][0-9]*)$/.test(value)) await sink.updatePolicy({ node: t.node, epoch: t.epoch, ownerCapMicro: BigInt(value) });
      t.capDue = false;
    } catch (e) {
      t.capDue = true;
      log(`watcher: ${t.name} owner's cap not applied yet (${e.shortMessage ?? e.message}); the ticker tries again`);
    }
  }

  // Events of one batch, in chain order. Returns how many were applied.
  async function handle(events) {
    const logs = sortLogs(events);
    const resources = new Map();
    for (const ev of logs) {
      if (ev.eventName === 'TokenResource') resources.set(`${ev.transactionHash}:${canonicalId(ev.args.tokenId)}`, ev.args.resource);
    }
    for (const ev of logs) {
      try {
        if (ev.eventName === 'TextUpdated' || ev.eventName === 'AddressUpdated') {
          const t = byResolver(ev.address);
          if (t) await onResolverEvent(t, ev);
        } else if (ev.eventName === 'LabelRegistered') {
          const t = byLabel(ev.address, ev.args.label);
          if (t) await onRegistered(t, ev, resources);
        } else if (ev.eventName === 'LabelUnregistered' || ev.eventName === 'ExpiryUpdated') {
          const t = byToken(ev.address, ev.args.tokenId);
          if (t) await (ev.eventName === 'LabelUnregistered' ? onUnregistered(t) : onExpiry(t, ev));
        }
      } catch (e) {
        throw Object.assign(new Error(`watcher: ${ev.eventName} at block ${ev.blockNumber} failed: ${e.shortMessage ?? e.message}`), { blockNumber: ev.blockNumber, cause: e });
      }
    }
    return logs.length;
  }

  const addresses = (pick) => [...new Set([...tracked.values()].map(pick).filter((a) => a && !isAddressEqual(a, zeroAddress)).map(getAddress))];

  async function fetchLogs(from, to) {
    const out = [];
    for (let start = from; start <= to; start += LOG_RANGE) {
      const end = start + LOG_RANGE - 1n < to ? start + LOG_RANGE - 1n : to;
      const registries = addresses((t) => t.registry);
      const resolvers = addresses((t) => t.resolver);
      for (const address of chunks(registries, ADDRESSES_PER_QUERY)) out.push(...(await client.getLogs({ address, events: REGISTRY_EVENTS, fromBlock: start, toBlock: end })));
      for (const address of chunks(resolvers, ADDRESSES_PER_QUERY)) out.push(...(await client.getLogs({ address, events: RESOLVER_EVENTS, fromBlock: start, toBlock: end })));
    }
    return out;
  }

  // One pass over the new blocks. The checkpoint moves only past blocks whose events were all applied.
  function poll() {
    return serial(async () => {
      const head = await client.getBlockNumber({ cacheTime: 0 });
      const last = await checkpoint.get();
      if (last === undefined || last === null) {
        await checkpoint.set(head);
        return { events: 0, from: head, to: head };
      }
      if (head < last) return { events: 0, from: last, to: last };
      const from = last + 1n > REPLAY_BLOCKS ? last + 1n - REPLAY_BLOCKS : 0n;
      polls += 1;
      if (untracked.size > 0 && polls % RETRY_UNTRACKED_EVERY === 0) await resolveTracked();
      let events;
      try {
        events = await fetchLogs(from, head);
      } catch (e) {
        throw new Error(`watcher: reading logs ${from}..${head} failed (${e.shortMessage ?? e.message})`);
      }
      try {
        await handle(events);
      } catch (e) {
        if (e.blockNumber !== undefined) await checkpoint.set(e.blockNumber - 1n > last ? e.blockNumber - 1n : last);
        throw e;
      }
      await checkpoint.set(head);
      return { events: events.length, from, to: head };
    });
  }

  // The ticker: a lapse emits nothing, so compare chain time with the stored expiry.
  function tick() {
    return serial(async () => {
      for (const t of tracked.values()) if (t.capDue) await syncCap(t);
      const t0 = await now();
      let marked = 0;
      for (const t of tracked.values()) {
        if (t.revoked || t.expired || !t.expiry || t.expiry === 0n || t.epoch === undefined) continue;
        if (BigInt(t0) >= t.expiry) {
          await patch(t, { status: 'expired' });
          t.expired = true;
          gate?.invalidate(t.name);
          marked += 1;
          log(`watcher: ${t.name} lapsed at ${t.expiry}: node marked expired`);
        }
      }
      return { marked };
    });
  }

  // Start: resolve the tracked names, catch up from chain state (a kill or lapse while the
  // watcher was down), and take the checkpoint at the head so the live pass starts there.
  function start() {
    return serial(async () => {
      await resolveTracked();
      for (const t of tracked.values()) {
        if (t.state.status === STATUS.REGISTERED) {
          try {
            t.textStatus = await readText(client, t.name, KEYS.status);
          } catch {
            t.textStatus = undefined;
          }
          continue;
        }
        if (t.state.expiry === 0n) continue; // never registered
        if (isAddressEqual(t.state.latestOwner, zeroAddress)) {
          if (!t.revoked && t.epoch !== undefined) await onUnregistered(t);
        }
      }
      const head = await client.getBlockNumber({ cacheTime: 0 });
      if ((await checkpoint.get()) == null) await checkpoint.set(head);
      return { tracked: tracked.size, checkpoint: await checkpoint.get() };
    });
  }

  // Timers for the workers process. Returns stop().
  function run({ pollMs = 5_000, tickMs = 30_000, onError = (e) => log(`watcher: ${e.message}`) } = {}) {
    const timers = [setInterval(() => poll().catch(onError), pollMs), setInterval(() => tick().catch(onError), tickMs)];
    return () => timers.forEach(clearInterval);
  }

  return { start, poll, tick, handle: (events) => serial(() => handle(events)), run, tracked: () => [...tracked.values()], resolveTracked };
}

export function memoryCheckpoint(initial) {
  let value = initial;
  return { get: async () => value, set: async (v) => { value = v; } };
}
