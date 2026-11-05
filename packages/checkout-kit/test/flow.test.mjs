// The whole loop offline: a shop built with createGraphPayShop, the client kit as a person with a
// wallet, a fake chain for the reads and a recording facilitator.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { config } from '@graphpay/config';
import { permit2Domain, permitWitnessTypes } from '@graphpay/contracts';
import { whitechainNetwork } from '@graphpay/agentpay';
import { fakeChain, fakeFacilitator } from './fakes.mjs';
import { CatalogError, MAX_QUANTITY, createGraphPayShop, networkForClient } from '../index.mjs';
import { CheckoutError, HEADERS, PAYER_HEADER, decodeHeader, encodeHeader, getQuote, graphpayCheckout, payQuote } from '../src/client.mjs';

const SHOP = `shop.${config.root.ens}`;
const CATALOG = [{ sku: 'box-12', name: 'box of 12', unit: 'box', unitPriceMicro: 4_800_000 }, { sku: 'box-6', name: 'box of 6', unitPriceMicro: 2_500_000 }];
const BASE = 'https://shop.test/api';

function setup({ passcode, facilitator = fakeFacilitator() } = {}) {
  const chain = fakeChain();
  chain.state.allowance = 0n;
  const merchantAddress = privateKeyToAccount(generatePrivateKey()).address;
  const shop = createGraphPayShop({ shopEns: SHOP, merchant: merchantAddress, catalog: CATALOG, facilitator, publicClient: chain.publicClient, passcode, open: !passcode, log: (l) => process.env.KIT_DEBUG && console.error(l) });
  const route = (request) => (new URL(request.url).pathname.endsWith('/catalog') ? shop.catalog(request) : shop.order(request));
  const fetchImpl = async (url, init) => route(new Request(url, init));
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = { address: account.address, signTypedData: async (...a) => (wallet.signed.push(a[0].primaryType), account.signTypedData(...a)), signed: [] };
  return { chain, shop, fetchImpl, account, wallet, facilitator, network: networkForClient(shop.network), merchantAddress };
}

test('the catalog lists the items with their prices, and refuses a bad catalog', async () => {
  const { shop } = setup();
  const body = await shop.catalog().json();
  assert.deepEqual(body.items.map((i) => [i.sku, i.unitPriceMicro]), [['box-12', '4800000'], ['box-6', '2500000']]);
  assert.equal(body.token, 'USDT');
  const chain = fakeChain();
  const make = (catalog, extra = { open: true }) => () => createGraphPayShop({ shopEns: SHOP, merchant: privateKeyToAccount(generatePrivateKey()).address, catalog, facilitator: fakeFacilitator(), publicClient: chain.publicClient, ...extra });
  assert.throws(make([]), CatalogError);
  assert.throws(make([{ sku: 'A B', name: 'x', unitPriceMicro: 1 }]), /sku/);
  assert.throws(make([CATALOG[0], CATALOG[0]]), /twice/);
  assert.throws(make([{ sku: 'a', name: 'x', unitPriceMicro: 0 }]), /positive/);
  assert.throws(make([{ sku: 'a', name: 'x', unitPriceMicro: 2n ** 60n }]), /uint64/);
  assert.throws(make([{ sku: 'a', name: 'x'.repeat(121), unitPriceMicro: 1 }]), /1 to 120/);
  assert.throws(make(CATALOG, {}), /passcode.*open/, 'a shop that forgot its passcode is not silently open');
  assert.doesNotThrow(make(CATALOG, { passcode: 'p'.repeat(26) }));
});

