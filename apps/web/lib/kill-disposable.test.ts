import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeCast, disposableEntry } from '@graphpay/config';
import type { LiveDisposable } from '@graphpay/ens';
import { Busy, GATE_CACHE_MS, NotReady, REVOKE_WAIT_MS, killConfigured, killProduct, killSpare, readySpare, spareNumbers, type KillDeps, type PaymentAfterKill } from './kill-disposable.server.ts';
import type { ModelProduct } from './site.server.ts';

const KEY = `0x${'11'.repeat(32)}`;
const HOLDER = `0x${'22'.repeat(20)}` as const;
const OTHER = `0x${'99'.repeat(20)}` as const;
const KILL_TX = `0x${'aa'.repeat(32)}`;
const REVOKE_TX = `0x${'bb'.repeat(32)}`;
const ORDER = `0x${'cc'.repeat(32)}`;
const PRODUCT: ModelProduct = { sku: 'item', name: 'an item', unit: 'cup', quantity: 1, priceMicro: '800000' };
const REFUSED: PaymentAfterKill = { outcome: 'refused', http: 402, reason: 'ENS_EXPIRED_OR_REVOKED', orderId: ORDER, transaction: null };

const spareOf = (n: number, holder: `0x${string}` = HOLDER): LiveDisposable => ({ n, name: disposableEntry(n).ensName, node: `0x${'dd'.repeat(32)}`, epoch: 0, expiry: 2_000_000_000n, holder, registry: `0x${'33'.repeat(20)}`, resolver: `0x${'44'.repeat(20)}` });

// A fake chain on a virtual clock: sleep moves time on; the watcher revokes `revokeAfterMs` after the kill.
function world(over: Partial<{ live: number[]; ready: number[]; holders: Record<number, `0x${string}`>; revokeAfterMs: number | null; killed: boolean; payment: PaymentAfterKill | Error; recordAfterMs: number }> = {}) {
  const w = { t: 1_000_000, live: [2, 3], ready: [2, 3], holders: {} as Record<number, `0x${string}`>, revokeAfterMs: 9_000 as number | null, killed: true, payment: REFUSED as PaymentAfterKill | Error, recordAfterMs: 4_000, ...over };
  const calls: string[] = [];
  let killedAt: number | null = null;
  let paidAt: number | null = null;
  const deps: KillDeps = {
    numbers: () => [2, 3, 4],
    findSpare: async (numbers) => {
      const n = numbers.find((x) => w.live.includes(x));
      return n === undefined ? null : spareOf(n, w.holders[n] ?? HOLDER);
    },
    addressOf: () => HOLDER,
    passReady: async (spare) => w.ready.includes(spare.n),
    kill: async (name) => {
      calls.push(`kill ${name}`);
      killedAt = w.t;
      w.live = w.live.filter((n) => disposableEntry(n).ensName !== name);
      return w.killed ? { changed: true, hash: KILL_TX } : { changed: false, killedEarlier: true };
    },
    revoked: async () => w.revokeAfterMs !== null && killedAt !== null && w.t - killedAt >= w.revokeAfterMs,
    revokeTx: async () => REVOKE_TX,
    pay: async (spare, product) => {
      calls.push(`pay ${spare.name} ${product.sku} at +${w.t - (killedAt ?? w.t)}`);
      paidAt = w.t;
      if (w.payment instanceof Error) throw w.payment;
      return w.payment;
    },
    recorded: async (orderId, payer, reason) => (paidAt !== null && w.t - paidAt >= w.recordAfterMs ? `att:${orderId}:${payer}:${reason}` : null),
    now: () => w.t,
    sleep: async (ms) => {
      w.t += ms;
    },
  };
  return { w, deps, calls };
}

test('the kill takes the lowest ready spare, waits for the revoke and the gate cache, then reports the refused, recorded payment', async () => {
  const { deps, calls } = world();
  const r = await killSpare(deps, PRODUCT);
  const name = disposableEntry(2).ensName;
  assert.equal(r.name, name);
  assert.equal(r.label, name.split('.')[0]);
  assert.deepEqual(r.txs, [
    { chain: 'sepolia', what: 'unregister', hash: KILL_TX },
    { chain: 'whitechain', what: 'revoke', hash: REVOKE_TX },
  ]);
  assert.equal(r.revoked, true);
  assert.deepEqual(r.payment, REFUSED);
  assert.ok(r.recorded?.ref.startsWith(`att:${ORDER}:`));
  assert.equal(r.nextSpare, disposableEntry(3).ensName);
  assert.equal(r.incomplete, null);
  // the payment comes only after the gate's 20 s cache, never sooner
  const at = Number(/at \+(\d+)/.exec(calls[1] ?? '')?.[1]);
  assert.ok(at >= GATE_CACHE_MS, `paid ${at} ms after the kill`);
});

