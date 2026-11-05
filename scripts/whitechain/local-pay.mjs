// M3 part B: the facilitator and the shop API run locally, in-process, against Whitechain (the
// real chain, or a loopback anvil fork of it) with the real ENS gate and payee read on Ethereum
// Sepolia (read-only). The facilitator signs as FACILITATOR (before M4 hosts it; afterwards real
// payments go through the hosted facilitator only). Shared by lifecycle.mjs and usdt-ready.mjs.
//
// No stub anywhere: T2's createEnsGate with the checkout's own policies (epoch, cap, spent
// today) and createEnsReader().resolvePayee. Every relayer and merchant transaction is logged to
// the tx log (a fork run logs to a temporary file). Keys stay in-process; nothing is printed but
// addresses, hashes and reasons.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { erc20Abi, formatEther, formatUnits, keccak256, namehash, toHex } from 'viem';
import { config, network, story } from '../../packages/config/index.mjs';
import { checkoutAbi, ORDER_STATUS } from '../../packages/contracts/index.mjs';
import { createEnsGate, createEnsReader, ensPublicClient, retryingReads } from '../../packages/ens/index.mjs';
import {
  HTTPFacilitatorClient,
  checkoutPolicyReads,
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
} from '../../packages/facilitator/index.mjs';
import { PASSCODE_HEADER, shopHandler, storyShops, viemOrders } from '../../packages/shop/index.mjs';
import { configuredCheckout, logTx, sendTx, usdt } from './lib.mjs';


// A Fetch-API handler on a local loopback port.
function serve(handler) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: req.method,
      headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

