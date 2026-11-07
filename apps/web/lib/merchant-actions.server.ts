// The merchant phone's Mark dispatched and Refund (WEBSITE_SPEC.md §4, §7; E-3): the shop's
// own key signs on the server, behind the passcode, on Whitechain Sepolia. The order is read
// from the checkout contract first: it must be this shop's, in a state the action fits, and a
// refund can never exceed what is left. The shop is always the story's merchant shop, never a
// name from the request; the key is read from the env by role name and never leaves here.
import { ORDER_STATUS, checkoutAbi } from '@graphpay/contracts';
import { activeCast, castEntries, config } from '@graphpay/config';
import { createWalletClient, erc20Abi, getAbiItem, getAddress, isAddressEqual, namehash, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { checkoutAddress } from './site.server.ts';
import { publicAccess } from './passcode.ts';
import { whitechain } from './payments.server.ts';

export const SHOP_KEY_WAITING_FOR = "the shop's key on this server (the Coordinator sets it in Vercel)";
const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
// The refund's reason code (a uint8 the contract only emits). The spec has no table for it: 1 is
// "the merchant's own refund", the one the merchant phone sends (OPEN.md asks for a shared table).
export const MERCHANT_REFUND_REASON = 1;

// A refusal the merchant can act on (shown as its code); anything else is a failure of the chain.
export type RefusalCode = 'NO_SUCH_ORDER' | 'NOT_OURS' | 'NOT_THE_STORY_BUYER' | 'TOO_SOON' | 'NOT_DELIVERABLE' | 'NOT_REFUNDABLE' | 'BAD_AMOUNT' | 'OVER_REFUNDABLE' | 'FLOAT_LOW' | 'STILL_PENDING' | 'GAS_LOW';
export class Refusal extends Error {
  code: RefusalCode;
  status: number;
  constructor(code: RefusalCode, status = 409) {
    super(code);
    this.name = 'Refusal';
    this.code = code;
    this.status = status;
  }
}

export interface OrderState {
  status: string;
  amountMicro: bigint;
  refundedMicro: bigint;
  merchant: string;
  shopNode: string;
  buyerNode: string;
}

export interface Chain {
  publicClient: Pick<PublicClient, 'readContract' | 'simulateContract' | 'waitForTransactionReceipt' | 'getTransactionReceipt' | 'getChainId' | 'getBalance' | 'getBlockNumber' | 'getLogs'>;
  // The token the checkout pays refunds in (the merchant's float).
  token: `0x${string}`;
  walletClient: Pick<WalletClient, 'writeContract'> & { account: { address: `0x${string}` } };
  checkout: `0x${string}`;
  chainId: number;
}

export function shopKeyName(): string {
  const cast = activeCast();
  const shop = cast.shops.find((s) => s.key === (cast.order as { shop?: string }).shop);
  if (!shop) throw new Error('the story names no shop for the demo order');
  return `${shop.walletRole}_PRIVATE_KEY`;
}

export function shopKeyConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return KEY_SHAPE.test(env[shopKeyName()] ?? '');
}

async function liveChain(): Promise<Chain> {
  const w = await whitechain();
  const checkout = checkoutAddress();
  if (!checkout) throw new Error('the checkout is not deployed');
  const key = process.env[shopKeyName()] ?? '';
  if (!KEY_SHAPE.test(key)) throw new Error('the shop key is not set');
  const walletClient = createWalletClient({ account: privateKeyToAccount(key as Hex), chain: w.chain, transport: w.transport });
  return { publicClient: w.publicClient, walletClient: walletClient as unknown as Chain['walletClient'], checkout: checkout as `0x${string}`, chainId: w.chain.id, token: config.whitechain.tokens.usdt.address as `0x${string}` };
}

export async function readOrder(chain: Pick<Chain, 'publicClient' | 'checkout'>, orderId: string): Promise<OrderState> {
  const o = (await chain.publicClient.readContract({ address: chain.checkout, abi: checkoutAbi, functionName: 'orders', args: [orderId as Hex] })) as { status: number | bigint; amountMicro: bigint; refundedMicro: bigint; merchant: string; shopNode: string; buyerNode: string };
  return { status: ORDER_STATUS[Number(o.status)] ?? 'NONE', amountMicro: o.amountMicro, refundedMicro: o.refundedMicro, merchant: o.merchant, shopNode: o.shopNode, buyerNode: o.buyerNode };
}

// One send at a time on this instance (one nonce), so two clicks never race into a second send. The
// queue is per instance: the hosted shop's own delivery mark uses the same key on its own route, so
// two sends at the same moment can clash on the nonce; that fails cleanly (nothing is sent twice).
let tail: Promise<unknown> = Promise.resolve();
let waiting = 0;
export const MAX_WAITING = 2;
export class Busy extends Error {}
function serially<T>(task: () => Promise<T>): Promise<T> {
  if (waiting >= MAX_WAITING) return Promise.reject(new Busy('busy'));
  waiting += 1;
  const run = tail.then(task, task).finally(() => {
    waiting -= 1;
  });
  tail = run.catch(() => undefined);
  return run;
}

