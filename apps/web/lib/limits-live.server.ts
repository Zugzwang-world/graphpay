// The live side of the limits (lib/limits.server.ts holds the decisions). Over the pass: the payer
// agent's x402 attempt through the hosted shop and our facilitator, signed under its pass, which the
// facilitator refuses before any send; the refusal record is read back from Arkiv. The agent's own cap
// raise: an eth_call of the resolver's setText as the agent's key on Ethereum Sepolia, never sent, and
// its record written with the recorder's key. Keys are read by role name, never leave this file and
// are never logged; errors are logged by name only.
import { config } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { KEYS, createEnsGate, createEnsReader, dnsEncode, ensPublicClient, permissionedResolverAbi, walkName } from '@graphpay/ens';
import { decodePaymentRequiredHeader, errorNames, graphPayOrderClient, x402Client, x402HTTPClient } from '@graphpay/facilitator';
import { recordEdge, runGraphql } from '@graphpay/money-graph';
import { BaseError, ContractFunctionRevertedError, isAddressEqual, keccak256, namehash, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { sharedCustomerState } from './customer-state.server.ts';
import { PASSCODE_HEADER } from './passcode-header.ts';
import { syncConnection, whitechain } from './payments.server.ts';
import { recorderKeyConfigured } from './refund-request.server.ts';
import { payerKeyName } from './reorder-live.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import { overPassPlan, type AttemptOutcome, type OverPassDeps, type OverPassQuote, type Pass, type RaiseCapDeps } from './limits.server.ts';

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
const ZERO32 = `0x${'0'.repeat(64)}`;
const SITE = String(config.site.url).replace(/\/+$/, '');
const SHOP = `${SITE}/api/shop`;
// A reason the shop or the facilitator gives (CAP_EXCEEDED, insufficient_balance): a short word, never text.
const SAFE_REASON = /^[A-Za-z][A-Za-z0-9_]{1,39}$/;
// The recorder writes after the facilitator answers; it is looked for this long.
const RECORD_WAIT_MS = 20_000;

export function limitsKeysConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return KEY_SHAPE.test(env[payerKeyName()] ?? '') && recorderKeyConfigured(env);
  } catch {
    return false;
  }
}