test('a person pays: quote, one signature, receipt with the explorer link; the facilitator got a signature that recovers to them', async () => {
  const s = setup();
  const result = await graphpayCheckout({ shopUrl: BASE, item: 'box-12', qty: 2, wallet: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl, approve: async (q) => q.amountMicro === 9_600_000n });
  assert.equal(result.status, 'paid');
  assert.equal(result.transaction, `0x${'ab'.repeat(32)}`);
  assert.equal(result.explorer, `${s.network.explorer}/tx/${result.transaction}`);
  assert.deepEqual(s.wallet.signed, ['Permit', 'PermitWitnessTransferFrom'], 'the gasless approval and the order, nothing else');
  const settle = s.facilitator.calls.find((c) => c[0] === 'settle');
  const payload = settle[1].payload;
  assert.equal(payload.payerName, '');
  assert.equal(payload.payer, s.account.address);
  const recovered = await recoverTypedDataAddress({
    domain: permit2Domain(s.network.chainId, s.network.permit2),
    types: permitWitnessTypes,
    primaryType: 'PermitWitnessTransferFrom',
    message: { permitted: { token: payload.permit.token, amount: BigInt(payload.permit.amount) }, spender: s.network.checkout, nonce: BigInt(payload.permit.nonce), deadline: BigInt(payload.permit.deadline), witness: { ...payload.order, amountMicro: BigInt(payload.order.amountMicro), deadline: BigInt(payload.order.deadline), kind: Number(payload.order.kind), mandateHash: payload.mandateHash } },
    signature: payload.signature,
  });
  assert.equal(recovered, s.account.address);
});

test('prices come from the catalog: the amount is price x quantity, whatever the request says', async () => {
  const s = setup();
  const quote = await getQuote({ shopUrl: BASE, item: 'box-6', qty: 3, payer: s.account.address, network: s.network, fetch: s.fetchImpl });
  assert.equal(quote.amountMicro, 7_500_000n);
  assert.equal(quote.requirement.payTo, s.merchantAddress);
  const url = (q) => `${BASE}/order?${q}`;
  const get = async (q) => s.fetchImpl(url(q), { headers: { [PAYER_HEADER]: s.account.address } });
  assert.equal((await get('item=nope&qty=1')).status, 404);
  assert.equal((await get('item=box-6&qty=0')).status, 400);
  assert.equal((await get(`item=box-6&qty=${MAX_QUANTITY + 1}`)).status, 400);
  assert.equal((await get('item=box-6&qty=1&price=1')).status, 402, 'a price in the request is ignored');
  assert.equal(decodeHeader((await get('item=box-6&qty=1&price=1')).headers.get(HEADERS.required)).accepts[0].amount, '2500000');
});

test('a quote that is not what the app expects is refused before anything is signed', async () => {
  const s = setup();
  const tamper = (edit) => async (url, init) => {
    const res = await s.fetchImpl(url, init);
    if (res.status !== 402) return res;
    const pr = decodeHeader(res.headers.get(HEADERS.required));
    edit(pr);
    return new Response(JSON.stringify(pr), { status: 402, headers: { [HEADERS.required]: encodeHeader(pr) } });
  };
  const attempts = {
    'another token': (pr) => (pr.accepts[0].asset = privateKeyToAccount(generatePrivateKey()).address),
    'another network': (pr) => (pr.accepts[0].network = 'eip155:1'),
    'another checkout': (pr) => (pr.accepts[0].extra.contract = privateKeyToAccount(generatePrivateKey()).address),
    'a different payee': (pr) => (pr.accepts[0].payTo = privateKeyToAccount(generatePrivateKey()).address),
    'a different amount': (pr) => (pr.accepts[0].amount = '1'),
    'an agent payer': (pr) => (pr.accepts[0].extra.order.payerNode = `0x${'22'.repeat(32)}`),
    'a renewal id': (pr) => (pr.accepts[0].extra.order.orderId = `0x8${'0'.repeat(63)}`),
    'a far deadline': (pr) => (pr.accepts[0].extra.order.deadline = String(Math.floor(Date.now() / 1000) + 86_400)),
    'two options': (pr) => pr.accepts.push(pr.accepts[0]),
    'another shop name': (pr) => (pr.accepts[0].extra.shopName = `other.${config.root.ens}`),
    'a buyer node': (pr) => (pr.accepts[0].extra.order.buyerNode = `0x${'33'.repeat(32)}`),
    'a parent nobody asked for': (pr) => {
      pr.accepts[0].extra.order.parentOrderId = `0x${'44'.repeat(32)}`;
      pr.accepts[0].extra.order.kind = '1';
    },
    'a malformed asset': (pr) => (pr.accepts[0].asset = 'not an address'),
    'no extra': (pr) => delete pr.accepts[0].extra,
  };
  for (const [name, edit] of Object.entries(attempts)) {
    await assert.rejects(graphpayCheckout({ shopUrl: BASE, item: 'box-12', wallet: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: tamper(edit) }), (e) => e instanceof CheckoutError && e.code === 'QUOTE_REFUSED', name);
  }
  assert.deepEqual(s.wallet.signed, [], 'nothing was signed');
  assert.equal(s.facilitator.calls.length, 0);
  // The app can pin the payee and the largest amount it accepts.
  const other = privateKeyToAccount(generatePrivateKey()).address;
  await assert.rejects(getQuote({ shopUrl: BASE, item: 'box-12', payer: s.account.address, network: s.network, fetch: s.fetchImpl, expect: { payTo: other } }), /payee is not the one/);
  await assert.rejects(getQuote({ shopUrl: BASE, item: 'box-12', qty: 2, payer: s.account.address, network: s.network, fetch: s.fetchImpl, expect: { maxAmountMicro: 5_000_000n } }), /above what this page allows/);
  assert.equal((await getQuote({ shopUrl: BASE, item: 'box-12', payer: s.account.address, network: s.network, fetch: s.fetchImpl, expect: { payTo: s.merchantAddress, maxAmountMicro: 5_000_000n } })).amountMicro, 4_800_000n);
});