// A send that has not been confirmed yet, by order id (this instance only): a second send for the
// same order waits until the first one has a receipt, so a retry can never pay twice.
const inFlight = new Map<string, string>();

export interface Sent {
  transaction: string;
  // 'pending': the transaction was sent but its receipt did not arrive in time; it may still land.
  status: 'confirmed' | 'pending';
}

// Named so a log line (errorNames: class names only, never a message) says what happened.
export class ChainRefused extends Error {
  constructor() {
    super('the RPC reports another chain');
    this.name = 'ChainRefused';
  }
}
export class Reverted extends Error {
  constructor() {
    super('the transaction reverted');
    this.name = 'Reverted';
  }
}

// A send that failed after it may have reached the node (the transport retries once, so the transaction
// can be pending or mined with no hash returned): the order is locked for a while, so a "try again" cannot
// send a second partial refund. Per instance, like inFlight.
export const UNSURE_MS = 120_000;
const unsure = new Map<string, number>();

async function settled(chain: Chain, orderId: string): Promise<void> {
  const at = unsure.get(orderId);
  if (at !== undefined) {
    if (Date.now() - at < UNSURE_MS) throw new Refusal('STILL_PENDING');
    unsure.delete(orderId);
  }
  const hash = inFlight.get(orderId);
  if (!hash) return;
  const receipt = await chain.publicClient.getTransactionReceipt({ hash: hash as Hex }).catch(() => null);
  if (!receipt) throw new Refusal('STILL_PENDING');
  inFlight.delete(orderId);
}

async function send(chain: Chain, orderId: string, functionName: 'markDelivered' | 'refund', args: readonly unknown[]): Promise<Sent> {
  // eth_chainId before every signing step (CLAUDE.md): any other chain is refused.
  const id = await chain.publicClient.getChainId();
  if (id !== chain.chainId) throw new ChainRefused();
  // No native coin, no gas: say so instead of a generic failure.
  if ((await chain.publicClient.getBalance({ address: chain.walletClient.account.address })) === 0n) throw new Refusal('GAS_LOW');
  const { request } = await chain.publicClient.simulateContract({ address: chain.checkout, abi: checkoutAbi, functionName, args: args as never, account: chain.walletClient.account.address });
  // The request simulateContract returns carries the account it was simulated from. Given an address, that is a
  // node-managed (json-rpc) account, and viem would call eth_sendTransaction, which public RPCs refuse. The
  // shop's own key signs here, so the wallet's local account replaces it.
  let hash: Hex;
  try {
    hash = await chain.walletClient.writeContract({ ...request, account: chain.walletClient.account } as never);
  } catch (error) {
    unsure.set(orderId, Date.now());
    throw error;
  }
  inFlight.set(orderId, hash);
  try {
    const receipt = await chain.publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== 'success') {
      inFlight.delete(orderId);
      throw new Reverted();
    }
    inFlight.delete(orderId);
    return { transaction: hash, status: 'confirmed' };
  } catch (error) {
    if (error instanceof Reverted) throw error;
    // No receipt in time: the hash is returned (it is not a secret), never lost, and the order stays
    // locked against a second send until a receipt shows.
    console.error(`merchant ${functionName} pending: ${hash}`);
    return { transaction: hash, status: 'pending' };
  }
}

function ours(chain: Chain, order: OrderState): void {
  if (order.status === 'NONE') throw new Refusal('NO_SUCH_ORDER', 404);
  if (!isAddressEqual(getAddress(order.merchant), chain.walletClient.account.address)) throw new Refusal('NOT_OURS');
}

// Public access (ADR-0069): a visitor acts for the shop only on the story persona's own orders
// (the contract's buyerNode is the buyer owner's ENS node), never on an outside buyer's, and
// one action per order at most every ORDER_COOLDOWN_MS on this instance, so a loop of tiny
// refunds cannot drain the shop's gas or float.
export const ORDER_COOLDOWN_MS = 30_000;
const lastAction = new Map<string, number>();
const personaNode = (): string => namehash(castEntries().find((e) => e.kind === 'persona')!.ensName).toLowerCase();

// The persona part alone, for an answer that sends nothing (it needs no cooldown).
export function visitorBuyer(order: OrderState, { open = publicAccess(), persona = personaNode() }: { open?: boolean; persona?: string } = {}): void {
  if (!open) return;
  if (order.buyerNode.toLowerCase() !== persona) throw new Refusal('NOT_THE_STORY_BUYER', 403);
}

export function visitorGuard(order: OrderState, orderId: string, { open = publicAccess(), now = Date.now(), persona = personaNode() }: { open?: boolean; now?: number; persona?: string } = {}): void {
  if (!open) return;
  visitorBuyer(order, { open, persona });
  const last = lastAction.get(orderId);
  if (last !== undefined && now - last < ORDER_COOLDOWN_MS) throw new Refusal('TOO_SOON', 429);
  lastAction.set(orderId, now);
}

