// The hosted payment services (planning/PROMPTS/04-hosted-vercel.md, SPEC/PAYMENTS_WHITECHAIN.md
// §8): the facilitator, the shop's 402 API and the recorder, each built once per instance from
// the environment and the config, on the real chain only. A failed build or start-up check
// answers 503 and is retried on the next request; nothing here logs a URL, a key or a message
// that could carry one (viem quotes RPC URLs): only a check's name or an error's name.

import { createPublicClient, createWalletClient, defineChain, http, isAddressEqual, namehash, type Chain, type Hex, type PublicClient, type Transport } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config, network, resolveRpc } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsGate, createEnsReader, ensPublicClient } from '@graphpay/ens';
import { connectArkiv, createQuote, identityKey, recordEdge, type ArkivConnection } from '@graphpay/money-graph';
import {
  HTTPFacilitatorClient,
  StartupError,
  checkoutPolicyReads,
  createGraphPayFacilitator,
  facilitatorHandler,
  facilitatorSettings,
  networkMode,
  readiness,
  recorderClient,
  recorderHandler,
  shopSettings,
  startupChecks,
  viemChain,
  x402Facilitator,
} from '@graphpay/facilitator';
import { merchantActions, shopHandler, storyShops, viemOrders } from '@graphpay/shop';

type Env = Record<string, string | undefined>;
type Handler = (request: Request) => Promise<Response>;

const NO_STORE = { 'cache-control': 'no-store' } as const;
const HOSTED_FLOOR_WEI = 300_000_000_000_000_000n; // 0.3 WBT, the hosted relayer floor (E-1)
const SITE = String(config.site.url).replace(/\/+$/, '');

export const log = (line: string) => console.error(line);
const reason = (e: unknown) => (e instanceof StartupError ? e.message : ((e as Error)?.name ?? 'Error'));
export const jsonNoStore = (status: number, body: unknown) => Response.json(body, { status, headers: NO_STORE });

const keyAddress = (env: Env, role: string): `0x${string}` | null => {
  const key = env[`${role}_PRIVATE_KEY`];
  if (!key) return null;
  try {
    return privateKeyToAccount(key as Hex).address;
  } catch {
    throw new StartupError(`${role}_PRIVATE_KEY is not a valid key`);
  }
};

// The hosted defaults on top of the environment: the routes' own production URLs (never
// VERCEL_URL) and, until the config holds the public role addresses, the merchant lists derived
// from the shops' merchant keys held here (E-3). An explicit env value always wins and is checked
// by the settings against the config.
export function hostedEnv(env: Env = process.env): Env {
  const shops = storyShops();
  const merchants: Record<string, string> = {};
  for (const shop of shops) {
    const address = keyAddress(env, shop.walletRole);
    if (address) merchants[shop.key] = address;
  }
  const out: Env = { ...env };
  out.FACILITATOR_URL ||= `${SITE}/api/facilitator`;
  if (!out.ATTEMPTS_URL && env.RECORDER_TOKEN) out.ATTEMPTS_URL = `${SITE}/api/recorder/attempts`;
  if (!out.SHOP_MERCHANTS && Object.keys(merchants).length) out.SHOP_MERCHANTS = JSON.stringify(merchants);
  if (!out.ALLOWED_MERCHANTS && Object.keys(merchants).length) out.ALLOWED_MERCHANTS = Object.values(merchants).join(',');
  return out;
}

// Whitechain over the secret RPC first, then the public ones; every candidate must answer 1874
// (resolveRpc). Hosted means https, the real network and ALLOW_REAL_NETWORK=1 (networkMode).
export interface Whitechain {
  chain: Chain;
  transport: Transport;
  publicClient: PublicClient;
  label: string;
}

