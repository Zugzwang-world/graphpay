// M12's payment stack, in process on loopback (before M4 hosts the routes): T1's facilitator
// and shop API (packages/facilitator, packages/shop) against the real deployed checkout, with
//   the ENS gate    T2's createEnsGate with the checkout's policy and spend (gate.mjs)
//   the payee       T2's resolvePayee, read at pay time
//   quotes          the shop writes the errand's quote as W_DIRECTORY (M7 amendment §5)
//   refusals        the recorder writes the off-chain fail edge as W_SYNC (attemptEdge, recordEdge)
//   delivery        markDelivered as the shop's merchant key
// and the agents' side of it: a ShopSurface over HTTP, the x402 codec of @x402/core and the
// signer (graphPayOrderClient through x402Client with spend controls). Keys come from the env
// loader and stay in this process. FACILITATOR is the relayer: never run this while another
// process (T1's scripts, the hosted facilitator) relays with the same key (pitfall 16).

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { config, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsReader } from '@graphpay/ens';
import {
  HTTPFacilitatorClient,
  attemptEdge,
  createGraphPayFacilitator,
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  facilitatorHandler,
  graphPayOrderClient,
  readiness,
  startupChecks,
  viemChain,
  x402Client,
  x402Facilitator,
  x402HTTPClient,
} from '@graphpay/facilitator';
import { createQuote, recordEdge } from '@graphpay/money-graph';
import { PASSCODE_HEADER, merchantActions, shopHandler, storyShops, viemOrders } from '@graphpay/shop';
import { encodePaymentRequiredHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { privateKeyToAccount } from 'viem/accounts';
import { createPayerGate } from './gate.mjs';

const STATUS = ['NONE', 'CREATED', 'PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

// The agents' x402 codec: the real v2 header encodings.
export const x402Codec = {
  decodePaymentRequired: (v) => (v ? decodePaymentRequiredHeader(v) : null),
  encodePaymentRequired: (v) => encodePaymentRequiredHeader(v),
  encodePaymentSignature: (p) => encodePaymentSignatureHeader(p),
  decodePaymentResponse: (v) => (v ? decodePaymentResponseHeader(v) : null),
};

function serve(handler) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const url = `http://127.0.0.1:${server.address().port}${req.url}`;
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

// env: the loaded .env. whitechain, sepolia: checked clients (clientsFor). directory, sync:
// Arkiv connections as W_DIRECTORY and W_SYNC. shopKeyOf(shopEns): the directory's shop key.
export async function startStack({ env, whitechain, sepolia, directory, sync, shopKeyOf, log = () => {} }) {
  if (env.ALLOW_REAL_NETWORK !== '1') throw new Error('stack: the real network needs ALLOW_REAL_NETWORK=1');
  const chainId = whitechain.chain.id;
  const NETWORK = `eip155:${chainId}`;
  const checkout = config.whitechain.contracts.checkout.address;
  const token = config.whitechain.tokens.usdt;
  const permit2 = config.whitechain.system.permit2;
  const pub = whitechain.publicClient;
  const key = (role) => {
    const k = env[`${role}_PRIVATE_KEY`];
    if (!k) throw new Error(`stack: ${role}_PRIVATE_KEY is not in .env`);
    return privateKeyToAccount(k);
  };

  const checks = readiness(() => startupChecks({ publicClient: pub, chainId, checkout, token, ensClient: sepolia.publicClient, sepoliaChainId: sepolia.chain.id }));
  await checks();

  const shops = storyShops();
  const merchants = Object.fromEntries(shops.map((s) => [s.key, key(s.walletRole).address]));
  const walletClients = Object.fromEntries(shops.map((s) => [s.key, whitechain.walletClient(key(s.walletRole))]));
  const merchant = merchantActions({ publicClient: pub, walletClients, checkout, chain: whitechain.chain });
  const relayer = key('FACILITATOR');
  const gate = createPayerGate({ ens: sepolia.publicClient, whitechain: pub });
  const ensReader = createEnsReader({ client: sepolia.publicClient });
  const refusals = [];

  const scheme = createGraphPayFacilitator({
    chainId,
    token,
    permit2,
    checkout,
    allowedMerchants: Object.values(merchants),
    chain: viemChain({ publicClient: pub, walletClient: whitechain.walletClient(relayer), account: relayer, checkout, token, permit2, chain: whitechain.chain }),
    ensGate: gate.ensGate,
    recorder: {
      refused: async (r) => {
        const edge = attemptEdge(r);
        try {
          const w = await recordEdge(sync, edge);
          refusals.push({ ref: edge.ref, reason: r.reason, entityKey: w.entityKey, txHash: w.txHash, at: Date.now() });
          log(`recorder: fail edge ${edge.ref.split(':').at(-1)} written`);
        } catch (e) {
          refusals.push({ ref: edge.ref, reason: r.reason, error: e.name, at: Date.now() });
          log(`recorder: write failed (${e.name})`);
        }
      },
    },
  });
  const authToken = randomBytes(24).toString('hex'); // this run only, never printed
  const auth = { Authorization: `Bearer ${authToken}` };
  const fServer = await serve(facilitatorHandler({ facilitator: new x402Facilitator().register(NETWORK, scheme), scheme, authToken, ready: checks, health: async () => ({ signer: relayer.address }) }));
  const passcode = randomBytes(16).toString('hex');
  let handle;
  const sServer = await serve((req) => handle(req));
  const base = `${sServer.url}/api/shop`;
  handle = shopHandler({
    shops,
    merchants,
    chainId,
    token,
    checkout,
    baseUrl: base,
    passcode,
    facilitator: new HTTPFacilitatorClient({ url: `${fServer.url}/api/facilitator`, createAuthHeaders: async () => ({ verify: auth, settle: auth, supported: auth }) }),
    orders: viemOrders({ publicClient: pub, checkout }),
    resolvePayee: ensReader.resolvePayee,
    createQuote: async ({ requestId, shopName, agentEns, priceMicro, validUntil }) => {
      const q = await createQuote(directory, { requestId, shopKey: await shopKeyOf(shopName), agentEns, price: BigInt(priceMicro), validUntil: BigInt(validUntil) });
      return { entityKey: q.key ?? q.entityKey };
    },
    deliver: (shopKey, orderId) => merchant.deliver(shopKey, orderId),
    ready: checks,
    log,
  });

  const orderStatus = async (orderId) => ({ status: STATUS[Number((await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'orders', args: [orderId] })).status)] });

  // The agents' ShopSurface for one shop: the real shop API over HTTP.
  function surfaceFor(shopEns) {
    const shop = shops.find((s) => s.ensName === shopEns);
    if (!shop) throw new Error(`stack: no shop ${shopEns} in the story`);
    let catalog = null;
    const getCatalog = async () => (catalog ??= await (await fetch(`${base}/catalog?shop=${encodeURIComponent(shopEns)}`)).json());
    return {
      catalog: getCatalog,
      async quote({ item, quantity, buyer, payer, wallet }) {
        const entry = (await getCatalog()).items.find((i) => i.item === item || i.sku === item);
        if (!entry) throw new Error(`${shopEns} does not sell ${item}`);
        const qs = new URLSearchParams({ shop: shopEns, item: entry.sku, qty: String(quantity), buyer, payer, wallet });
        const r = await fetch(`${base}/quote?${qs}`);
        const q = await r.json();
        if (r.status !== 200) throw new Error(`quote answered ${r.status}: ${q.error ?? ''}`);
        return { shop: shopEns, item: entry.item, quantity: q.quantity, priceMicro: q.priceMicro, etaMinutes: q.etaMinutes, validUntil: q.validUntil, orderId: q.orderId, terms: q.terms, payUrl: q.payUrl };
      },
      async pay({ payUrl, terms, requestId, signature }) {
        const headers = { 'content-type': 'application/json', [PASSCODE_HEADER]: passcode, ...(signature ? { 'PAYMENT-SIGNATURE': signature } : {}) };
        const r = await fetch(payUrl, { method: 'POST', headers, body: JSON.stringify({ ...terms, ...(requestId ? { requestId } : {}) }) });
        return { status: r.status, headers: Object.fromEntries(r.headers), body: await r.json().catch(() => null) };
      },
      orderStatus,
    };
  }

  // The agents' sign hook for one paying agent's key: x402Client with spend controls (this
  // token, at most the story's budget per payment), the mandate hash from the human's words.
  function signerFor(walletRole) {
    const account = key(walletRole);
    return async ({ paymentRequired, mandate, payerEns }) => {
      const s = graphPayOrderClient({ account, publicClient: pub, chainId, token, permit2, checkout, payerName: payerEns, mandateHash: mandate.hash });
      const client = new x402Client().register(NETWORK, s).setSpendControls({ allowedAssets: [{ network: NETWORK, asset: token.address, maxAmountPerPayment: String(story.order.budgetMicro) }] });
      const payload = await client.createPaymentPayload(paymentRequired);
      return new x402HTTPClient(client).encodePaymentSignatureHeader(payload);
    };
  }

  return {
    base,
    surfaceFor,
    signerFor,
    gate,
    merchant,
    refusals,
    orderStatus,
    relayer: relayer.address,
    close() {
      fServer.server.close();
      sServer.server.close();
    },
  };
}
