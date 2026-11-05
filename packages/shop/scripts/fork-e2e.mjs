// The M3 fork end-to-end on a local anvil fork of Whitechain Sepolia, against the real deployed
// checkout, the real test USDT and Permit2: quote → 402 → sign → 200 → replay alreadyPaid → refund →
// re-order, then a forged signature (never sent) and a revoked agent (recorded on-chain).
//
// The facilitator and the shop run as local HTTP servers and talk through @x402/core's
// HTTPFacilitatorClient; the payer signs through x402Client with spend controls. No real key is
// used: every role is a throw-away key, made a relayer and a policy writer by the checkout's owner
// through anvil impersonation, and funded with test USDT moved from FUNDER on the fork only.
// The ENS gate and the payee lookup are stubs, allowed on a loopback fork only.
//
//   anvil --fork-url https://rpc.testnet.whitechain.io --port 8547 --chain-id 1874
//   node scripts/fork-e2e.mjs [--fork http://127.0.0.1:8547]

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createPublicClient, createWalletClient, defineChain, erc20Abi, formatUnits, http, keccak256, namehash, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { x402Facilitator } from '@x402/core/facilitator';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { config, network, story } from '@graphpay/config';
import { checkoutAbi, ORDER_STATUS } from '@graphpay/contracts';
import { createGraphPayFacilitator, facilitatorHandler, graphPayOrderClient, networkMode, readiness, startupChecks, viemChain } from '@graphpay/facilitator';
import { PASSCODE_HEADER, merchantActions, shopHandler, storyShops, viemOrders } from '../index.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const RPC = arg('--fork', 'http://127.0.0.1:8547');
if (networkMode({ rpcUrl: RPC, ensStub: true }) !== 'fork') throw new Error('the fork e2e runs on a loopback anvil only');