export async function whitechain(env: Env = process.env): Promise<Whitechain> {
  const rpc = await resolveRpc('whitechain', { env, timeoutMs: 5_000 });
  networkMode({ rpcUrl: rpc.url, allowRealNetwork: env.ALLOW_REAL_NETWORK, ensStub: false, hosted: true });
  const wc = network('whitechain');
  const chain = defineChain({ id: wc.chainId, name: wc.name, nativeCurrency: { name: wc.nativeSymbol, symbol: wc.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: [rpc.url] } } });
  const transport = http(rpc.url, { timeout: 20_000, retryCount: 1 });
  return { chain, transport, publicClient: createPublicClient({ chain, transport }) as PublicClient, label: rpc.label };
}

// One build per instance; a failure is forgotten so the next request tries again.
function once<T>(name: string, build: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= build().catch((e: unknown) => {
      pending = null;
      log(`${name}: start-up failed: ${reason(e)}`);
      throw e;
    });
    return pending;
  };
}

// A route over a built handler: 503 while it cannot be built, one redacted line on any error.
export function route(name: string, get: () => Promise<Handler>): Handler {
  return async (request) => {
    let handler: Handler;
    try {
      handler = await get();
    } catch {
      return jsonNoStore(503, { error: 'starting' });
    }
    try {
      const res = await handler(request);
      const headers = new Headers(res.headers);
      headers.set('cache-control', 'no-store');
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      log(`${name}: ${(e as Error)?.name ?? 'Error'}`);
      return jsonNoStore(500, { error: 'internal error' });
    }
  };
}

const ens = once('ens', async () => (await ensPublicClient({ env: process.env })).client);
const wcOnce = once('whitechain', () => whitechain());

// ---------------------------------------------------------------- facilitator

export const facilitator = once('facilitator', async () => {
  const env = hostedEnv();
  const s = facilitatorSettings(env);
  if (s.limits.minRelayerBalanceWei < HOSTED_FLOOR_WEI) throw new StartupError('MIN_RELAYER_BALANCE_WBT is below the hosted 0.3 WBT floor');
  const key = env.FACILITATOR_PRIVATE_KEY;
  if (!key) throw new StartupError('FACILITATOR_PRIVATE_KEY is not set');
  const relayer = privateKeyToAccount(key as Hex);
  const w = await wcOnce();
  const ensClient = await ens();
  const reads = checkoutPolicyReads(w.publicClient, s.checkout);
  const gate = createEnsGate({ client: ensClient, expectedEpoch: reads.expectedEpoch, policyCapMicro: reads.policyCapMicro, spentToday: reads.spentToday, ttlMs: s.limits.gateTtlMs });
  const scheme = createGraphPayFacilitator({
    chainId: s.chainId,
    token: s.token,
    permit2: s.permit2,
    checkout: s.checkout,
    allowedMerchants: s.allowedMerchants,
    chain: viemChain({ publicClient: w.publicClient, walletClient: createWalletClient({ account: relayer, chain: w.chain, transport: w.transport }), account: relayer, checkout: s.checkout, token: s.token, permit2: s.permit2, chain: w.chain }),
    ensGate: gate.ensGate,
    recorder: s.recorder ? recorderClient(s.recorder) : null,
    limits: s.limits,
  });
  const ready = readiness(async () => {
    await startupChecks({ publicClient: w.publicClient, chainId: s.chainId, checkout: s.checkout, token: s.token, ensClient, sepoliaChainId: s.sepoliaChainId });
    // The signer must be a relayer on the checkout, and never its admin.
    const [isRelayer, owner] = await Promise.all([
      w.publicClient.readContract({ address: s.checkout, abi: checkoutAbi, functionName: 'isRelayer', args: [relayer.address] }) as Promise<boolean>,
      w.publicClient.readContract({ address: s.checkout, abi: checkoutAbi, functionName: 'owner' }) as Promise<`0x${string}`>,
    ]);
    if (!isRelayer) throw new StartupError('the facilitator key is not a relayer on the checkout');
    if (isAddressEqual(owner, relayer.address)) throw new StartupError('the facilitator key is the checkout admin');
  });
  return facilitatorHandler({
    facilitator: new x402Facilitator().register(`eip155:${s.chainId}`, scheme),
    scheme,
    authToken: s.authToken,
    ready,
    log,
    health: async () => ({ signer: relayer.address, balanceWei: String(await w.publicClient.getBalance({ address: relayer.address })), rpc: w.label }),
  }) as Handler;
});

