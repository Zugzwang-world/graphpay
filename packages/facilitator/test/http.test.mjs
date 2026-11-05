// The facilitator over HTTP and through @x402/core: x402Client with spend controls signs, our
// handler checks the bearer, the body limit and the rate limit, and x402Facilitator routes to
// the graphpay-order scheme. Also the recorder route and the start-up checks. Offline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { x402Facilitator } from '@x402/core/facilitator';
import { decodePaymentSignatureHeader } from '@x402/core/http';
import { domainSeparator, keccak256, namehash, toHex } from 'viem';
import { tokenDomain } from '@graphpay/contracts';
import { graphPayOrderClient } from '../src/client.mjs';
import { BODY_LIMIT_BYTES, bearerOk, facilitatorHandler } from '../src/http.mjs';
import { attemptEdge, recorderClient, recorderHandler } from '../src/recorder.mjs';
import { StartupError, networkMode, readiness, startupChecks } from '../src/startup.mjs';
import { AGENT_NAME, AGENT_NODE, CHAIN_ID, CHECKOUT, PERMIT2, T0, TOKEN, ZERO32, fakeChain, makeFacilitator, makeOrder, newAccount, requirementFor, signedPayment } from './helpers.mjs';

const NETWORK = `eip155:${CHAIN_ID}`;
const TOKEN_SECRET = 'a-test-bearer-token-of-32-chars!!';
const BASE = 'https://facilitator.example/api/facilitator';

function service({ chain, limits, ready = async () => {} } = {}) {
  const scheme = makeFacilitator({ chain, limits });
  const facilitator = new x402Facilitator().register(NETWORK, scheme);
  const handle = facilitatorHandler({
    facilitator,
    scheme,
    authToken: TOKEN_SECRET,
    ready,
    health: async () => ({ signer: chain.relayerAddress, balanceWei: String(chain.balance) }),
    log: () => {},
    clock: () => T0,
  });
  return { scheme, facilitator, handle };
}

const post = (route, body, { token = TOKEN_SECRET, raw } = {}) =>
  new Request(`${BASE}/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: raw ?? JSON.stringify(body),
  });

test('x402Client with spend controls signs a graphpay-order payment our facilitator settles', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const { handle } = service({ chain });
  const publicClient = { readContract: async ({ functionName }) => (functionName === 'allowance' ? 0n : 0n) };
  const scheme = graphPayOrderClient({ account, publicClient, chainId: CHAIN_ID, token: TOKEN, permit2: PERMIT2, checkout: CHECKOUT, payerName: AGENT_NAME, mandateHash: keccak256(toHex('m')), now: () => T0 });
  const order = makeOrder();
  const paymentRequired = { x402Version: 2, resource: { url: 'https://shop.example/api/shop/orders/1/pay' }, accepts: [requirementFor(order)] };

  // Default spend controls refuse a non-default asset (pitfall 2).
  const strict = new x402Client().register(NETWORK, scheme);
  await assert.rejects(strict.createPaymentPayload(paymentRequired), /spendControls/);
  // The mandate: only this token, at most 6.00 per payment.
  const client = new x402Client().register(NETWORK, scheme).setSpendControls({ allowedAssets: [{ network: NETWORK, asset: TOKEN.address, maxAmountPerPayment: '6000000' }] });
  const tight = new x402Client().register(NETWORK, scheme).setSpendControls({ allowedAssets: [{ network: NETWORK, asset: TOKEN.address, maxAmountPerPayment: '4000000' }] });
  await assert.rejects(tight.createPaymentPayload(paymentRequired));

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const headers = new x402HTTPClient(client).encodePaymentSignatureHeader(paymentPayload);
  const decoded = decodePaymentSignatureHeader(headers['PAYMENT-SIGNATURE']);
  assert.equal(decoded.accepted.scheme, 'graphpay-order');

  const verify = await handle(post('verify', { x402Version: 2, paymentPayload: decoded, paymentRequirements: paymentRequired.accepts[0] }));
  assert.equal(verify.status, 200);
  assert.deepEqual(await verify.json(), { isValid: true, payer: account.address });
  const settle = await handle(post('settle', { x402Version: 2, paymentPayload: decoded, paymentRequirements: paymentRequired.accepts[0] }));
  const body = await settle.json();
  assert.equal(settle.status, 200);
  assert.equal(body.success, true);
  assert.equal(chain.sends, 1);
});

test('the bearer token is required on verify and settle, constant-time, at least 24 characters', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const { handle } = service({ chain });
  const s = await signedPayment(account, makeOrder());
  const body = { paymentPayload: s.paymentPayload, paymentRequirements: s.requirement };
  for (const token of [null, 'wrong-token-but-long-enough-xx', TOKEN_SECRET.slice(0, -1)]) {
    assert.equal((await handle(post('settle', body, { token }))).status, 401);
    assert.equal((await handle(post('verify', body, { token }))).status, 401);
  }
  assert.equal(chain.sends, 0);
  const short = new Request('https://x/verify', { method: 'POST', headers: { authorization: 'Bearer short' } });
  assert.equal(bearerOk(short, 'short'), false, 'a short configured token never matches');
  assert.equal(bearerOk(new Request('https://x/', { headers: { authorization: `bearer ${TOKEN_SECRET}` } }), TOKEN_SECRET), false);
});

test('the 64 KB limit counts the bytes read, and bad JSON is a 400', async () => {
  const { handle } = service({ chain: fakeChain(newAccount()) });
  const big = JSON.stringify({ pad: 'x'.repeat(BODY_LIMIT_BYTES) });
  assert.equal((await handle(post('verify', null, { raw: big }))).status, 413);
  assert.equal((await handle(post('verify', null, { raw: '{not json' }))).status, 400);
  // A lying Content-Length does not help: the stream is what counts.
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < 70; i++) c.enqueue(new TextEncoder().encode('x'.repeat(1024)));
      c.close();
    },
  });
  const req = new Request(`${BASE}/settle`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_SECRET}`, 'content-length': '10' }, body: stream, duplex: 'half' });
  assert.equal((await handle(req)).status, 413);
});

