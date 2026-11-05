// pnpm pay:public [--yes] [--recorder]
// M4's public check, against the production domain only (config site.url; no redirect followed):
//   health of the shop and the facilitator, the facilitator's signer is our FACILITATOR;
//   C6: the pay step answers 401 without and with a wrong passcode, verify and settle without the
//   bearer, the cron without CRON_SECRET; then, with --yes, the persona pays one piece as a human
//   payer through the hosted shop and facilitator (no payer gas) and the same request again
//   answers alreadyPaid. --recorder also posts one unattributed `fail` edge labelled `test` to
//   the hosted recorder (no cast agent gets a failure). Results: docs/sessions/payments/m4-public.json.

import { writeFileSync } from 'node:fs';
import { keccak256, toHex } from 'viem';
import { castEntries, config, story } from '../../packages/config/index.mjs';
import { PASSCODE_HEADER } from '../../packages/shop/index.mjs';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, graphPayOrderClient, x402Client, x402HTTPClient } from '../../packages/facilitator/index.mjs';
import { configuredCheckout, context, flag, usdt } from './lib.mjs';

const argv = process.argv.slice(2);
const ctx = await context(argv.filter((a) => a !== '--recorder'));
if (ctx.fork) throw new Error('pay:public runs against the production domain only');
const SITE = String(config.site.url).replace(/\/+$/, '');
const url = (path) => `${SITE}${path}`;
const req = (path, init = {}) => fetch(url(path), { redirect: 'error', cache: 'no-store', ...init });
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
}

const relayer = ctx.account('FACILITATOR').address;
const fh = await req('/api/facilitator/health');
const fbody = await fh.json().catch(() => ({}));
check('GET /api/facilitator/health is 200', fh.status === 200, `startup ${fbody.startup}`);
check("the facilitator's signer is our FACILITATOR", typeof fbody.signer === 'string' && fbody.signer.toLowerCase() === relayer.toLowerCase(), fbody.signer);
const sh = await req('/api/shop/health');
check('GET /api/shop/health is 200', sh.status === 200);

// C6: nothing is sent without the passcode or the bearer.
const persona = castEntries().find((e) => e.kind === 'persona');
const human = ctx.account(persona.walletRole);
const shop = castEntries().find((e) => e.kind === 'shop' && e.key === story.order.shop);
const quoteRes = await req(`/api/shop/quote?${new URLSearchParams({ shop: shop.ensName, buyer: persona.ensName, payer: '', wallet: human.address, item: story.order.sku, qty: '1' })}`);
const q = await quoteRes.json();
check('GET /api/shop/quote is 200', quoteRes.status === 200, q.priceMicro ? `${q.priceMicro} micro` : JSON.stringify(q));
const post = (path, body, headers = {}) => req(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const payPath = new URL(q.payUrl).pathname;
check('C6: the pay step without the passcode is 401', (await post(payPath, q.terms)).status === 401);
check('C6: the pay step with a wrong passcode is 401', (await post(payPath, q.terms, { [PASSCODE_HEADER]: 'w'.repeat(32) })).status === 401);
check('C6: /api/facilitator/verify without the bearer is 401', (await post('/api/facilitator/verify', {})).status === 401);
check('C6: /api/facilitator/settle without the bearer is 401', (await post('/api/facilitator/settle', {})).status === 401);
check('/api/cron/renew without CRON_SECRET is 401', (await req('/api/cron/renew')).status === 401);
check('/api/recorder/attempts without the bearer is 401', (await post('/api/recorder/attempts', {})).status === 401);

const out = { site: SITE, at: new Date().toISOString(), checks: results };
if (flag(argv, '--recorder')) {
  const r = await post(
    '/api/recorder/attempts',
    { onchain: false, status: 'rejected', reason: 'TEST', orderId: keccak256(toHex(`m4 recorder test ${out.at}`)), payer: relayer, payerName: '', payerNode: `0x${'0'.repeat(64)}`, shopName: shop.ensName, amountMicro: '0', at: Date.now(), test: true },
    { authorization: `Bearer ${ctx.env.RECORDER_TOKEN}` },
  );
  const body = await r.json().catch(() => ({}));
  check('POST /api/recorder/attempts with the bearer writes one edge', r.status === 201 && /^0x[0-9a-f]{64}$/.test(body.txHash ?? ''), body.txHash ? `https://rabdi.explorer.arkiv.network/tx/${body.txHash}` : JSON.stringify(body));
  out.recorder = { status: r.status, entityKey: body.entityKey, txHash: body.txHash };
}

if (ctx.send && process.exitCode !== 1) {
  const token = usdt();
  const checkout = configuredCheckout().address;
  const network = `eip155:${ctx.chain.id}`;
  const scheme = graphPayOrderClient({ account: human, publicClient: ctx.publicClient, chainId: ctx.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: '', mandateHash: keccak256(toHex('M4 pay:public')) });
  const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(q.priceMicro) }] });
  const passcode = { [PASSCODE_HEADER]: ctx.env.DEMO_PASSCODE };
  const wbtBefore = await ctx.publicClient.getBalance({ address: human.address });
  const r402 = await post(payPath, q.terms, passcode);
  check('the pay step with the passcode is 402', r402.status === 402);
  const payload = await client.createPaymentPayload(decodePaymentRequiredHeader(r402.headers.get('payment-required')));
  const signature = new x402HTTPClient(client).encodePaymentSignatureHeader(payload);
  const paid = await post(payPath, q.terms, { ...passcode, ...signature });
  const body = await paid.json().catch(() => ({}));
  const settlement = paid.headers.get('payment-response') ? decodePaymentResponseHeader(paid.headers.get('payment-response')) : null;
  check('the human payment settles through the public URL', paid.status === 200 && settlement?.success === true, body.transaction ? ctx.explorerTx(body.transaction) : JSON.stringify(body));
  const receipt = body.transaction ? await ctx.publicClient.waitForTransactionReceipt({ hash: body.transaction, timeout: 120_000 }) : null;
  check('sent by our FACILITATOR', receipt ? receipt.from.toLowerCase() === relayer.toLowerCase() : false);
  check('no payer gas', (await ctx.publicClient.getBalance({ address: human.address })) === wbtBefore);
  const again = await post(payPath, q.terms, { ...passcode, ...signature });
  const againBody = await again.json().catch(() => ({}));
  check('the repeat answers alreadyPaid', again.status === 200 && againBody.alreadyPaid === true);
  out.payment = { tx: body.transaction, explorer: body.transaction ? ctx.explorerTx(body.transaction) : null, gasUsed: receipt ? Number(receipt.gasUsed) : null, amountMicro: q.priceMicro, orderId: q.orderId };
}
writeFileSync(new URL('../../docs/sessions/payments/m4-public.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