// ---------------------------------------------------------------- shop

// Arkiv writers, connected on first use: W_DIRECTORY for quotes, W_SYNC for the recorder.
const arkivFor = (role: 'W_DIRECTORY' | 'W_SYNC') => once(`arkiv ${role}`, (): Promise<ArkivConnection> => connectArkiv({ backend: 'rabdi', env: process.env, role }));
const directory = arkivFor('W_DIRECTORY');
const sync = arkivFor('W_SYNC');

export interface ShopService {
  handle: Handler;
  ready: () => Promise<void>;
}

export const shop = once('shop', async (): Promise<ShopService> => {
  const env = hostedEnv();
  const shops = storyShops();
  const s = shopSettings(env, { shopKeys: shops.map((x) => x.key) });
  const w = await wcOnce();
  const ensClient = await ens();
  const reader = createEnsReader({ client: ensClient });
  const walletClients: Record<string, unknown> = {};
  for (const x of shops) {
    const key = env[`${x.walletRole}_PRIVATE_KEY`];
    if (key) walletClients[x.key] = createWalletClient({ account: privateKeyToAccount(key as Hex), chain: w.chain, transport: w.transport });
  }
  const actions = merchantActions({ publicClient: w.publicClient, walletClients, checkout: s.checkout, chain: w.chain });
  const ready = readiness(() => startupChecks({ publicClient: w.publicClient, chainId: s.chainId, checkout: s.checkout, token: s.token, ensClient, sepoliaChainId: s.sepoliaChainId }));
  const auth = { Authorization: `Bearer ${s.facilitatorToken}` };
  // The quote entity (M7 amendment §5): keyed by the shop's identity at its ENS epoch.
  const quoteWriter = env.W_DIRECTORY_PRIVATE_KEY
    ? async (q: { requestId: Hex; shopName: string; agentEns: string; priceMicro: bigint; validUntil: number }) => {
        const payee = await reader.resolvePayee(q.shopName);
        if (!payee.ok) throw new StartupError('the shop name does not resolve');
        const epoch = Number((payee as { epoch?: number }).epoch ?? 0);
        return createQuote(await directory(), { requestId: q.requestId, shopKey: identityKey(namehash(q.shopName), epoch) as Hex, agentEns: q.agentEns, price: q.priceMicro, validUntil: q.validUntil });
      }
    : undefined;
  const handle = shopHandler({
    shops,
    merchants: s.merchants,
    chainId: s.chainId,
    token: s.token,
    checkout: s.checkout,
    baseUrl: `${SITE}/api/shop`,
    passcode: s.passcode,
    facilitator: new HTTPFacilitatorClient({ url: s.facilitatorUrl, createAuthHeaders: async () => ({ verify: auth, settle: auth, supported: auth }) }),
    orders: viemOrders({ publicClient: w.publicClient, checkout: s.checkout }),
    resolvePayee: reader.resolvePayee,
    createQuote: quoteWriter,
    deliver: actions.deliver,
    ready,
    log,
  });
  return { handle, ready };
});

// ---------------------------------------------------------------- recorder

export const recorder = once('recorder', async () => {
  const token = process.env.RECORDER_TOKEN ?? '';
  if (token.length < 24) throw new StartupError('RECORDER_TOKEN is missing or shorter than 24 characters');
  const write = process.env.W_SYNC_PRIVATE_KEY ? async (edge: Parameters<typeof recordEdge>[1]) => recordEdge(await sync(), edge) : null;
  return recorderHandler({ token, write, log }) as Handler;
});
