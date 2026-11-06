import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Busy, MAX_WAITING, Refusal, markDispatched, refundOrder, shopKeyConfigured, shopKeyName, type Chain } from './merchant-actions.server.ts';

// These tests check the gated mode; the public-access guards are tested on their own.
process.env.GRAPHPAY_PUBLIC_ACCESS = '0';

const SHOP_WALLET = `0x${'aa'.repeat(20)}` as const;
const OTHER = `0x${'bb'.repeat(20)}`;
let n = 0;
// A new order id for each test: the in-flight lock is by order id.
const fresh = () => `0x${(++n).toString(16).padStart(64, '0')}`;
const ORDER = fresh();
const CHECKOUT = `0x${'cc'.repeat(20)}` as const;
const TOKEN = `0x${'dd'.repeat(20)}` as const;

interface Opts {
  chainId?: number;
  hold?: Promise<void> | null;
  balance?: bigint;
  allowance?: bigint;
  receipt?: 'success' | 'reverted' | 'timeout';
  gas?: bigint;
  writeFails?: boolean;
  // The receipt of an earlier send, as the node answers for it later.
  laterReceipt?: boolean;
}

function fakeChain(order: { status: number; amountMicro?: bigint; refundedMicro?: bigint; merchant?: string }, { chainId = 1874, hold = null, balance = 10_000_000n, allowance = 10_000_000n, receipt = 'success', laterReceipt = false, gas = 50_000_000_000_000_000n, writeFails = false }: Opts = {}) {
  const sent: { fn: string; args: unknown[] }[] = [];
  const chain: Chain = {
    chainId: 1874,
    checkout: CHECKOUT,
    token: TOKEN,
    publicClient: {
      getChainId: async () => chainId,
      getBalance: async () => gas,
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'balanceOf') return balance;
        if (functionName === 'allowance') return allowance;
        return { status: order.status, amountMicro: order.amountMicro ?? 4_800_000n, refundedMicro: order.refundedMicro ?? 0n, merchant: order.merchant ?? SHOP_WALLET };
      },
      // Like viem: simulated from an address, the returned request carries a node-managed (json-rpc) account.
      simulateContract: async ({ functionName, args, account }: { functionName: string; args: unknown[]; account?: unknown }) => ({ request: { fn: functionName, args, account: { address: account, type: 'json-rpc' } } }),
      waitForTransactionReceipt: async () => {
        if (receipt === 'timeout') throw new Error('timed out waiting for the receipt');
        return { status: receipt };
      },
      getTransactionReceipt: async () => {
        if (!laterReceipt) throw new Error('not found');
        return { status: 'success' };
      },
    } as unknown as Chain['publicClient'],
    walletClient: {
      account: { address: SHOP_WALLET, type: 'local' },
      writeContract: async (request: { fn: string; args: unknown[]; account?: { type?: string } }) => {
        // A node-managed account makes viem call eth_sendTransaction, which public RPCs refuse (production's 502).
        if (request.account?.type !== 'local') throw new Error('the node would be asked to sign: eth_sendTransaction is not available');
        if (hold) await hold;
        if (writeFails) throw new Error('the answer was lost');
        sent.push({ fn: request.fn, args: request.args });
        return `0x${String(sent.length).padStart(64, '0')}`;
      },
    } as unknown as Chain['walletClient'],
  };
  return { chain: Promise.resolve(chain), sent };
}

test('a paid order of this shop is marked dispatched, once; the transaction comes back', async () => {
  const order = fresh();
  const { chain, sent } = fakeChain({ status: 2 });
  const out = await markDispatched(order, chain);
  assert.match(out.transaction, /^0x[0-9a-f]{64}$/);
  assert.equal(out.status, 'confirmed');
  assert.deepEqual(sent, [{ fn: 'markDelivered', args: [order] }]);
});

test('dispatch refuses another shop’s order, a missing order and an order that is not waiting, and sends nothing', async () => {
  for (const [order, code] of [[{ status: 2, merchant: OTHER }, 'NOT_OURS'], [{ status: 0 }, 'NO_SUCH_ORDER'], [{ status: 3 }, 'NOT_DELIVERABLE'], [{ status: 1 }, 'NOT_DELIVERABLE'], [{ status: 5 }, 'NOT_DELIVERABLE']] as const) {
    const { chain, sent } = fakeChain(order);
    await assert.rejects(markDispatched(ORDER, chain), (e) => e instanceof Refusal && e.code === code, code);
    assert.equal(sent.length, 0);
  }
});