test('an unknown scheme, version or network is refused before the scheme runs', async () => {
  const chain = fakeChain(newAccount());
  const { handle } = service({ chain });
  const s = await signedPayment(newAccount(), makeOrder());
  const exact = { ...s.requirement, scheme: 'exact' };
  const r = await handle(post('verify', { paymentPayload: s.paymentPayload, paymentRequirements: exact }));
  assert.deepEqual(await r.json(), { isValid: false, invalidReason: 'unsupported_scheme' });
  const v1 = await handle(post('settle', { paymentPayload: { ...s.paymentPayload, x402Version: 1 }, paymentRequirements: s.requirement }));
  assert.equal((await v1.json()).errorReason, 'unsupported_scheme');
  const net = await handle(post('settle', { paymentPayload: s.paymentPayload, paymentRequirements: { ...s.requirement, network: 'eip155:1' } }));
  assert.equal((await net.json()).errorReason, 'unsupported_scheme');
  assert.equal((await handle(post('verify', 'just a string'))).status, 200);
  assert.equal(chain.sends, 0);
});

test('rate limits answer 429, a busy queue 503, a failed start-up 503 and retries', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const { handle } = service({ chain, limits: { perPayerPerMinute: 1 } });
  for (const salt of [1, 2]) {
    const s = await signedPayment(account, makeOrder({ salt }));
    const res = await handle(post('settle', { paymentPayload: s.paymentPayload, paymentRequirements: s.requirement }));
    assert.equal(res.status, salt === 1 ? 200 : 429);
  }
  let attempts = 0;
  const flaky = service({
    chain: fakeChain(account),
    ready: readiness(async () => {
      attempts++;
      if (attempts === 1) throw new StartupError('start-up check failed: eth_chainId = 1874 (read error)');
    }),
  });
  const s = await signedPayment(account, makeOrder({ salt: 3 }));
  const first = await flaky.handle(post('verify', { paymentPayload: s.paymentPayload, paymentRequirements: s.requirement }));
  assert.equal(first.status, 503);
  const second = await flaky.handle(post('verify', { paymentPayload: s.paymentPayload, paymentRequirements: s.requirement }));
  assert.equal(second.status, 200);
  assert.equal(attempts, 2);
});

test('health is cached for 5 s, supported is free, other routes are 404, errors are redacted', async () => {
  let clock = T0;
  let reads = 0;
  const chain = fakeChain(newAccount());
  const scheme = makeFacilitator({ chain });
  const facilitator = new x402Facilitator().register(NETWORK, scheme);
  const lines = [];
  const handle = facilitatorHandler({
    facilitator,
    scheme,
    authToken: TOKEN_SECRET,
    ready: async () => {},
    health: async () => (reads++, { signer: chain.relayerAddress }),
    log: (l) => lines.push(l),
    clock: () => clock,
  });
  const get = (route) => handle(new Request(`${BASE}/${route}`));
  const h = await get('health');
  assert.equal(h.status, 200);
  assert.equal(h.headers.get('cache-control'), 'no-store');
  const body = await h.json();
  assert.equal(body.ok, true);
  assert.equal(body.queued, 0);
  await get('health');
  assert.equal(reads, 1);
  clock += 5_000;
  await get('health');
  assert.equal(reads, 2);
  const supported = await (await get('supported')).json();
  assert.deepEqual(supported.kinds.map((k) => [k.x402Version, k.scheme, k.network]), [[2, 'graphpay-order', NETWORK]]);
  assert.equal((await get('settle')).status, 404);
  assert.equal((await handle(new Request(`${BASE}/admin`, { method: 'POST' }))).status, 404);

  // An exception inside the scheme: one line with the error's name, never its message.
  const broken = facilitatorHandler({
    facilitator: { getSupported: () => facilitator.getSupported(), verify: async () => { throw new TypeError('https://rpc.example/SECRETKEY failed'); } },
    scheme,
    authToken: TOKEN_SECRET,
    ready: async () => {},
    health: async () => ({}),
    log: (l) => lines.push(l),
  });
  const s = await signedPayment(newAccount(), makeOrder());
  const res = await broken(post('verify', { paymentPayload: s.paymentPayload, paymentRequirements: s.requirement }));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'internal error' });
  assert.deepEqual(lines, ['facilitator: TypeError']);
});

