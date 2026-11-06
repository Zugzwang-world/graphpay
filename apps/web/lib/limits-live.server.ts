// The live side of the limits (lib/limits.server.ts holds the decisions). Over the pass: the hosted
// shop's 402 for the payer agent's attempt, one signature under its pass, and that payment sent to our
// facilitator's verify step only (server to server, with its bearer token): verify never sends, and it
// writes its refusal to Arkiv, which is read back here. The agent's own cap raise: an eth_call of the
// resolver's setText from the agent's address on Ethereum Sepolia, never sent, and its record written
// with the recorder's key. Keys and tokens are read by name, never leave this file and are never
// logged; errors are logged by name only.
import { config } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { KEYS, createEnsGate, createEnsReader, dnsEncode, ensPublicClient, permissionedResolverAbi, walkName } from '@graphpay/ens';
import { decodePaymentRequiredHeader, errorNames, graphPayOrderClient, x402Client } from '@graphpay/facilitator';
import { recordEdge, runGraphql } from '@graphpay/money-graph';
import { BaseError, ContractFunctionRevertedError, erc20Abi, isAddressEqual, keccak256, namehash, toHex, type Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { sharedCustomerState } from './customer-state.server.ts';
import { PASSCODE_HEADER } from './passcode-header.ts';
import { syncConnection, whitechain, type Whitechain } from './payments.server.ts';
import { recorderKeyConfigured } from './refund-request.server.ts';
import { payerKeyName } from './reorder-live.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import { SIGN_MARGIN_MS, overPassPlan, type AttemptOutcome, type OverPassDeps, type OverPassQuote, type Pass, type RaiseCapDeps } from './limits.server.ts';

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
const ZERO32 = `0x${'0'.repeat(64)}`;
const SITE = String(config.site.url).replace(/\/+$/, '');
const SHOP = `${SITE}/api/shop`;
const FACILITATOR = `${SITE}/api/facilitator`;
// The facilitator's own rule for its bearer token (packages/facilitator settings).
const MIN_TOKEN = 24;
// A reason the shop or the facilitator gives (CAP_EXCEEDED, insufficient_balance): a short word, never text.
const SAFE_REASON = /^[A-Za-z][A-Za-z0-9_]{1,39}$/;
// The recorder writes after the facilitator answers; it is looked for this long.
const RECORD_WAIT_MS = 20_000;

export function limitsKeysConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return KEY_SHAPE.test(env[payerKeyName()] ?? '') && recorderKeyConfigured(env) && (env.FACILITATOR_AUTH_TOKEN ?? '').length >= MIN_TOKEN;
  } catch {
    return false;
  }
}

function payerAccount() {
  const key = process.env[payerKeyName()] ?? '';
  if (!KEY_SHAPE.test(key)) throw new Error('the payer key is not set');
  return privateKeyToAccount(key as Hex);
}

// One Whitechain client per instance (its RPC is probed once), forgotten after a failure.
let wc: Promise<Whitechain> | null = null;
const chain = () =>
  (wc ??= whitechain().catch((error: unknown) => {
    wc = null;
    throw error;
  }));

// What is left of an attempt's budget, never less than a second (for a fetch timeout).
const left = (until: number) => Math.max(1_000, until - Date.now());

let gate: Promise<ReturnType<typeof createEnsGate>> | null = null;
const ensGate = () =>
  (gate ??= ensPublicClient()
    .then(({ client }) => createEnsGate({ client }))
    .catch((error: unknown) => {
      gate = null;
      throw error;
    }));