test('a partial refund, a full refund and an over-refund: the amount can never exceed what is left', async () => {
  const partial = fakeChain({ status: 2, refundedMicro: 0n });
  const o1 = fresh();
  assert.deepEqual(await refundOrder(o1, 800_000n, partial.chain), { transaction: `0x${'1'.padStart(64, '0')}`, status: 'confirmed', amountMicro: '800000', full: false });
  assert.deepEqual(partial.sent, [{ fn: 'refund', args: [o1, 800_000n, 1] }]);

  const rest = fakeChain({ status: 3, refundedMicro: 800_000n });
  const o2 = fresh();
  const full = await refundOrder(o2, null, rest.chain);
  assert.equal(full.amountMicro, '4000000');
  assert.equal(full.full, true);
  assert.deepEqual(rest.sent[0]?.args, [o2, 4_000_000n, 1]);

  const over = fakeChain({ status: 2, refundedMicro: 800_000n });
  await assert.rejects(refundOrder(ORDER, 4_100_000n, over.chain), (e) => e instanceof Refusal && e.code === 'OVER_REFUNDABLE');
  const done = fakeChain({ status: 2, amountMicro: 4_800_000n, refundedMicro: 4_800_000n });
  await assert.rejects(refundOrder(ORDER, null, done.chain), (e) => e instanceof Refusal && e.code === 'BAD_AMOUNT');
  const gone = fakeChain({ status: 5 });
  await assert.rejects(refundOrder(ORDER, 1n, gone.chain), (e) => e instanceof Refusal && e.code === 'NOT_REFUNDABLE');
  assert.equal(over.sent.length + done.sent.length + gone.sent.length, 0);
});

test('a refund of another shop’s order is refused', async () => {
  const { chain, sent } = fakeChain({ status: 2, merchant: OTHER });
  await assert.rejects(refundOrder(ORDER, 100n, chain), (e) => e instanceof Refusal && e.code === 'NOT_OURS');
  assert.equal(sent.length, 0);
});

test('a chain that is not Whitechain Sepolia signs nothing', async () => {
  const { chain, sent } = fakeChain({ status: 2 }, { chainId: 1 });
  await assert.rejects(markDispatched(ORDER, chain), (e: unknown) => e instanceof Error && e.name === 'ChainRefused');
  assert.equal(sent.length, 0);
});

test('sends run one at a time, and a client cannot stack them: past the limit the next is refused', async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const held = fakeChain({ status: 2 }, { hold: gate });
  const first = Array.from({ length: MAX_WAITING }, () => markDispatched(ORDER, held.chain));
  await assert.rejects(markDispatched(ORDER, held.chain), Busy);
  release();
  await Promise.all(first);
  assert.equal(held.sent.length, MAX_WAITING);
  assert.match((await markDispatched(ORDER, fakeChain({ status: 2 }).chain)).transaction, /^0x/);
});

test('the shop’s key is named from the story (never typed here) and counted only when well-formed', () => {
  const name = shopKeyName();
  assert.match(name, /^[A-Z0-9_]+_PRIVATE_KEY$/);
  assert.equal(shopKeyConfigured({}), false);
  assert.equal(shopKeyConfigured({ [name]: '0x12' }), false);
  assert.equal(shopKeyConfigured({ [name]: `0x${'1'.repeat(64)}` }), true);
});

test('the float is checked before anything is signed: a wallet that cannot cover the refund gets a clear refusal', async () => {
  for (const opts of [{ balance: 100n }, { allowance: 100n }]) {
    const { chain, sent } = fakeChain({ status: 2 }, opts);
    await assert.rejects(refundOrder(fresh(), 800_000n, chain), (e) => e instanceof Refusal && e.code === 'FLOAT_LOW');
    assert.equal(sent.length, 0);
  }
});