// ---------------------------------------------------------------- recorder

const entry = (over = {}) => ({
  onchain: false,
  status: 'rejected',
  reason: 'CAP_EXCEEDED',
  orderId: makeOrder().orderId,
  payer: '0x00000000000000000000000000000000000000aA',
  payerName: AGENT_NAME,
  payerNode: AGENT_NODE,
  payerEpoch: 2,
  shopName: 'shop.graphpay.eth',
  amountMicro: '4800000',
  at: T0,
  ...over,
});

test('a refusal becomes one fail edge with a unique ref and the wallet on the record', () => {
  const e = attemptEdge(entry());
  assert.equal(e.kind, 'fail');
  assert.equal(e.ref, `att:${makeOrder().orderId}:0x00000000000000000000000000000000000000aa:CAP_EXCEEDED`);
  assert.deepEqual(e.from, { ens: AGENT_NAME, epoch: 2 });
  assert.deepEqual(e.to, { ens: 'shop.graphpay.eth', epoch: 0 });
  assert.equal(e.amountMicro, 4_800_000n);
  assert.equal(e.ts, T0 / 1000);
  const payload = JSON.parse(Buffer.from(e.payload.slice(2), 'hex').toString('utf8'));
  assert.deepEqual(payload, { onchain: false, status: 'rejected', reason: 'CAP_EXCEEDED', payer: '0x00000000000000000000000000000000000000aa' });
  // Unattributed: written from the wallet's reverse name.
  const u = attemptEdge(entry({ payerName: '', payerNode: ZERO32, payerEpoch: undefined }));
  assert.deepEqual(u.from, { ens: '00000000000000000000000000000000000000aa.addr.reverse', epoch: 0 });
});