// The owner's published cap on the agent's name (micro-USDT); unreadable is an error, never a guess.
async function ensCapOf(name: string): Promise<bigint> {
  const check = await (await ensGate()).ensCheck(name);
  const value = check.records[KEYS.capMicro] ?? '';
  if (check.status === 'UNKNOWN' || !/^\d{1,19}$/.test(value)) throw new Error('the ENS cap is unreadable');
  return BigInt(value);
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`the shop answered ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

type LiveQuote = OverPassQuote & { terms: Record<string, unknown>; payUrl: string };

export function liveOverPassDeps(): OverPassDeps {
  const model = siteModel();
  const node = namehash(model.payer.ens);
  return {
    pass: async (): Promise<Pass> => {
      // A fresh ENS read: the gate's 20 s cache must not hide a cap the owner just changed.
      (await ensGate()).invalidate(model.payer.ens);
      const w = await chain();
      const checkout = checkoutAddress() as Hex;
      const payerAddress = payerAccount().address;
      const [policy, spent, ensCapMicro, balance] = await Promise.all([
        w.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] }) as Promise<{ dailyCapMicro: bigint }>,
        w.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'spentToday', args: [node] }) as Promise<bigint>,
        ensCapOf(model.payer.ens),
        w.publicClient.readContract({ address: config.whitechain.tokens.usdt.address as Hex, abi: erc20Abi, functionName: 'balanceOf', args: [payerAddress] }),
      ]);
      return { policyCapMicro: BigInt(policy.dailyCapMicro), ensCapMicro, spentMicro: BigInt(spent), balanceMicro: BigInt(balance) };
    },
    quote: async (): Promise<LiveQuote> => {
      const plan = overPassPlan(model);
      const wallet = payerAccount().address;
      const params = new URLSearchParams({ shop: model.merchant.ens, item: plan.sku, qty: String(plan.quantity), buyer: model.persona.ens, payer: model.payer.ens, wallet });
      const body = await getJson(`${SHOP}/quote?${params}`);
      const terms = body.terms as Record<string, unknown> | undefined;
      const orderId = String(terms?.orderId ?? '');
      // The key signs only a one-off order for this shop, buyer, payer and wallet, on our own domain.
      if (!terms || body.payUrl !== `${SHOP}/orders/${orderId}/pay` || String(terms.parentOrderId) !== ZERO32 || terms.shop !== model.merchant.ens || terms.buyer !== model.persona.ens || terms.payer !== model.payer.ens || String(terms.wallet ?? '').toLowerCase() !== wallet.toLowerCase()) {
        throw new Error('the shop quoted unexpected terms');
      }
      return { orderId, priceMicro: String(body.priceMicro), quantity: Number(body.quantity), item: String(terms.item), terms, payUrl: String(body.payUrl) };
    },
    attempt: async (q, until): Promise<AttemptOutcome> => {
      const quote = q as LiveQuote;
      const w = await chain();
      const account = payerAccount();
      const price = BigInt(quote.priceMicro);
      const checkout = checkoutAddress() as Hex;
      const token = config.whitechain.tokens.usdt;
      const network = `eip155:${w.chain.id}`;
      const headers = { 'content-type': 'application/json', [PASSCODE_HEADER]: process.env.DEMO_PASSCODE ?? '' };
      const body = JSON.stringify(quote.terms);
      const post = () => fetch(quote.payUrl, { method: 'POST', headers, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(Math.min(20_000, left(until))) });
      // 1. The shop's 402 for these terms (nothing is signed yet).
      let first: Response;
      try {
        first = await post();
      } catch {
        return { status: 'unknown', reason: 'SHOP_UNREACHABLE' };
      }
      if (first.status !== 402) return { status: 'unknown', reason: 'SHOP_REFUSED' };
      let required: ReturnType<typeof decodePaymentRequiredHeader>;
      let accepted: { payTo: string; amount: string; extra?: { order?: Record<string, unknown> } };
      try {
        required = decodePaymentRequiredHeader(first.headers.get('payment-required') ?? '');
        if (required.accepts?.length !== 1) return { status: 'unknown', reason: 'BAD_402' };
        accepted = required.accepts[0] as typeof accepted;
      } catch (error) {
        console.error('over-pass 402:', errorNames(error));
        return { status: 'unknown', reason: 'BAD_402' };
      }
      // 2. The payee is the shop's ENS address, and the 402's order is the quoted one-off order.
      try {
        const payee = await Promise.race([
          createEnsReader({ client: (await ensPublicClient({ env: process.env })).client }).resolvePayee(model.merchant.ens),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ENS read timed out')), 12_000)),
        ]);
        if (!payee.ok || !isAddressEqual(payee.payee as Hex, accepted.payTo as Hex)) return { status: 'unknown', reason: 'PAYEE_MISMATCH' };
      } catch (error) {
        console.error('over-pass payee:', errorNames(error));
        return { status: 'unknown', reason: 'PAYEE_MISMATCH' };
      }
      const wire = accepted.extra?.order;
      if (!wire || String(wire.orderId).toLowerCase() !== quote.orderId.toLowerCase() || String(wire.parentOrderId) !== ZERO32 || BigInt(String(wire.amountMicro ?? accepted.amount)) !== price || BigInt(String(wire.deadline)) > BigInt(String(quote.terms.exp))) {
        return { status: 'unknown', reason: 'NOT_THE_QUOTE' };
      }
      // 3. One signature under the pass, capped at the quoted amount, and only with time left to verify it.
      if (until - Date.now() < SIGN_MARGIN_MS) return { status: 'unknown', reason: 'NO_TIME', signed: false };
      let paymentPayload: unknown;
      try {
        const scheme = graphPayOrderClient({ account, publicClient: w.publicClient, chainId: w.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: model.payer.ens, mandateHash: keccak256(toHex(`graphpay over-pass ${quote.orderId}`)) });
        const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(price) }] });
        paymentPayload = await client.createPaymentPayload(required);
      } catch (error) {
        console.error('over-pass sign:', errorNames(error));
        return { status: 'unknown', reason: 'NOT_SIGNED' };
      }
      // 4. The signed attempt goes to our facilitator's verify step only: it decides, records a refusal,
      // and never sends. The shop's pay route, which would settle, is never called with the signature.
      let answer: { isValid?: unknown; invalidReason?: unknown } | null;
      try {
        const verified = await fetch(`${FACILITATOR}/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.FACILITATOR_AUTH_TOKEN ?? ''}` },
          body: JSON.stringify({ x402Version: (paymentPayload as { x402Version?: unknown }).x402Version, paymentPayload, paymentRequirements: accepted }),
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(Math.min(30_000, left(until))),
        });
        answer = verified.ok ? ((await verified.json().catch(() => null)) as typeof answer) : null;
      } catch {
        answer = null;
      }
      if (!answer || typeof answer.isValid !== 'boolean') return { status: 'unknown', reason: 'FACILITATOR_UNREACHABLE', signed: true };
      if (answer.isValid) return { status: 'valid', signed: true };
      return { status: 'refused', reason: typeof answer.invalidReason === 'string' && SAFE_REASON.test(answer.invalidReason) ? answer.invalidReason : undefined, signed: true };
    },
    // The facilitator's recorder writes the refusal as a `fail` edge with the order id (ref att:…).
    record: async (orderId, deadline) => {
      const until = Math.min(Date.now() + RECORD_WAIT_MS, deadline);
      for (;;) {
        try {
          const answer = await runGraphql({ engine: await arkivEngine(), query: 'query($id: String!) { order(id: $id) { kind ref } }', variables: { id: orderId } });
          const edges = (answer.data as { order?: { kind: string; ref: string }[] } | undefined)?.order ?? [];
          const fail = edges.find((e) => e.kind === 'fail' && e.ref.startsWith('att:'));
          const keys = (answer.extensions as { arkiv?: { entityKeys?: string[] } } | undefined)?.arkiv?.entityKeys ?? [];
          if (fail) return { ref: fail.ref, entityKey: edges.length === 1 && keys.length === 1 ? keys[0]! : null };
        } catch (error) {
          console.error('over-pass record read:', errorNames(error));
        }
        if (Date.now() + 2_000 > until) return null;
        await new Promise((r) => setTimeout(r, 2_000));
      }
    },
    now: () => Date.now(),
  };
}

// The resolver's own error for a refused write (EACUnauthorizedAccountRoles), by its ABI name only.
export function revertName(error: unknown): string | null {
  if (!(error instanceof BaseError)) return null;
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  const name = reverted?.data?.errorName;
  return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(name) ? name : null;
}

export function liveRaiseCapDeps(): RaiseCapDeps {
  const model = siteModel();
  return {
    ensCap: async () => {
      // A fresh ENS read: an owner change in the last 20 s must not be missed.
      (await ensGate()).invalidate(model.payer.ens);
      return ensCapOf(model.payer.ens);
    },
    simulate: async (capMicro) => {
      const { client } = await ensPublicClient({ env: process.env });
      // The chain id before the agent's key is used at all (CLAUDE.md): Ethereum Sepolia only.
      if ((await client.getChainId()) !== config.networks.sepolia.chainId) throw new Error('the RPC is not on Ethereum Sepolia');
      const walked = await walkName(client, model.payer.ens);
      if (!walked.ok) throw new Error('the agent name does not resolve');
      const block = String(await client.getBlockNumber());
      try {
        await client.simulateContract({ account: payerAccount().address, address: walked.resolver, abi: permissionedResolverAbi as unknown as Abi, functionName: 'setText', args: [dnsEncode(walked.name), KEYS.capMicro, String(capMicro)], blockNumber: BigInt(block) });
        return { reverted: false, resolver: walked.resolver, block };
      } catch (error) {
        const revert = revertName(error);
        if (!revert) throw error;
        return { reverted: true, revert, resolver: walked.resolver, block };
      }
    },
    record: async ({ attemptedMicro, currentMicro, revert, resolver, block, ts }) => {
      const epoch = (await sharedCustomerState()).agent.epoch;
      const node = namehash(model.payer.ens);
      return recordEdge(await syncConnection(), {
        // One record per agent and minute (the route's cooldown is a minute too).
        ref: `cap:${node.slice(2, 18)}:${Math.floor(ts / 60)}`,
        kind: 'request',
        from: { ens: model.payer.ens, epoch },
        to: { ens: model.persona.ens, epoch: 0 },
        // No money moves and nothing is asked of anyone: the figure is in the payload, never the amount.
        amountMicro: 0n,
        ts,
        // A simulation this site ran from the agent's address: anyone can repeat the same eth_call at this block.
        payload: toHex(JSON.stringify({ action: 'raise-own-cap', key: KEYS.capMicro, attemptedMicro: String(attemptedMicro), currentMicro: String(currentMicro), outcome: 'refused', revert, sent: false, simulated: true, triggeredBy: 'site', chainId: config.networks.sepolia.chainId, block, resolver })),
      });
    },
    now: () => Date.now(),
  };
}