// An order the hosted shop already marked delivered (its own dispatch lands about 3 s after payment):
// nothing is sent; the delivery's own transaction comes back, or null when it is older than the blocks read.
export interface AlreadyDelivered {
  transaction: string | null;
  status: 'confirmed';
  alreadyDelivered: true;
}

// The OrderDelivered log of one order, from the chain (never the Arkiv mirror, which lags): the last
// 2,000 blocks (one a second, about 33 minutes), newest first, in ranges every endpoint answers
// (FACTS.md: public Ankr refuses more than about 1,000 blocks; the keyed URL was not measured).
export const DELIVERY_RANGE = 1_000n;
export const DELIVERY_RANGES = 2;
const ORDER_DELIVERED = getAbiItem({ abi: checkoutAbi, name: 'OrderDelivered' });

async function deliveryTransaction(chain: Chain, orderId: string): Promise<string | null> {
  try {
    const head = await chain.publicClient.getBlockNumber();
    for (let i = 0; i < DELIVERY_RANGES; i += 1) {
      const toBlock = head - BigInt(i) * DELIVERY_RANGE;
      if (toBlock < 0n) break;
      const fromBlock = toBlock >= DELIVERY_RANGE - 1n ? toBlock - (DELIVERY_RANGE - 1n) : 0n;
      const logs = await chain.publicClient.getLogs({ address: chain.checkout, event: ORDER_DELIVERED, args: { orderId: orderId as Hex }, fromBlock, toBlock });
      const hit = logs.find((l) => l.transactionHash);
      if (hit?.transactionHash) return hit.transactionHash;
      if (fromBlock === 0n) break;
    }
  } catch (error) {
    // The order is delivered either way; the kind only (a chain error's message can name an RPC).
    console.error('merchant dispatch: delivery lookup failed:', error instanceof Error ? error.name : typeof error);
  }
  return null;
}

// A send that lost the race to the hosted shop's own mark (same key: a revert, a nonce clash) is
// answered from the chain once that mark shows, read again every second for up to waitMs.
export const RACE = { waitMs: 10_000 };

export function markDispatched(orderId: string, chain?: Promise<Chain>): Promise<Sent | AlreadyDelivered> {
  return serially(async () => {
    const c = await (chain ?? liveChain());
    const order = await readOrder(c, orderId);
    ours(c, order);
    const already = async (): Promise<AlreadyDelivered> => ({ transaction: await deliveryTransaction(c, orderId), status: 'confirmed', alreadyDelivered: true });
    // Idempotent, before the send lock: already delivered on chain is the answer a fresh dispatch would give, with no send.
    if (order.status === 'DELIVERED') {
      visitorBuyer(order);
      return already();
    }
    await settled(c, orderId);
    if (order.status !== 'PAID') throw new Refusal('NOT_DELIVERABLE');
    visitorGuard(order, orderId);
    try {
      return await send(c, orderId, 'markDelivered', [orderId]);
    } catch (error) {
      if (error instanceof Refusal || error instanceof ChainRefused) throw error;
      const until = Date.now() + RACE.waitMs;
      for (;;) {
        if ((await readOrder(c, orderId).catch(() => null))?.status === 'DELIVERED') return already();
        if (Date.now() >= until) throw error;
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
  });
}

// `amountMicro` null is a full refund: whatever the contract says is left.
export function refundOrder(orderId: string, amountMicro: bigint | null, chain?: Promise<Chain>): Promise<Sent & { amountMicro: string; full: boolean }> {
  return serially(async () => {
    const c = await (chain ?? liveChain());
    const order = await readOrder(c, orderId);
    ours(c, order);
    if (order.status !== 'PAID' && order.status !== 'DELIVERED') throw new Refusal('NOT_REFUNDABLE');
    const left = order.amountMicro - order.refundedMicro;
    const amount = amountMicro ?? left;
    if (amount <= 0n) throw new Refusal('BAD_AMOUNT');
    if (amount > left) throw new Refusal('OVER_REFUNDABLE');
    await settled(c, orderId);
    // The float: the shop's wallet must hold the amount and have approved it to the checkout, or the
    // refund would revert; say so instead of a generic failure.
    const [balance, allowance] = await Promise.all([
      c.publicClient.readContract({ address: c.token, abi: erc20Abi, functionName: 'balanceOf', args: [c.walletClient.account.address] }),
      c.publicClient.readContract({ address: c.token, abi: erc20Abi, functionName: 'allowance', args: [c.walletClient.account.address, c.checkout] }),
    ]);
    if (balance < amount || allowance < amount) throw new Refusal('FLOAT_LOW');
    visitorGuard(order, orderId);
    const sent = await send(c, orderId, 'refund', [orderId, amount, MERCHANT_REFUND_REASON]);
    return { ...sent, amountMicro: String(amount), full: amount === left };
  });
}

export const isOrderId = (v: unknown): v is string => typeof v === 'string' && HEX32.test(v);