test('the recorder route: bearer, 503 until the writer exists, strict schema, 201 on write', async () => {
  const written = [];
  const lines = [];
  const url = 'https://site.example/api/recorder/attempts';
  const call = (handle, body, token = TOKEN_SECRET) =>
    handle(new Request(url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
  const off = recorderHandler({ token: TOKEN_SECRET, write: null, log: () => {} });
  assert.equal((await call(off, entry())).status, 503);
  assert.equal((await call(off, entry(), 'x'.repeat(32))).status, 401);
  const on = recorderHandler({ token: TOKEN_SECRET, write: async (edge) => (written.push(edge), { entityKey: '0x01', txHash: '0x02', recovered: false }), log: (l) => lines.push(l) });
  const ok = await call(on, entry());
  assert.equal(ok.status, 201);
  assert.deepEqual(await ok.json(), { entityKey: '0x01', txHash: '0x02', recovered: false });
  assert.equal(written.length, 1);
  for (const bad of [
    entry({ onchain: true }),
    entry({ reason: 'has spaces' }),
    entry({ extra: 1 }),
    entry({ amountMicro: '-1' }),
    entry({ payerName: 'someone-else.graphpay.eth' }), // the name is not the node
    entry({ payerNode: ZERO32 }), // unattributed, but a name given
  ]) {
    assert.equal((await call(on, bad)).status, 400);
  }
  assert.equal((await on(new Request('https://site.example/api/recorder/requests', { method: 'POST' }))).status, 404);
  const failing = recorderHandler({ token: TOKEN_SECRET, write: async () => { throw new Error('nonce clash at https://rpc/KEY'); }, log: (l) => lines.push(l) });
  assert.equal((await call(failing, entry())).status, 500);
  assert.deepEqual(lines, ['recorder: Error']);
});

test('the recorder client is fire-and-forget and swallows outages', async () => {
  const sent = [];
  const client = recorderClient({ url: 'https://site.example/api/recorder/attempts', token: TOKEN_SECRET, fetchImpl: async (u, init) => (sent.push({ u, init }), new Response(null, { status: 503 })) });
  await client.refused(entry());
  assert.equal(sent.length, 1);
  assert.equal(sent[0].init.headers.authorization, `Bearer ${TOKEN_SECRET}`);
  assert.equal(sent[0].init.redirect, 'error');
  const down = recorderClient({ url: 'https://x/api/recorder/attempts', token: TOKEN_SECRET, fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  await down.refused(entry());
  await recorderClient({ url: '', token: '' }).refused(entry()); // unconfigured: nothing
});

// ---------------------------------------------------------------- start-up

test('networkMode: loopback is a fork; anything else needs ALLOW_REAL_NETWORK=1 and never the stub', () => {
  assert.equal(networkMode({ rpcUrl: 'http://127.0.0.1:8547' }), 'fork');
  assert.equal(networkMode({ rpcUrl: 'http://localhost:8547', ensStub: true }), 'fork');
  assert.throws(() => networkMode({ rpcUrl: 'https://rpc.example' }), StartupError);
  assert.throws(() => networkMode({ rpcUrl: 'https://127.0.0.1.example' }), StartupError, 'exact host match');
  assert.equal(networkMode({ rpcUrl: 'https://rpc.example', allowRealNetwork: '1' }), 'real');
  assert.throws(() => networkMode({ rpcUrl: 'https://rpc.example', allowRealNetwork: '1', ensStub: true }), /stub/);
  assert.throws(() => networkMode({ rpcUrl: 'http://rpc.example', allowRealNetwork: '1', hosted: true }), /https/);
  assert.throws(() => networkMode({ rpcUrl: 'http://127.0.0.1:8547', hosted: true }), /https/);
});

test('startupChecks: chain id, the checkout token, the token domain, the ENS chain; errors name the check only', async () => {
  const good = {
    getChainId: async () => CHAIN_ID,
    readContract: async ({ functionName }) => (functionName === 'USDT' ? TOKEN.address : domainSeparator({ domain: tokenDomain(CHAIN_ID, TOKEN) })),
  };
  const ens = { getChainId: async () => 11155111 };
  await startupChecks({ publicClient: good, chainId: CHAIN_ID, checkout: CHECKOUT, token: TOKEN, ensClient: ens, sepoliaChainId: 11155111 });
  const fail = (client, ensClient = ens) => startupChecks({ publicClient: client, chainId: CHAIN_ID, checkout: CHECKOUT, token: TOKEN, ensClient, sepoliaChainId: 11155111 });
  await assert.rejects(fail({ ...good, getChainId: async () => 1 }), /eth_chainId = 1874$/);
  await assert.rejects(fail({ ...good, readContract: async () => '0x0000000000000000000000000000000000000001' }), /checkout.USDT/);
  const wrongName = { ...TOKEN, eip712: { name: 'USDT', version: '1' } };
  await assert.rejects(fail({ ...good, readContract: async ({ functionName }) => (functionName === 'USDT' ? TOKEN.address : domainSeparator({ domain: tokenDomain(CHAIN_ID, wrongName) })) }), /DOMAIN_SEPARATOR/);
  await assert.rejects(fail(good, { getChainId: async () => 1 }), /ENS RPC/);
  await assert.rejects(fail({ ...good, getChainId: async () => { throw new Error('https://rpc.example/KEY timed out'); } }), (e) => {
    assert.equal(e.message, 'start-up check failed: eth_chainId = 1874 (read error)');
    return true;
  });
});

test('the client refuses a requirement for another token or network', async () => {
  const account = newAccount();
  const client = graphPayOrderClient({ account, publicClient: { readContract: async () => 0n }, chainId: CHAIN_ID, token: TOKEN, permit2: PERMIT2, checkout: CHECKOUT, payerName: AGENT_NAME, mandateHash: keccak256(toHex('m')) });
  const req = requirementFor(makeOrder());
  await assert.rejects(client.createPaymentPayload(2, { ...req, asset: `0x${'1'.repeat(40)}` }), /another token/);
  await assert.rejects(client.createPaymentPayload(2, { ...req, network: 'eip155:1' }), /another network/);
  await assert.rejects(client.createPaymentPayload(2, { ...req, amount: '1' }), /does not match/);
  await assert.rejects(client.createPaymentPayload(2, { ...req, extra: { ...req.extra, contract: `0x${'2'.repeat(40)}` } }), /another contract/);
  assert.throws(() => graphPayOrderClient({ account, publicClient: {}, chainId: CHAIN_ID, token: TOKEN, permit2: PERMIT2, payerName: '', mandateHash: keccak256(toHex('m')) }), /checkout/);
  assert.equal(namehash(AGENT_NAME), AGENT_NODE);
});