const wc = network('whitechain');
const chain = defineChain({ id: wc.chainId, name: `${wc.name} (fork)`, nativeCurrency: { name: wc.nativeSymbol, symbol: wc.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const transport = http(RPC, { timeout: 30_000 });
const pub = createPublicClient({ chain, transport });
const NETWORK = `eip155:${wc.chainId}`;
const checkout = config.whitechain.contracts.checkout.address;
const token = config.whitechain.tokens[config.whitechain.contracts.checkout.token];
const permit2 = config.whitechain.system.permit2;
const usdt = (micro) => `${formatUnits(BigInt(micro), token.decimals)} ${token.symbol}`;

const transcript = [];
function beat(name, detail) {
  transcript.push({ beat: name, ...detail });
  console.log(`- ${name}: ${Object.entries(detail).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
function check(ok, what) {
  if (!ok) throw new Error(`fork e2e: ${what}`);
}

// A Fetch-API handler on a local port.
function serve(handler) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: req.method,
      headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handler.current(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

async function anvil(method, params) {
  return pub.request({ method, params });
}

async function impersonated(address, fn) {
  await anvil('anvil_impersonateAccount', [address]);
  await anvil('anvil_setBalance', [address, toHex(10n ** 18n)]);
  try {
    return await fn(createWalletClient({ account: address, chain, transport }));
  } finally {
    await anvil('anvil_stopImpersonatingAccount', [address]);
  }
}

async function mined(hash) {
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
  check(r.status === 'success', `transaction reverted: ${hash}`);
  return r;
}

const balances = async (address) => ({
  usdt: await pub.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
  wbt: await pub.getBalance({ address }),
});

async function main() {
  check((await pub.getChainId()) === wc.chainId, `the fork is not chain ${wc.chainId}`);
  check(/anvil/i.test(String(await anvil('web3_clientVersion', []).catch(() => ''))), 'the RPC is not a local anvil');
  await startupChecks({ publicClient: pub, chainId: wc.chainId, checkout, token });
  beat('start-up checks', { chain: wc.chainId, checkout: 'USDT() and the token domain match the config' });

  // Throw-away roles; the payer gets no WBT at all (gasless).
  const [relayer, policyWriter, merchant, payer, forger] = Array.from({ length: 5 }, () => privateKeyToAccount(generatePrivateKey()));
  for (const a of [relayer, policyWriter, merchant]) await anvil('anvil_setBalance', [a.address, toHex(10n ** 18n)]);
  const owner = await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'owner' });
  await impersonated(owner, async (w) => {
    await mined(await w.writeContract({ address: checkout, abi: checkoutAbi, functionName: 'setRelayer', args: [relayer.address, true] }));
    await mined(await w.writeContract({ address: checkout, abi: checkoutAbi, functionName: 'setPolicyWriter', args: [policyWriter.address, true] }));
  });
  const agentName = `e2e-agent.${config.root.ens}`;
  const buyerName = `e2e-buyer.${config.root.ens}`;
  const agentNode = namehash(agentName);
  const policyWallet = createWalletClient({ account: policyWriter, chain, transport });
  const setPolicy = async (revoked) =>
    mined(await policyWallet.writeContract({ address: checkout, abi: checkoutAbi, functionName: 'setPolicy', args: [agentNode, 0, payer.address, revoked, BigInt(story.order.budgetMicro), 0n] }));
  await setPolicy(false);
  const spend = BigInt(story.order.priceMicro) + BigInt(story.order.reorder.priceMicro);
  const float = BigInt(story.order.refundMicro);
  const funder = config.wallets.carried.FUNDER;
  check((await balances(funder)).usdt >= spend + float, 'FUNDER holds too little test USDT on the fork');
  await impersonated(funder, async (w) => {
    await mined(await w.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [payer.address, spend] }));
    await mined(await w.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [merchant.address, float] }));
  });
  const merchantWallet = createWalletClient({ account: merchant, chain, transport });
  await mined(await merchantWallet.writeContract({ address: token.address, abi: erc20Abi, functionName: 'approve', args: [checkout, float] }));
  beat('set-up', { roles: 'throw-away relayer, policy writer, merchant and payer', policy: `${agentName} cap ${usdt(story.order.budgetMicro)}`, payer: `${usdt(spend)}, 0 WBT` });

  // The facilitator: the real pipeline on the fork; the ENS gate is a stub (fork only).
  const recorded = [];
  const scheme = createGraphPayFacilitator({
    chainId: wc.chainId,
    token,
    permit2,
    checkout,
    allowedMerchants: [merchant.address],
    chain: viemChain({ publicClient: pub, walletClient: createWalletClient({ account: relayer, chain, transport }), account: relayer, checkout, token, permit2, chain }),
    ensGate: async (name) => ({ ok: true, node: namehash(name), epoch: 0, checks: { epoch: false, tally: false, policyCap: false } }),
    recorder: { refused: async (r) => recorded.push(r) },
  });
  const authToken = randomBytes(24).toString('hex'); // this run only, never printed
  const checks = readiness(() => startupChecks({ publicClient: pub, chainId: wc.chainId, checkout, token }));
  const fHandler = {
    current: facilitatorHandler({
      facilitator: new x402Facilitator().register(NETWORK, scheme),
      scheme,
      authToken,
      ready: checks,
      health: async () => ({ signer: relayer.address, balanceWei: String(await pub.getBalance({ address: relayer.address })) }),
    }),
  };
  const fServer = await serve(fHandler);

  // The shop, through the HTTP facilitator client.
  const shops = storyShops();
  const shop = shops.find((s) => s.key === story.order.shop);
  const passcode = randomBytes(16).toString('hex');
  const sHandler = { current: null };
  const sServer = await serve(sHandler);
  const base = `${sServer.url}/api/shop`;
  const actions = merchantActions({ publicClient: pub, walletClients: { [shop.key]: merchantWallet }, checkout, chain });
  const auth = { Authorization: `Bearer ${authToken}` };
  sHandler.current = shopHandler({
    shops,
    merchants: { [shop.key]: merchant.address },
    chainId: wc.chainId,
    token,
    checkout,
    baseUrl: base,
    passcode,
    facilitator: new HTTPFacilitatorClient({ url: `${fServer.url}/api/facilitator`, createAuthHeaders: async () => ({ verify: auth, settle: auth, supported: auth }) }),
    orders: viemOrders({ publicClient: pub, checkout }),
    resolvePayee: async () => merchant.address, // stub: the fork has no ENS
    createQuote: async () => ({ entityKey: keccak256(toHex('fork quote: not written to Arkiv')) }),
    deliver: actions.deliver,
    ready: checks,
  });

  // The payer agent: x402Client with spend controls (this token only, at most the budget).
  const agent = (account, payerName = agentName) => {
    const s = graphPayOrderClient({ account, publicClient: pub, chainId: wc.chainId, token, permit2, checkout, payerName, mandateHash: keccak256(toHex('fork e2e mandate')) });
    const client = new x402Client().register(NETWORK, s).setSpendControls({ allowedAssets: [{ network: NETWORK, asset: token.address, maxAmountPerPayment: String(story.order.budgetMicro) }] });
    return { client, http: new x402HTTPClient(client) };
  };
  const payerAgent = agent(payer);
  const quote = async (params) => {
    const res = await fetch(`${base}/quote?${new URLSearchParams({ shop: shop.ensName, buyer: buyerName, payer: agentName, wallet: payer.address, ...params })}`);
    check(res.status === 200, `quote answered ${res.status}`);
    return res.json();
  };
  const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', [PASSCODE_HEADER]: passcode, ...headers }, body: JSON.stringify(body) });
  const requestId = keccak256(toHex(`fork e2e ${Date.now()}`));
  const payFlow = async (q, who = payerAgent) => {
    const r402 = await post(q.payUrl, { ...q.terms, requestId });
    check(r402.status === 402, `the 402 step answered ${r402.status}`);
    const pr = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
    check(pr.accepts.length === 1, 'exactly one accepts entry');
    const payload = await who.client.createPaymentPayload(pr);
    const signature = who.http.encodePaymentSignatureHeader(payload);
    const res = await post(q.payUrl, q.terms, signature);
    const settlement = res.headers.get('payment-response') ? decodePaymentResponseHeader(res.headers.get('payment-response')) : null;
    return { res, body: await res.json(), settlement, signature, approval: payload.payload.approvalPermit !== '0x' };
  };
  const orderStatus = async (id) => ORDER_STATUS[Number((await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'orders', args: [id] })).status)];
  const gasOf = async (hash) => (await pub.getTransactionReceipt({ hash })).gasUsed;

  // 1. quote → 402 → sign → 200.
  const before = { payer: await balances(payer.address), merchant: await balances(merchant.address) };
  const q = await quote({ item: story.order.sku, qty: String(story.order.quantity) });
  check(q.priceMicro === String(story.order.priceMicro), 'the quote is the catalog price');
  const first = await payFlow(q);
  check(first.res.status === 200 && first.body.status === 'paid' && first.settlement?.success === true, `pay answered ${first.res.status} ${JSON.stringify(first.body)}`);
  const afterPay = { payer: await balances(payer.address), merchant: await balances(merchant.address) };
  check(before.payer.usdt - afterPay.payer.usdt === BigInt(story.order.priceMicro), 'the payer paid exactly the price');
  check(afterPay.merchant.usdt - before.merchant.usdt === BigInt(story.order.priceMicro), 'the merchant received it');
  check(afterPay.payer.wbt === before.payer.wbt, "the payer's WBT is unchanged (gasless)");
  beat('pay', { http: 200, amount: usdt(story.order.priceMicro), approval: first.approval ? 'EIP-2612 in the same transaction' : 'none needed', gas: await gasOf(first.body.transaction), delivery: first.body.delivery, status: await orderStatus(q.orderId), tx: first.body.transaction });

  // 2. The same signed payment again: alreadyPaid, no money moves.
  const nonce = await pub.getTransactionCount({ address: relayer.address });
  const replay = await post(q.payUrl, q.terms, first.signature);
  const replayBody = await replay.json();
  check(replay.status === 200 && replayBody.alreadyPaid === true, 'the replay is alreadyPaid');
  check((await pub.getTransactionCount({ address: relayer.address })) === nonce, 'the replay sent nothing');
  check((await balances(payer.address)).usdt === afterPay.payer.usdt, 'the replay moved no money');
  beat('replay', { http: 200, alreadyPaid: true, sent: 'nothing' });

  // 3. Refund from the merchant's float.
  const refund = await actions.refund(shop.key, q.orderId, story.order.refundMicro, 1);
  check(refund.status === 'success', 'the refund landed');
  check((await balances(payer.address)).usdt - afterPay.payer.usdt === BigInt(story.order.refundMicro), 'the payer got the refund');
  beat('refund', { amount: usdt(story.order.refundMicro), gas: refund.gasUsed, status: await orderStatus(q.orderId), tx: refund.hash });

  // 4. Re-order at the parent's path.
  const rq = await quote({ item: story.order.sku, qty: String(story.order.reorder.quantity), parent: q.orderId });
  check(rq.priceMicro === String(story.order.reorder.priceMicro), 'the re-order is the catalog price');
  const re = await payFlow(rq);
  check(re.res.status === 200 && re.settlement?.success === true, `re-order answered ${re.res.status} ${JSON.stringify(re.body)}`);
  beat('re-order', { http: 200, amount: usdt(story.order.reorder.priceMicro), approval: re.approval ? 'again' : 'none needed (allowance left)', gas: await gasOf(re.body.transaction), status: await orderStatus(rq.orderId), tx: re.body.transaction });

  // 5. A forged signature: someone else signs for the payer's wallet. Never sent.
  const fq = await quote({ item: story.order.sku, qty: '1' });
  const r402 = await post(fq.payUrl, fq.terms);
  const forged = await agent(forger).client.createPaymentPayload(decodePaymentRequiredHeader(r402.headers.get('payment-required')));
  forged.payload.payer = payer.address;
  const fNonce = await pub.getTransactionCount({ address: relayer.address });
  const fr = await post(fq.payUrl, fq.terms, payerAgent.http.encodePaymentSignatureHeader(forged));
  const fs = decodePaymentResponseHeader(fr.headers.get('payment-response'));
  check(fr.status === 402 && fs.errorReason === 'bad_signature' && fs.transaction === '', 'the forgery is refused');
  check((await pub.getTransactionCount({ address: relayer.address })) === fNonce, 'the forgery sent nothing');
  beat('forged signature', { http: 402, reason: fs.errorReason, sent: 'nothing' });

  // 6. A revoked agent: predicted, sent on purpose within the daily quota, recorded on-chain.
  await setPolicy(true);
  const vq = await quote({ item: story.order.sku, qty: '1' });
  const beforeRevoked = await balances(payer.address);
  const revoked = await payFlow(vq);
  check(revoked.res.status === 402 && revoked.settlement?.errorReason === 'AGENT_REVOKED' && /^0x[0-9a-f]{64}$/.test(revoked.settlement.transaction), `revoked answered ${revoked.res.status} ${JSON.stringify(revoked.body)}`);
  check((await balances(payer.address)).usdt === beforeRevoked.usdt, 'the revoked agent moved no money');
  beat('revoked agent', { http: 402, reason: 'AGENT_REVOKED (PaymentFailed on-chain)', gas: await gasOf(revoked.settlement.transaction), tx: revoked.settlement.transaction });

  const end = await balances(payer.address);
  check(end.wbt === before.payer.wbt, "the payer's WBT never moved");
  beat('totals', { payerPaid: usdt(before.payer.usdt - end.usdt), payerWbt: 'unchanged', refusalRecords: recorded.map((r) => r.reason).join(' ') || 'none' });
  fServer.server.close();
  sServer.server.close();
  return transcript;
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`fork e2e failed: ${e?.message?.split('\n')[0] ?? e}`);
    process.exit(1);
  },
);
