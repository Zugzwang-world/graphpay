// Kill a disposable agent (WEBSITE_SPEC.md §3 "Kill a disposable agent", §7; the identity track's night
// brief). The spare is the lowest disposable-<n> whose key this server holds (DISPOSABLE_<n>_PRIVATE_KEY,
// set in Vercel by the identity track), whose name is live on Ethereum Sepolia, held by that key, and
// whose spending pass on the Whitechain checkout is live at the name's epoch; never a name from the
// request. A spare still being provisioned (name registered, pass not yet set) is not offered: a kill
// then would leave nothing for the watcher to revoke. In order, each step with its transaction:
//   1. the owner (the persona's wallet) unregisters the name on Sepolia: the kill;
//   2. the ENS watcher in the workers process sees the unregister and revokes the agent's spending pass on
//      the Whitechain checkout (this route only waits for it and reads its transaction);
//   3. the agent signs one payment through the hosted shop; the facilitator refuses it
//      (ENS_EXPIRED_OR_REVOKED) and records the refusal on Arkiv as a `fail` edge.
// The workers process then provisions a fresh spare (scripts/ens/spare.mjs), never this server. The
// agent's key is read from the env by role name, never leaves this file and is never logged.
import { activeCast, config, disposableEntry } from '@graphpay/config';
import { createEnsReader, ensPublicClient, liveDisposable, retryingReads, type LiveDisposable } from '@graphpay/ens';
import { attemptEdge, decodePaymentRequiredHeader, errorNames, graphPayOrderClient, x402Client, x402HTTPClient } from '@graphpay/facilitator';
import { checkoutAbi } from '@graphpay/contracts';
import { runGraphql } from '@graphpay/money-graph';
import { getAbiItem, isAddressEqual, keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { inOwnerQueue, liveOwnerActions, ownerKeyName } from './owner-actions.server.ts';
import { PASSCODE_HEADER } from './passcode-header.ts';
import { whitechain } from './payments.server.ts';
import { outcomeOf } from './reorder-live.server.ts';
import { checkoutAddress, siteModel, type ModelProduct } from './site.server.ts';

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
const SITE = String(config.site.url).replace(/\/+$/, '');
const SHOP = `${SITE}/api/shop`;
const DISPOSABLE_MAX = 64;
// The gate caches a name's verdict for 20 s (planning/SPEC/IDENTITY_ENS.md §7): the payment is tried
// only after that, so no cached "ok" from before the kill can let it through.
export const GATE_CACHE_MS = 21_000;
// The watcher polls every 6 s and waits a Whitechain receipt; past this the payment is tried anyway
// (the ENS gate refuses it either way) and the answer says the revocation was not seen.
export const REVOKE_WAIT_MS = 75_000;
export const RECORD_WAIT_MS = 30_000;
const POLL_MS = 3_000;

// The numbers n whose DISPOSABLE_<n>_PRIVATE_KEY this server holds.
export function spareNumbers(env: Record<string, string | undefined> = process.env): number[] {
  const prefix = activeCast().disposable.walletRolePrefix;
  const out: number[] = [];
  for (let n = 1; n <= DISPOSABLE_MAX; n += 1) if (KEY_SHAPE.test(env[`${prefix}${n}_PRIVATE_KEY`] ?? '')) out.push(n);
  return out;
}

// Live only with a spare's key and the owner's key (the owner of every disposable agent is the persona).
export function killConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const first = spareNumbers(env)[0];
  if (first === undefined) return false;
  try {
    return KEY_SHAPE.test(env[ownerKeyName(disposableEntry(first).ensName)] ?? '');
  } catch {
    return false;
  }
}

function spareAccount(n: number) {
  const key = process.env[`${activeCast().disposable.walletRolePrefix}${n}_PRIVATE_KEY`] ?? '';
  if (!KEY_SHAPE.test(key)) throw new Error('the spare key is not set');
  return privateKeyToAccount(key as Hex);
}

// The item the agent tries to buy after its kill: the merchant's cheapest one within the disposable
// cap, so the refusal can only be the kill's. None fits: no kill at all.
export function killProduct(products: ModelProduct[] = siteModel().merchant.products, capMicro = BigInt(activeCast().disposable.capMicro)): ModelProduct | null {
  const fits = products.filter((p) => BigInt(p.priceMicro) > 0n && BigInt(p.priceMicro) <= capMicro);
  return fits.sort((a, b) => Number(BigInt(a.priceMicro) - BigInt(b.priceMicro)))[0] ?? null;
}