// ctx: lib.mjs context(). Real network only with ALLOW_REAL_NETWORK=1 (the start-up rule).
export async function localPayment(ctx, { shopKey = story.order.shop } = {}) {
  if (!ctx.fork && process.env.ALLOW_REAL_NETWORK !== '1') throw new Error('the real network needs ALLOW_REAL_NETWORK=1');
  const wc = network('whitechain');
  const pub = ctx.publicClient;
  const chainId = ctx.chain.id;
  const NETWORK = `eip155:${chainId}`;
  const deployed = configuredCheckout();
  if (!deployed) throw new Error('no checkout in whitechain.contracts');
  const checkout = deployed.address;
  const token = usdt();
  const permit2 = config.whitechain.system.permit2;

  const { client: ensBase, rpcLabel: ensRpc } = await ensPublicClient({ env: ctx.env });
  const ensClient = retryingReads(ensBase, { tries: 4, delayMs: 2000 });
  const ensChainId = network(config.ens.network).chainId;
  const checks = readiness(() => startupChecks({ publicClient: pub, chainId: wc.chainId, checkout, token, ensClient, sepoliaChainId: ensChainId }));
  await checks();

  const shops = storyShops();
  const shop = shops.find((s) => s.key === shopKey);
  if (!shop) throw new Error(`no shop ${shopKey} in the story`);
  const merchantRole = shop.walletRole;
  const merchant = ctx.account(merchantRole);
  const relayer = ctx.account('FACILITATOR');
  const reads = checkoutPolicyReads(pub, checkout);
  const gate = createEnsGate({ client: ensClient, expectedEpoch: reads.expectedEpoch, policyCapMicro: reads.policyCapMicro, spentToday: reads.spentToday });
  const ensReader = createEnsReader({ client: ensClient });

  const recorded = []; // refusal records: printed here; the Arkiv recorder route is M4's
  const scheme = createGraphPayFacilitator({
    chainId,
    token,
    permit2,
    checkout,
    allowedMerchants: [merchant.address],
    chain: viemChain({ publicClient: pub, walletClient: ctx.walletClient(relayer), account: relayer, checkout, token, permit2, chain: ctx.chain }),
    ensGate: gate.ensGate,
    recorder: { refused: async (r) => recorded.push(r) },
  });
  const authToken = randomBytes(24).toString('hex'); // this run only, never printed
  const fServer = await serve(
    facilitatorHandler({
      facilitator: new x402Facilitator().register(NETWORK, scheme),
      scheme,
      authToken,
      ready: checks,
      health: async () => ({ signer: relayer.address, balanceWei: String(await pub.getBalance({ address: relayer.address })) }),
    }),
  );

  // markDelivered as the merchant, through sendTx (nonce, pending check, tx log).
  const deliver = async (_key, orderId) => {
    const r = await sendTx(ctx, { role: merchantRole, label: `markDelivered ${orderId.slice(0, 10)}`, request: { address: checkout, abi: checkoutAbi, functionName: 'markDelivered', args: [orderId] } });
    return r.status === 'success' ? 'delivered' : 'pending';
  };
  const passcode = randomBytes(16).toString('hex');
  let sHandler;
  const sServer = await serve((req) => sHandler(req));
  const base = `${sServer.url}/api/shop`;
  const auth = { Authorization: `Bearer ${authToken}` };
  sHandler = shopHandler({
    shops,
    merchants: { [shop.key]: merchant.address },
    chainId,
    token,
    checkout,
    baseUrl: base,
    passcode,
    facilitator: new HTTPFacilitatorClient({ url: `${fServer.url}/api/facilitator`, createAuthHeaders: async () => ({ verify: auth, settle: auth, supported: auth }) }),
    orders: viemOrders({ publicClient: pub, checkout }),
    resolvePayee: ensReader.resolvePayee,
    deliver,
    ready: checks,
  });

  // A payer: x402Client with spend controls (this token only, at most maxMicro per payment).
  const payer = (role, payerName, { maxMicro = BigInt(story.order.budgetMicro), mandate = 'M3 part B' } = {}) => {
    const account = ctx.account(role);
    const s = graphPayOrderClient({ account, publicClient: pub, chainId, token, permit2, checkout, payerName, mandateHash: keccak256(toHex(mandate)) });
    const client = new x402Client().register(NETWORK, s).setSpendControls({ allowedAssets: [{ network: NETWORK, asset: token.address, maxAmountPerPayment: String(maxMicro) }] });
    return { role, name: payerName, address: account.address, client, http: new x402HTTPClient(client) };
  };
  const quote = async (who, { buyer, item = story.order.sku, qty, parent } = {}) => {
    const params = { shop: shop.ensName, buyer, payer: who.name, wallet: who.address, item, qty: String(qty) };
    if (parent) params.parent = parent;
    const res = await fetch(`${base}/quote?${new URLSearchParams(params)}`);
    if (res.status !== 200) throw new Error(`quote answered ${res.status}: ${JSON.stringify(await res.json().catch(() => ({})))}`);
    return res.json();
  };
  const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', [PASSCODE_HEADER]: passcode, ...headers }, body: JSON.stringify(body) });
  // 402 → sign → pay. Returns the HTTP answer, the settlement and the signature (for a replay).
  const pay = async (q, who) => {
    const r402 = await post(q.payUrl, q.terms);
    if (r402.status !== 402) throw new Error(`the 402 step answered ${r402.status}: ${JSON.stringify(await r402.json().catch(() => ({})))}`);
    const pr = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
    if (pr.accepts.length !== 1) throw new Error('expected exactly one accepts entry');
    const payload = await who.client.createPaymentPayload(pr);
    const signature = who.http.encodePaymentSignatureHeader(payload);
    const res = await post(q.payUrl, q.terms, signature);
    const settlement = res.headers.get('payment-response') ? decodePaymentResponseHeader(res.headers.get('payment-response')) : null;
    return { status: res.status, body: await res.json(), settlement, signature, approval: payload.payload.approvalPermit !== '0x' };
  };
  const replay = async (q, signature) => {
    const res = await post(q.payUrl, q.terms, signature);
    return { status: res.status, body: await res.json() };
  };

  // A relayer transaction sent by the pipeline: logged from its receipt.
  const logRelayed = async (label, hash) => {
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
    logTx({ label, role: 'FACILITATOR', from: r.from, hash, status: r.status, block: Number(r.blockNumber), gasUsed: Number(r.gasUsed), feeWbt: formatEther(r.gasUsed * r.effectiveGasPrice), explorer: ctx.explorerTx(hash), network: ctx.fork ? 'fork' : 'whitechain' });
    return r;
  };
  const balances = async (address) => ({
    usdt: await pub.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    wbt: await pub.getBalance({ address }),
  });
  const orderStatus = async (id) => ORDER_STATUS[Number((await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'orders', args: [id] })).status)];
  const relayerNonce = () => pub.getTransactionCount({ address: relayer.address });
  const close = () => {
    fServer.server.close();
    sServer.server.close();
  };

  return {
    ctx,
    shop,
    merchant,
    merchantRole,
    relayer,
    checkout,
    token,
    ensRpc,
    reads,
    gate,
    recorded,
    payer,
    quote,
    pay,
    replay,
    logRelayed,
    balances,
    orderStatus,
    relayerNonce,
    nodeOf: (name) => namehash(name),
    fmt: (micro) => `${formatUnits(BigInt(micro), token.decimals)} ${token.symbol}`,
    close,
  };
}