function payerAccount() {
  const key = process.env[payerKeyName()] ?? '';
  if (!KEY_SHAPE.test(key)) throw new Error('the payer key is not set');
  return privateKeyToAccount(key as Hex);
}

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
      const w = await whitechain();
      const checkout = checkoutAddress() as Hex;
      const [policy, spent, ensCapMicro] = await Promise.all([
        w.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] }) as Promise<{ dailyCapMicro: bigint }>,
        w.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'spentToday', args: [node] }) as Promise<bigint>,
        ensCapOf(model.payer.ens),
      ]);
      return { policyCapMicro: BigInt(policy.dailyCapMicro), ensCapMicro, spentMicro: BigInt(spent) };
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
    attempt: async (q): Promise<AttemptOutcome> => {
      const quote = q as LiveQuote;
      const w = await whitechain();
      const account = payerAccount();
      const price = BigInt(quote.priceMicro);
      const checkout = checkoutAddress() as Hex;
      const token = config.whitechain.tokens.usdt;
      const network = `eip155:${w.chain.id}`;
      const headers = { 'content-type': 'application/json', [PASSCODE_HEADER]: process.env.DEMO_PASSCODE ?? '' };
      const body = JSON.stringify(quote.terms);
      const post = (extra: Record<string, string>) => fetch(quote.payUrl, { method: 'POST', headers: { ...headers, ...extra }, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60_000) });
      // 1. The shop's 402 for these terms (nothing is signed yet).
      let first: Response;
      try {
        first = await post({});
      } catch {
        return { status: 'failed', reason: 'SHOP_UNREACHABLE' };
      }
      if (first.status !== 402) return { status: 'failed', reason: 'SHOP_REFUSED' };
      let required: ReturnType<typeof decodePaymentRequiredHeader>;
      let accepted: { payTo: string; amount: string; extra?: { order?: Record<string, unknown> } };
      try {
        required = decodePaymentRequiredHeader(first.headers.get('payment-required') ?? '');
        if (required.accepts?.length !== 1) return { status: 'failed', reason: 'BAD_402' };
        accepted = required.accepts[0] as typeof accepted;
      } catch (error) {
        console.error('over-pass 402:', errorNames(error));
        return { status: 'failed', reason: 'BAD_402' };
      }
      // 2. The payee is the shop's ENS address, and the 402's order is the quoted one-off order.
      try {
        const payee = await Promise.race([
          createEnsReader({ client: (await ensPublicClient({ env: process.env })).client }).resolvePayee(model.merchant.ens),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ENS read timed out')), 12_000)),
        ]);
        if (!payee.ok || !isAddressEqual(payee.payee as Hex, accepted.payTo as Hex)) return { status: 'failed', reason: 'PAYEE_MISMATCH' };
      } catch (error) {
        console.error('over-pass payee:', errorNames(error));
        return { status: 'failed', reason: 'PAYEE_MISMATCH' };
      }
      const wire = accepted.extra?.order;
      if (!wire || String(wire.orderId).toLowerCase() !== quote.orderId.toLowerCase() || String(wire.parentOrderId) !== ZERO32 || BigInt(String(wire.amountMicro ?? accepted.amount)) !== price || BigInt(String(wire.deadline)) > BigInt(String(quote.terms.exp))) {
        return { status: 'failed', reason: 'NOT_THE_QUOTE' };
      }
      // 3. One signature under the pass, capped at the quoted amount.
      let signature: Record<string, string>;
      try {
        const scheme = graphPayOrderClient({ account, publicClient: w.publicClient, chainId: w.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: model.payer.ens, mandateHash: keccak256(toHex(`graphpay over-pass ${quote.orderId}`)) });
        const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(price) }] });
        signature = new x402HTTPClient(client).encodePaymentSignatureHeader(await client.createPaymentPayload(required));
      } catch (error) {
        console.error('over-pass sign:', errorNames(error));
        return { status: 'failed', reason: 'NOT_SIGNED' };
      }
      // 4. The signed attempt: our facilitator decides.
      let paid: Response;
      try {
        paid = await post(signature);
      } catch {
        return { status: 'unknown', reason: 'SHOP_UNREACHABLE' };
      }
      const answer = (await paid.json().catch(() => null)) as { status?: unknown; reason?: unknown; transaction?: unknown } | null;
      const transaction = typeof answer?.transaction === 'string' && /^0x[0-9a-fA-F]{64}$/.test(answer.transaction) ? answer.transaction : undefined;
      const reason = typeof answer?.reason === 'string' && SAFE_REASON.test(answer.reason) ? answer.reason : undefined;
      if (paid.status === 402 && answer?.status === 'refused' && !transaction) return { status: 'refused', reason };
      if (paid.status === 200 && answer?.status === 'paid') return { status: 'paid', transaction };
      if (paid.status === 402 && transaction) return { status: 'failed', reason, transaction };
      return { status: 'unknown', reason, transaction };
    },
    // The facilitator's recorder writes the refusal as a `fail` edge with the order id (ref att:…).
    record: async (orderId) => {
      const until = Date.now() + RECORD_WAIT_MS;
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
    ensCap: () => ensCapOf(model.payer.ens),
    simulate: async (capMicro) => {
      const { client } = await ensPublicClient({ env: process.env });
      // The chain id before the agent's key is used at all (CLAUDE.md): Ethereum Sepolia only.
      if ((await client.getChainId()) !== config.networks.sepolia.chainId) throw new Error('the RPC is not on Ethereum Sepolia');
      const walked = await walkName(client, model.payer.ens);
      if (!walked.ok) throw new Error('the agent name does not resolve');
      try {
        await client.simulateContract({ account: payerAccount().address, address: walked.resolver, abi: permissionedResolverAbi, functionName: 'setText', args: [dnsEncode(walked.name), KEYS.capMicro, String(capMicro)] });
        return { reverted: false, resolver: walked.resolver };
      } catch (error) {
        const revert = revertName(error);
        if (!revert) throw error;
        return { reverted: true, revert, resolver: walked.resolver };
      }
    },
    record: async ({ attemptedMicro, currentMicro, revert, resolver, ts }) => {
      const epoch = (await sharedCustomerState()).agent.epoch;
      const node = namehash(model.payer.ens);
      return recordEdge(await syncConnection(), {
        // One record per agent and minute (the route's cooldown is a minute too).
        ref: `cap:${node.slice(2, 18)}:${Math.floor(ts / 60)}`,
        kind: 'request',
        from: { ens: model.payer.ens, epoch },
        to: { ens: model.persona.ens, epoch: 0 },
        amountMicro: attemptedMicro,
        ts,
        payload: toHex(JSON.stringify({ action: 'raise-own-cap', key: KEYS.capMicro, attemptedMicro: String(attemptedMicro), currentMicro: String(currentMicro), outcome: 'refused', revert, sent: false, resolver })),
      });
    },
    now: () => Date.now(),
  };
}