export interface KillTx {
  chain: 'sepolia' | 'whitechain';
  what: 'unregister' | 'revoke';
  hash: string;
}

// The agent's payment after the kill. refused: the shop or the facilitator refused it, nothing sent;
// paid: it settled (reported, never hidden); unknown: it may still settle; not-sent: nothing was signed.
export interface PaymentAfterKill {
  outcome: 'refused' | 'paid' | 'unknown' | 'not-sent';
  http: number | null;
  reason: string | null;
  orderId: string | null;
  transaction: string | null;
}

export interface KillResult {
  label: string;
  name: string;
  txs: KillTx[];
  // The watcher's revocation was seen on the checkout before the payment was tried.
  revoked: boolean;
  payment: PaymentAfterKill | null;
  // The refusal's `fail` edge on Arkiv (its ref), once the recorder has written it.
  recorded: { ref: string } | null;
  // The next ready spare, if one is already provisioned.
  nextSpare: string | null;
  // The step after the kill that could not be completed, if any (the kill itself stands).
  incomplete: 'revoke' | 'payment' | null;
}

export class NotReady extends Error {}
export class Busy extends Error {}

export interface KillDeps {
  numbers(): number[];
  findSpare(numbers: number[]): Promise<LiveDisposable | null>;
  addressOf(n: number): string;
  // The spare's pass on the checkout is live at its epoch, for its own wallet.
  passReady(spare: LiveDisposable): Promise<boolean>;
  kill(name: string): Promise<{ changed: boolean; hash?: string; killedEarlier?: boolean }>;
  revoked(node: string): Promise<boolean>;
  revokeTx(node: string): Promise<string | null>;
  pay(spare: LiveDisposable, product: ModelProduct): Promise<PaymentAfterKill>;
  recorded(orderId: string, payer: string, reason: string): Promise<string | null>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

// The ready spare, or null. A spare not held by its key is passed over; the lowest live one whose pass is
// not live yet is being provisioned, so nothing is offered until it is.
export async function readySpare(deps: Pick<KillDeps, 'numbers' | 'findSpare' | 'addressOf' | 'passReady'>): Promise<LiveDisposable | null> {
  let numbers = deps.numbers();
  for (;;) {
    const spare = await deps.findSpare(numbers);
    if (!spare) return null;
    if (!isAddressEqual(spare.holder as Hex, deps.addressOf(spare.n) as Hex)) {
      numbers = numbers.filter((n) => n > spare.n);
      continue;
    }
    return (await deps.passReady(spare)) ? spare : null;
  }
}

let running = false;

export async function killSpare(deps: KillDeps = liveKillDeps(), product: ModelProduct | null = killProduct()): Promise<KillResult> {
  if (running) throw new Busy('a kill is still running');
  running = true;
  try {
    if (!product) throw new NotReady('no item of the merchant fits the disposable cap');
    if (deps.numbers().length === 0) throw new NotReady('no spare key on this server');
    const spare = await readySpare(deps);
    if (!spare) throw new NotReady('no ready spare yet: the workers provision the next one within a few minutes');

    // 1. The kill: one-shot. A name another request killed in between is no kill of ours.
    const killed = await deps.kill(spare.name);
    if (!killed.changed) throw new Busy('another request killed this spare first');
    const killedAt = deps.now();
    const result: KillResult = { label: spare.name.slice(0, spare.name.indexOf('.')), name: spare.name, txs: [], revoked: false, payment: null, recorded: null, nextSpare: null, incomplete: null };
    if (killed.hash) result.txs.push({ chain: 'sepolia', what: 'unregister', hash: killed.hash });

    // From here the kill stands: a later failure is reported in the answer, never as a lost kill.
    // 2. The watcher's revocation on the checkout (the workers process signs it, not this server).
    try {
      while (!result.revoked && deps.now() - killedAt < REVOKE_WAIT_MS) {
        result.revoked = await deps.revoked(spare.node).catch(() => false);
        if (!result.revoked) await deps.sleep(POLL_MS);
      }
      if (result.revoked) {
        const hash = await deps.revokeTx(spare.node).catch(() => null);
        if (hash) result.txs.push({ chain: 'whitechain', what: 'revoke', hash });
      }
    } catch {
      result.incomplete = 'revoke';
    }

    // 3. The next payment, after the gate's cache: refused, and recorded on Arkiv.
    try {
      const wait = GATE_CACHE_MS - (deps.now() - killedAt);
      if (wait > 0) await deps.sleep(wait);
      result.payment = await deps.pay(spare, product);
    } catch {
      result.incomplete ??= 'payment';
    }
    const p = result.payment;
    if (p && p.outcome === 'refused' && p.http === 402 && p.reason && p.orderId) {
      const until = deps.now() + RECORD_WAIT_MS;
      while (!result.recorded && deps.now() < until) {
        const ref = await deps.recorded(p.orderId, deps.addressOf(spare.n), p.reason).catch(() => null);
        if (ref) result.recorded = { ref };
        else await deps.sleep(POLL_MS * 2);
      }
    }
    result.nextSpare = (await readySpare(deps).catch(() => null))?.name ?? null;
    return result;
  } finally {
    running = false;
  }
}

// The spare a kill would take now, or null (GET: the phones show the button only when there is one).
// Cached for 10 s per instance: every phone polls it.
let spareCache: { at: number; value: Promise<LiveDisposable | null> } | null = null;
export function currentSpare(deps: Pick<KillDeps, 'numbers' | 'findSpare' | 'addressOf' | 'passReady'> = liveKillDeps(), now = Date.now()): Promise<LiveDisposable | null> {
  if (!spareCache || now - spareCache.at > 10_000) {
    const value = readySpare(deps);
    spareCache = { at: now, value };
    value.catch(() => {
      if (spareCache?.value === value) spareCache = null;
    });
  }
  return spareCache.value;
}

async function sepoliaClient() {
  const { client } = await ensPublicClient({ env: process.env });
  return retryingReads(client, { tries: 3, delayMs: 1500 });
}

// The shop's own answer, from its production URL (never VERCEL_URL, which needs a login).
async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`the shop answered ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

// The agent's payment after the kill, signed like any agent payment (Permit2 witness, no gas) after the
// same quote, 402 and payee checks as Re-order; its answer is read by Re-order's rules (outcomeOf).
async function payOnce(spare: LiveDisposable, product: ModelProduct): Promise<PaymentAfterKill> {
  const model = siteModel();
  const shop = model.merchant;
  const account = spareAccount(spare.n);
  const params = new URLSearchParams({ shop: shop.ens, item: product.sku, qty: '1', buyer: model.persona.ens, payer: spare.name, wallet: account.address });
  const quote = await getJson(`${SHOP}/quote?${params}`);
  const terms = quote.terms as Record<string, unknown> | undefined;
  const orderId = String(terms?.orderId ?? '');
  // The key signs only for this order on our own shop route.
  if (!terms || quote.payUrl !== `${SHOP}/orders/${orderId}/pay` || String(terms.wallet ?? '').toLowerCase() !== account.address.toLowerCase() || terms.payer !== spare.name) throw new Error('the shop quoted unexpected terms');
  const headers = { 'content-type': 'application/json', [PASSCODE_HEADER]: process.env.DEMO_PASSCODE ?? '' };
  const body = JSON.stringify(terms);
  const post = (extra: Record<string, string>) => fetch(quote.payUrl as string, { method: 'POST', headers: { ...headers, ...extra }, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(40_000) });
  const first = await post({});
  if (first.status !== 402) return { outcome: 'not-sent', http: first.status, reason: 'SHOP_REFUSED', orderId, transaction: null };
  const required = decodePaymentRequiredHeader(first.headers.get('payment-required') ?? '');
  const accepted = required.accepts?.length === 1 ? required.accepts[0] : undefined;
  const wire = (accepted as unknown as { extra?: { order?: Record<string, unknown> } } | undefined)?.extra?.order;
  if (!accepted || !wire || String(wire.orderId).toLowerCase() !== orderId.toLowerCase() || BigInt(String(wire.amountMicro ?? accepted.amount)) !== BigInt(product.priceMicro)) throw new Error('the 402 order is not the quoted order');
  // The payee is the shop's ENS address (the shop checks it too).
  const payee = await createEnsReader({ client: await sepoliaClient() }).resolvePayee(shop.ens);
  if (!payee.ok || !isAddressEqual(payee.payee, accepted.payTo as Hex)) throw new Error('the payee is not the shop ENS address');
  const w = await whitechain();
  const checkout = checkoutAddress() as Hex;
  const token = config.whitechain.tokens.usdt;
  const network = `eip155:${w.chain.id}`;
  const scheme = graphPayOrderClient({ account, publicClient: w.publicClient, chainId: w.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: spare.name, mandateHash: keccak256(toHex(`graphpay kill check ${orderId}`)) });
  const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(product.priceMicro) }] });
  const signature = new x402HTTPClient(client).encodePaymentSignatureHeader(await client.createPaymentPayload(required));
  // From here a signature exists: an unclear answer is 'unknown', never a refusal.
  let paid: Response;
  try {
    paid = await post(signature);
  } catch {
    return { outcome: 'unknown', http: null, reason: 'SHOP_UNREACHABLE', orderId, transaction: null };
  }
  const answer = (await paid.json().catch(() => null)) as { status?: unknown; transaction?: unknown; orderId?: unknown; error?: unknown; reason?: unknown } | null;
  const o = outcomeOf(paid.status, answer, orderId, product.priceMicro);
  const reason = typeof answer?.reason === 'string' ? answer.reason : (o.reason ?? null);
  if (o.status === 'paid') return { outcome: 'paid', http: paid.status, reason: null, orderId, transaction: o.transaction ?? null };
  if (o.status === 'failed') return { outcome: 'refused', http: paid.status, reason, orderId, transaction: null };
  return { outcome: 'unknown', http: paid.status, reason, orderId, transaction: o.transaction ?? null };
}

// The recorder's `fail` edge for this refusal, by its ref (the facilitator's attemptEdge), read through GraphQL.
async function recordedRef(orderId: string, payer: string, reason: string): Promise<string | null> {
  const ref = attemptEdge({ orderId, payer, reason, payerNode: `0x${'0'.repeat(64)}`, payerName: '', shopName: siteModel().merchant.ens, amountMicro: '0', at: Date.now(), onchain: false, status: 'rejected' }).ref as string;
  const result = await runGraphql({ engine: await arkivEngine(), query: 'query($id: String!) { order(id: $id) { kind ref } }', variables: { id: orderId } });
  const edges = ((result.data as { order?: { kind: string; ref: string }[] } | undefined)?.order ?? []) as { kind: string; ref: string }[];
  return edges.some((e) => e.kind === 'fail' && e.ref === ref) ? ref : null;
}

async function policyOf(node: string) {
  const w = await whitechain();
  return (await w.publicClient.readContract({ address: checkoutAddress() as Hex, abi: checkoutAbi, functionName: 'policies', args: [node as Hex] })) as { epoch: number | bigint; wallet: string; revoked: boolean; dailyCapMicro: bigint; expiry: bigint };
}

export function liveKillDeps(): KillDeps {
  return {
    numbers: () => spareNumbers(),
    findSpare: async (numbers) => liveDisposable(await sepoliaClient(), numbers),
    addressOf: (n) => spareAccount(n).address,
    passReady: async (spare) => {
      const p = await policyOf(spare.node);
      const live = BigInt(p.expiry) === 0n || BigInt(p.expiry) > BigInt(Math.floor(Date.now() / 1000));
      return isAddressEqual(p.wallet as Hex, spare.holder) && Number(p.epoch) === spare.epoch && !p.revoked && BigInt(p.dailyCapMicro) > 0n && live;
    },
    // The owner's queue: a pause or resume on this instance never races the kill for the owner's nonce.
    kill: (name) => inOwnerQueue(async () => (await liveOwnerActions()).kill(name)),
    revoked: async (node) => Boolean((await policyOf(node)).revoked),
    revokeTx: async (node) => {
      const w = await whitechain();
      const head = await w.publicClient.getBlockNumber();
      // The Whitechain RPC answers log ranges of up to 1000 blocks; the revocation is a few blocks old.
      const logs = await w.publicClient.getLogs({ address: checkoutAddress() as Hex, event: getAbiItem({ abi: checkoutAbi, name: 'AgentPolicySet' }), args: { payerNode: node as Hex }, fromBlock: head > 999n ? head - 999n : 0n, toBlock: head });
      const last = (logs as { transactionHash: string; args: { revoked?: boolean } }[]).filter((l) => l.args.revoked).at(-1);
      return last?.transactionHash ?? null;
    },
    pay: (spare, product) => payOnce(spare, product),
    recorded: (orderId, payer, reason) => recordedRef(orderId, payer, reason),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

// A short stable reason for the server log: the kind of failure, never the message (it can carry an RPC URL).
export const killFailureKind = (error: unknown): string => errorNames(error);