test('a spare whose pass is not live yet is not offered, and nothing is killed', async () => {
  const provisioning = world({ ready: [] });
  await assert.rejects(killSpare(provisioning.deps, PRODUCT), NotReady);
  assert.deepEqual(provisioning.calls, []);
  assert.equal(await readySpare(provisioning.deps), null);
});

test('a spare not held by its key is passed over for the next one', async () => {
  const { deps, calls } = world({ holders: { 2: OTHER } });
  assert.equal((await readySpare(deps))?.n, 3);
  const r = await killSpare(deps, PRODUCT);
  assert.equal(r.name, disposableEntry(3).ensName);
  assert.equal(calls[0], `kill ${disposableEntry(3).ensName}`);
});

test('without a seen revoke the payment is still tried after the wait, and the answer says so', async () => {
  const { deps } = world({ revokeAfterMs: null });
  const r = await killSpare(deps, PRODUCT);
  assert.equal(r.revoked, false);
  assert.deepEqual(r.txs.map((t) => t.what), ['unregister']);
  assert.equal(r.payment?.reason, 'ENS_EXPIRED_OR_REVOKED');
  assert.ok(REVOKE_WAIT_MS > GATE_CACHE_MS);
});

test('no item within the cap, no key or no live spare is NotReady and kills nothing; a name killed first elsewhere is Busy', async () => {
  const none = world({ live: [] });
  await assert.rejects(killSpare(none.deps, PRODUCT), NotReady);
  assert.deepEqual(none.calls, []);
  const keyless = world();
  keyless.deps.numbers = () => [];
  await assert.rejects(killSpare(keyless.deps, PRODUCT), NotReady);
  const nothingFits = world();
  await assert.rejects(killSpare(nothingFits.deps, null), NotReady);
  assert.deepEqual(nothingFits.calls, []);
  const raced = world({ killed: false });
  await assert.rejects(killSpare(raced.deps, PRODUCT), Busy);
  assert.equal(raced.calls.filter((c) => c.startsWith('pay')).length, 0);
});

test('a settled or unclear payment is reported as it is; a failure after the kill keeps the kill in the answer', async () => {
  const paid = world({ payment: { outcome: 'paid', http: 200, reason: null, orderId: ORDER, transaction: KILL_TX } });
  const p = await killSpare(paid.deps, PRODUCT);
  assert.equal(p.payment?.outcome, 'paid');
  assert.equal(p.recorded, null);
  const unclear = world({ payment: { outcome: 'unknown', http: 504, reason: 'settle_unknown', orderId: ORDER, transaction: null } });
  const u = await killSpare(unclear.deps, PRODUCT);
  assert.equal(u.payment?.outcome, 'unknown');
  assert.equal(u.recorded, null); // only a 402 refusal is looked for on Arkiv
  const broke = world({ payment: new Error('the paid POST timed out') });
  const b = await killSpare(broke.deps, PRODUCT);
  assert.equal(b.incomplete, 'payment');
  assert.deepEqual(b.txs[0], { chain: 'sepolia', what: 'unregister', hash: KILL_TX });
  assert.equal(b.payment, null);
});

test('one kill at a time on an instance', async () => {
  const { deps } = world();
  let release: () => void = () => undefined;
  const slow: KillDeps = {
    ...deps,
    kill: async (name) => {
      await new Promise<void>((r) => {
        release = r;
      });
      return deps.kill(name);
    },
  };
  const first = killSpare(slow, PRODUCT);
  await new Promise((r) => setImmediate(r));
  await assert.rejects(killSpare(deps, PRODUCT), Busy);
  release();
  await first;
});

test('the item after the kill is the cheapest within the disposable cap, or none', () => {
  const cap = BigInt(activeCast().disposable.capMicro);
  const item = (sku: string, priceMicro: bigint): ModelProduct => ({ ...PRODUCT, sku, priceMicro: String(priceMicro) });
  assert.equal(killProduct([item('a', cap + 1n), item('b', cap), item('c', cap - 1n)], cap)?.sku, 'c');
  assert.equal(killProduct([item('a', cap + 1n)], cap), null);
  assert.ok(killProduct()); // the story's merchant has one
});

test('the spare keys and the configured check come from the env, by the story prefix', () => {
  const cast = activeCast();
  const prefix = cast.disposable.walletRolePrefix;
  const env: Record<string, string> = { [`${prefix}3_PRIVATE_KEY`]: KEY, [`${prefix}2_PRIVATE_KEY`]: KEY, [`${prefix}5_PRIVATE_KEY`]: 'not a key' };
  assert.deepEqual(spareNumbers(env), [2, 3]);
  assert.equal(killConfigured(env), false); // no owner key
  const owner = `${cast.persona.walletRole}_PRIVATE_KEY`;
  assert.equal(killConfigured({ ...env, [owner]: KEY }), true);
  assert.equal(killConfigured({ [owner]: KEY }), false); // no spare key
});