test('a person who says no is not signed for', async () => {
  const s = setup();
  const result = await graphpayCheckout({ shopUrl: BASE, item: 'box-12', wallet: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl, approve: async () => false });
  assert.equal(result.status, 'declined');
  assert.deepEqual(s.wallet.signed, []);
});

test('with a passcode set, a payment needs it (the relayer pays gas); a quote does not', async () => {
  const s = setup({ passcode: 'p'.repeat(26) });
  const quote = await getQuote({ shopUrl: BASE, item: 'box-12', payer: s.account.address, network: s.network, fetch: s.fetchImpl });
  const refused = await payQuote({ shopUrl: BASE, quote, account: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl });
  assert.equal(refused.status, 'failed');
  assert.match(refused.reason, /not authorised/);
  assert.equal(s.facilitator.calls.length, 0);
  const paid = await payQuote({ shopUrl: BASE, quote, account: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl, passcode: 'p'.repeat(26) });
  assert.equal(paid.status, 'paid');
});

test('a failed settlement is reported with its reason; an outage is unknown and re-sends the same signature', async () => {
  const failing = setup({ facilitator: fakeFacilitator({ success: false }) });
  const failed = await graphpayCheckout({ shopUrl: BASE, item: 'box-12', wallet: failing.wallet, publicClient: failing.chain.publicClient, network: failing.network, fetch: failing.fetchImpl });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.reason, 'SPEND_CAP');

  const s = setup();
  let down = true;
  const flaky = async (url, init) => (down && init?.headers?.[HEADERS.signature] ? new Response('{}', { status: 502 }) : s.fetchImpl(url, init));
  const quote = await getQuote({ shopUrl: BASE, item: 'box-12', payer: s.account.address, network: s.network, fetch: flaky });
  const first = await payQuote({ shopUrl: BASE, quote, account: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: flaky });
  assert.equal(first.status, 'unknown');
  const signedBefore = s.wallet.signed.length;
  down = false;
  const second = await payQuote({ shopUrl: BASE, quote, account: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: flaky, signed: first.signed });
  assert.equal(second.status, 'paid');
  assert.equal(s.wallet.signed.length, signedBefore, 'the retry signed nothing new');
});

test('a re-order names a paid order of this shop by this payer, and only that', async () => {
  const s = setup();
  const first = await graphpayCheckout({ shopUrl: BASE, item: 'box-12', wallet: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl });
  assert.equal(first.status, 'paid');
  const parent = first.orderId;
  const ZERO = `0x${'0'.repeat(40)}`;
  const record = (payer, merchant, status) => ({ termsHash: parent, buyerNode: parent, shopNode: parent, merchant, amountMicro: 4_800_000n, kind: 0, status, dispute: 0, disputeReason: 0, payer, refundedMicro: 0n });
  s.chain.state.orders.set(parent, record(s.account.address, s.merchantAddress, 2));
  const quote = await getQuote({ shopUrl: BASE, item: 'box-6', qty: 1, parent, payer: s.account.address, network: s.network, fetch: s.fetchImpl });
  assert.equal(quote.order.parentOrderId.toLowerCase(), parent.toLowerCase());
  assert.equal(String(quote.order.kind), '1');
  const other = privateKeyToAccount(generatePrivateKey()).address;
  await assert.rejects(getQuote({ shopUrl: BASE, item: 'box-6', parent, payer: other, network: s.network, fetch: s.fetchImpl }), /not a paid order of this shop by this payer|parent is not/);
  s.chain.state.orders.set(parent, record(s.account.address, ZERO, 2));
  await assert.rejects(getQuote({ shopUrl: BASE, item: 'box-6', parent, payer: s.account.address, network: s.network, fetch: s.fetchImpl }), /not a paid order of this shop by this payer|parent is not/);
});