test('a receipt that does not arrive keeps the hash and locks the order: a retry cannot pay twice', async () => {
  const order = fresh();
  const first = fakeChain({ status: 2 }, { receipt: 'timeout' });
  const quiet = console.error;
  const logged: string[] = [];
  console.error = (...a: unknown[]) => logged.push(a.join(' '));
  try {
    const out = await refundOrder(order, 800_000n, first.chain);
    assert.equal(out.status, 'pending');
    assert.match(out.transaction, /^0x[0-9a-f]{64}$/);
    assert.ok(logged.some((l) => l.includes(out.transaction)), 'the hash is logged, it is not a secret');
    // The same order again, the node still has no receipt: refused, nothing sent.
    const retry = fakeChain({ status: 2 });
    await assert.rejects(refundOrder(order, 800_000n, retry.chain), (e) => e instanceof Refusal && e.code === 'STILL_PENDING');
    await assert.rejects(markDispatched(order, retry.chain), (e) => e instanceof Refusal && e.code === 'STILL_PENDING');
    assert.equal(retry.sent.length, 0);
    // Once the first has a receipt, the next send goes through.
    const later = fakeChain({ status: 2 }, { laterReceipt: true });
    assert.equal((await refundOrder(order, 800_000n, later.chain)).status, 'confirmed');
    assert.equal(later.sent.length, 1);
  } finally {
    console.error = quiet;
  }
});

test('a reverted receipt is an error, not a pending send, and does not lock the order', async () => {
  const order = fresh();
  const reverted = fakeChain({ status: 2 }, { receipt: 'reverted' });
  await assert.rejects(markDispatched(order, reverted.chain), /reverted/);
  const next = fakeChain({ status: 2 });
  assert.equal((await markDispatched(order, next.chain)).status, 'confirmed');
});

test('public access: a visitor acts only on the story persona’s orders, once per order per cooldown', async () => {
  const { visitorGuard, ORDER_COOLDOWN_MS } = await import('./merchant-actions.server.ts');
  const persona = `0x${'aa'.repeat(32)}`;
  const order = { status: 'PAID', amountMicro: 1n, refundedMicro: 0n, merchant: '0x0000000000000000000000000000000000000001', shopNode: `0x${'00'.repeat(32)}`, buyerNode: persona } as const;
  const id = `0x${'0b'.repeat(32)}`;
  assert.throws(() => visitorGuard({ ...order, buyerNode: `0x${'bb'.repeat(32)}` }, id, { open: true, now: 0, persona }), (e: unknown) => e instanceof Refusal && e.code === 'NOT_THE_STORY_BUYER' && e.status === 403);
  visitorGuard(order, id, { open: true, now: 1_000, persona });
  assert.throws(() => visitorGuard(order, id, { open: true, now: 1_000 + ORDER_COOLDOWN_MS - 1, persona }), (e: unknown) => e instanceof Refusal && e.code === 'TOO_SOON');
  visitorGuard(order, id, { open: true, now: 1_000 + ORDER_COOLDOWN_MS, persona });
  // The gated mode keeps the passcode as its only gate.
  visitorGuard({ ...order, buyerNode: `0x${'bb'.repeat(32)}` }, id, { open: false, persona });
});

test('a send that fails after it may have reached the node locks the order, so a retry cannot refund twice', async () => {
  const order = fresh();
  const { chain, sent } = fakeChain({ status: 2 }, { writeFails: true });
  await assert.rejects(refundOrder(order, 800_000n, chain), /answer was lost/);
  // The same order, tried again at once: refused, nothing sent.
  const again = fakeChain({ status: 2 });
  await assert.rejects(refundOrder(order, 800_000n, again.chain), (e: unknown) => e instanceof Refusal && e.code === 'STILL_PENDING');
  assert.equal(again.sent.length, 0);
  assert.equal(sent.length, 0);
});

test('a shop wallet with no native coin for gas is refused with its own code before anything is sent', async () => {
  const order = fresh();
  const { chain, sent } = fakeChain({ status: 2 }, { gas: 0n });
  await assert.rejects(markDispatched(order, chain), (e: unknown) => e instanceof Refusal && e.code === 'GAS_LOW');
  assert.equal(sent.length, 0);
});