test('networkForClient is plain JSON the browser can check a quote against', () => {
  const n = networkForClient(whitechainNetwork());
  assert.equal(JSON.parse(JSON.stringify(n)).chainId, config.networks.whitechain.chainId);
  assert.equal(n.token.eip712.name.length > 0, true);
});

test('every order names its payer; a quote for nobody is refused', async () => {
  const s = setup();
  assert.equal((await s.fetchImpl(`${BASE}/order?item=box-12&qty=1`)).status, 400);
});

test('a person approves exactly the order amount for the gasless approval', async () => {
  const s = setup();
  const result = await graphpayCheckout({ shopUrl: BASE, item: 'box-12', qty: 3, wallet: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl });
  assert.equal(result.status, 'paid');
  const payload = s.facilitator.calls.find((c) => c[0] === 'settle')[1].payload;
  const { decodeAbiParameters } = await import('viem');
  const [value] = decodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], payload.approvalPermit);
  assert.equal(value, 14_400_000n, 'the approval is the order amount, not a standing 50 USDT');
});

test('an RPC error while checking a re-order never reaches the browser, and a signer who is not the named payer is refused', async () => {
  const s = setup();
  const parent = `0x${'55'.repeat(32)}`;
  const real = s.chain.publicClient.readContract;
  s.chain.publicClient.readContract = async (args) => {
    if (args.functionName === 'orders') throw new Error('request to https://rpc.example/secret-key failed');
    return real(args);
  };
  const res = await s.fetchImpl(`${BASE}/order?item=box-6&parent=${parent}`, { headers: { [PAYER_HEADER]: s.account.address } });
  assert.equal(res.status, 502);
  assert.ok(!(await res.text()).includes('secret'));
  s.chain.publicClient.readContract = real;

  const ZERO = `0x${'0'.repeat(40)}`;
  s.chain.state.orders.set(parent, { termsHash: parent, buyerNode: parent, shopNode: parent, merchant: s.merchantAddress, amountMicro: 4_800_000n, kind: 0, status: 2, dispute: 0, disputeReason: 0, payer: s.account.address, refundedMicro: 0n });
  const quote = await getQuote({ shopUrl: BASE, item: 'box-6', parent, payer: s.account.address, network: s.network, fetch: s.fetchImpl });
  const thief = privateKeyToAccount(generatePrivateKey());
  const thiefWallet = { address: thief.address, signTypedData: (...a) => thief.signTypedData(...a) };
  const claimsVictim = async (url, init) => s.fetchImpl(url, { ...init, headers: { ...init.headers, [PAYER_HEADER]: s.account.address } });
  const refused = await payQuote({ shopUrl: BASE, quote, account: thiefWallet, publicClient: s.chain.publicClient, network: s.network, fetch: claimsVictim });
  assert.equal(refused.status, 'failed');
  assert.match(refused.reason, /not from the payer/);
  assert.equal(s.facilitator.calls.length, 0);
  assert.ok(ZERO);
});

test('only a real transaction hash becomes an explorer link', async () => {
  const s = setup({ facilitator: { ...fakeFacilitator(), settle: async () => ({ success: true, transaction: 'javascript:alert(1)', network: 'x' }) } });
  const result = await graphpayCheckout({ shopUrl: BASE, item: 'box-12', wallet: s.wallet, publicClient: s.chain.publicClient, network: s.network, fetch: s.fetchImpl });
  assert.equal(result.status, 'paid');
  assert.equal(result.explorer, null);
});
