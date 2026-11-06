// pnpm e2e:hosted [--yes] [--refund] (M13's C and F rows on the hosted endpoints)
// Everything goes through the production domain (config site.url, no redirect followed): the
// hosted shop writes the quote and delivers, the hosted facilitator relays as FACILITATOR, the
// hosted recorder writes refusals. Nothing here sends with a relayer key.
//   no flag    health, C6 and F2 (public access, ADR-0069: every server-to-server route answers
//              401 without and with a wrong key; the visitor routes are open; nothing is sent)
//   --yes      also, as the acceptance payer (its story wallet role) on a fresh UTC day:
//              C2 pay 4.80 (402 → payer-side gate and ENS payee read → sign → 200), C5 the same
//              request again, C3's re-order (the story's order.reorder: its own sku when it has
//              one, else the order's item), C4(b) one more order, over the acceptance cap
//   --refund   also C3's refund(order, 0.80), the one local send, as SHOP_KESAR (the hosted
//              merchant refund route is not live yet); only after the hosted delivery's receipt
// C3's renewal is the hosted cron's (T1's evidence); C4(a) and F3 are not run here.
// Writes docs/sessions/integration/hosted/<UTC date>.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castEntries, config, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsReader } from '@graphpay/ens';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, graphPayOrderClient, x402Client, x402HTTPClient } from '@graphpay/facilitator';
import { connectArkiv, ENTITIES, nodeOf, writerAddresses } from '@graphpay/money-graph';
import { readAll } from '@graphpay_ethglobal/arkiv-graph';
import { PASSCODE_HEADER, merchantActions } from '@graphpay/shop';
import { decodeEventLog, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../scripts/lib/redact.mjs';
import { roleAddresses } from '../scripts/lib/wallets.mjs';
import { balances, mirrorSync } from './src/evidence.mjs';
import { createPayerGate } from './src/gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = { ...Object.fromEntries(values), ...process.env };
const redact = redactor(values);
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${redact(l)}\n`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
const argv = process.argv.slice(2);
const send = argv.includes('--yes');
const refundToo = argv.includes('--refund');
if (send && env.ALLOW_REAL_NETWORK !== '1') throw new Error('e2e:hosted --yes needs ALLOW_REAL_NETWORK=1');

const SITE = String(config.site.url).replace(/\/+$/, '');
const req = (path, init = {}) => fetch(`${SITE}${path}`, { redirect: 'error', cache: 'no-store', ...init });
const post = (path, body, headers = {}) => req(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const WRONG = 'w'.repeat(32);
const within = (v, lo, hi) => v >= Math.floor(lo * 0.85) && v <= Math.ceil(hi * 1.15);

const entries = castEntries();
const payer = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'acceptance');
const persona = entries.find((e) => e.kind === 'persona');
const shop = entries.find((e) => e.kind === 'shop' && e.key === story.order.shop);
const whitechain = await clientsFor('whitechain', env);
const sepolia = await clientsFor('sepolia', env);
const pub = whitechain.publicClient;
const checkout = config.whitechain.contracts.checkout.address;
const token = config.whitechain.tokens.usdt;
const out = { site: SITE, startedAt: new Date().toISOString(), payer: payer.ensName, shop: shop.ensName, mode: send ? (refundToo ? 'pay+refund' : 'pay') : 'read-only', rows: {} };

// Health, and the hosted relayer is our FACILITATOR (its address from the health route).
const fh = await (await req('/api/facilitator/health')).json().catch(() => ({}));
const relayer = fh.signer;
out.health = { facilitator: { startup: fh.startup ?? null, signer: relayer ?? null }, shop: (await req('/api/shop/health')).status };
say(`facilitator signer ${relayer}, shop health ${out.health.shop}`);
const nonce = () => pub.getTransactionCount({ address: relayer, blockTag: 'latest' });
const isRelayer = relayer ? await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'isRelayer', args: [relayer] }) : false;
const healthy = out.health.shop === 200 && fh.startup === 'ok' && isRelayer;
out.health.signerIsRelayer = isRelayer;

// C6 and F2 with public access (ADR-0069): visitors meet no passcode, but every key between our
// own servers stays. The server-to-server routes (the shop's pay step, the facilitator, the
// recorder, the cron) answer the app's own 401 without and with a wrong key, and send nothing.
const quote = async (qs) => {
  const r = await req(`/api/shop/quote?${new URLSearchParams(qs)}`);
  const body = await r.json();
  if (r.status !== 200) throw new Error(`quote answered ${r.status}: ${body.error ?? ''}`);
  return body;
};
const addresses = roleAddresses(values);
const wallet = send ? privateKeyToAccount(env[`${payer.walletRole}_PRIVATE_KEY`]) : { address: addresses[payer.walletRole] };
const merchantNonce = () => pub.getTransactionCount({ address: addresses[shop.walletRole], blockTag: 'latest' });
const q0 = await quote({ shop: shop.ensName, item: story.order.sku, qty: String(story.order.quantity), buyer: persona.ensName, payer: payer.ensName, wallet: wallet.address });
const payPath = new URL(q0.payUrl).pathname;
const reorderPath = payPath.replace(/\/pay$/, '/reorder');
const nonce0 = await nonce();
const mNonce0 = await merchantNonce();
const routes = [
  { path: payPath, gate: 'passcode', body: q0.terms, signs: 'FACILITATOR (and W_DIRECTORY writes the quote on the 402 step)' },
  { path: reorderPath, gate: 'passcode', body: q0.terms, signs: 'FACILITATOR' },
  { path: '/api/facilitator/verify', gate: 'bearer', signs: 'FACILITATOR (verify reads only)' },
  { path: '/api/facilitator/settle', gate: 'bearer', signs: 'FACILITATOR' },
  { path: '/api/recorder/attempts', gate: 'bearer', signs: 'W_SYNC' },
  { path: '/api/cron/renew', gate: 'bearer', method: 'GET', signs: 'RENEWER' },
  // The visitor routes are public by design (ADR-0069, config site.publicAccess): not probed
  // here, because a real call would act; see the public check below.
];
const table = [];
for (const r of routes) {
  const call = (headers) => (r.method === 'GET' ? req(r.path, { headers }) : post(r.path, r.body ?? {}, headers));
  // A 401 counts only as the app's own JSON refusal (not a platform login page).
  const status = async (res) => (res.status === 401 && typeof (await res.json().catch(() => null))?.error === 'string' ? 401 : `${res.status} (not the app's refusal)`);
  const without = await status(await call({}));
  const wrong = await status(await call(r.gate === 'bearer' ? { authorization: `Bearer ${WRONG}` } : { [PASSCODE_HEADER]: WRONG }));
  table.push({ route: `${r.method ?? 'POST'} ${r.path.replace(/0x[0-9a-f]{64}/i, ':id')}`, gate: r.gate, signs: r.signs, without, wrong });
}
// The visitor routes are open while the config says so, and the run route takes a visitor
// without a passcode: an empty request is refused as a bad request (400), never as 401, and
// starts nothing. No other visitor route is called (a real call would act).
const publicAccess = config.site.publicAccess === true;
const runProbe = await post('/api/agents/run', { request: '' });
const visitor = { publicAccess, runWithoutPasscode: runProbe.status, runBody: await runProbe.json().catch(() => null) };
const nonce1 = await nonce();
const mNonce1 = await merchantNonce();
const all401 = table.every((t) => t.without === 401 && t.wrong === 401);
// Nothing sent: the hosted relayer's and the shop's merchant nonces (RENEWER is the cron's own).
out.rows.F2 = { pass: healthy && all401 && publicAccess && runProbe.status === 400 && nonce1 === nonce0 && mNonce1 === mNonce0, mode: 'public access (ADR-0069): visitor routes open; server-to-server keys stay', table, visitor, relayerNonce: { before: nonce0, after: nonce1 }, merchantNonce: { role: shop.walletRole, before: mNonce0, after: mNonce1 } };
say(`visitor routes: public access ${publicAccess}; /api/agents/run without a passcode and an empty request answered ${runProbe.status}`);
const c6 = table.filter((t) => /orders\/:id\/pay|facilitator\/(settle|verify)/.test(t.route));
out.rows.C6 = { pass: healthy && c6.length === 3 && c6.every((t) => t.without === 401 && t.wrong === 401) && nonce1 === nonce0, table: c6, relayerNonce: { before: nonce0, after: nonce1 } };
for (const t of table) say(`${t.without === 401 && t.wrong === 401 ? 'ok  ' : 'FAIL'} ${t.route} (${t.gate}): ${t.without}, ${t.wrong}`);

// The paying rows need a fresh UTC day for the acceptance payer (4.80 + 1.20 = its 6.00).
const payerNode = nodeOf(payer.ensName);
const spent0 = BigInt(await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'spentToday', args: [payerNode] }));
const plan = { C2: story.order.priceMicro, C3: story.order.reorder.priceMicro, C4b: 'refused, sends nothing', refund: refundToo ? `${story.order.refundMicro} from ${shop.walletRole}` : 'not in this run' };
out.plan = { spentTodayMicro: spent0, spends: plan, gas: 'none from the payer; the hosted relayer pays' };
say(`acceptance payer spent today ${spent0} micro; plan ${JSON.stringify(plan)}`);

function events(receipt) {
  const evs = [];
  for (const l of receipt.logs) {
    if (l.address.toLowerCase() !== checkout.toLowerCase()) continue;
    try {
      evs.push(decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics }));
    } catch {}
  }
  return evs;
}
const signer = (mandate, max) => {
  const scheme = graphPayOrderClient({ account: wallet, publicClient: pub, chainId: whitechain.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: payer.ensName, mandateHash: keccak256(toHex(mandate)) });
  const network = `eip155:${whitechain.chain.id}`;
  return new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(max) }] });
};
const passcode = { [PASSCODE_HEADER]: env.DEMO_PASSCODE };

// One payment through the hosted shop: 402 (the quote written) → sign → 200.
async function payOnce(q, path, { mandate, max, payee, gated = true }) {
  const r402 = await post(path, { ...q.terms, requestId: keccak256(toHex(`M13 request ${q.orderId}`)) }, passcode);
  if (r402.status !== 402) return { stage: '402', status: r402.status, body: await r402.json().catch(() => null) };
  const required = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
  const quoteKey = required.accepts?.[0]?.extra?.quoteKey ?? null;
  const accepted = required.accepts?.[0];
  if (!payee?.ok || !accepted?.payTo || accepted.payTo.toLowerCase() !== payee.payee.toLowerCase()) return { stage: 'payee', payTo: accepted?.payTo ?? null };
  let gate = null;
  if (gated) {
    gate = await createPayerGate({ ens: sepolia.publicClient, whitechain: pub }).ensGate(payer.ensName, BigInt(accepted.amount));
    if (!gate.ok) return { stage: 'gate', gate };
  }
  const client = signer(mandate, max);
  const signature = new x402HTTPClient(client).encodePaymentSignatureHeader(await client.createPaymentPayload(required));
  const paid = await post(path, q.terms, { ...passcode, ...signature });
  const body = await paid.json().catch(() => null);
  const pr = paid.headers.get('payment-response');
  return { status: paid.status, body, settlement: pr ? decodePaymentResponseHeader(pr) : null, quoteKey, gate: gate ? { ok: gate.ok } : null, signature, terms: q.terms };
}

// Every outcome is written, a thrown step included.
const dir = join(here, '..', 'docs', 'sessions', 'integration', 'hosted');
const file = join(dir, `${send ? 'paid' : 'read'}-${out.startedAt.replace(/[:.]/g, '-')}.json`);
let keep = !send;
process.on('exit', () => {
  if (!keep) return;
  out.endedAt = new Date().toISOString();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${redact(json(out))}\n`);
  say(`written ${file.slice(join(here, '..').length + 1)}`);
});

if (send) {
  if (spent0 !== 0n) throw new Error(`the acceptance payer has spent ${spent0} micro today; run after the UTC day changes (05:30 IST)`);
  const toMidnight = 86_400 - (Math.floor(Date.now() / 1000) % 86_400);
  if (toMidnight < 15 * 60) throw new Error('within 15 minutes of the UTC day change; run after it');
  keep = true;
  if (!env.DEMO_PASSCODE) throw new Error('DEMO_PASSCODE is not in .env');
  const who = { payer: wallet.address };
  const payee = await createEnsReader({ client: sepolia.publicClient }).resolvePayee(shop.ensName);
  say(`ENS payee of ${shop.ensName}: ${payee.ok ? payee.payee : payee.reason}`);

  // C2: 4.80, no payer gas.
  const wbt0 = await pub.getBalance({ address: wallet.address });
  const usdt0 = (await balances(pub, who)).payer;
  const c2 = await payOnce(q0, payPath, { mandate: `M13 C2 ${out.startedAt}`, max: story.order.priceMicro, payee });
  if (c2.status !== 200) {
    out.rows.C2 = { pass: false, response: { stage: c2.stage, status: c2.status, body: c2.body, gate: c2.gate, payTo: c2.payTo } };
    throw new Error(`C2 answered ${c2.status ?? c2.stage}`);
  }
  const tx2 = c2.body.transaction;
  const rc2 = await pub.waitForTransactionReceipt({ hash: tx2, timeout: 120_000 });
  const wbt1 = await pub.getBalance({ address: wallet.address });
  const settled2 = events(rc2).find((e) => e.eventName === 'PaymentSettled');
  const gas2 = Number(rc2.gasUsed);
  out.rows.C2 = {
    pass: rc2.status === 'success' && wbt1 === wbt0 && settled2?.args.amountMicro === BigInt(story.order.priceMicro) && settled2?.args.orderId.toLowerCase() === q0.orderId.toLowerCase() && isRelayer && rc2.from.toLowerCase() === relayer.toLowerCase() && (within(gas2, 312_024, 312_024) || within(gas2, 234_292, 252_082)),
    tx: tx2, explorer: whitechain.explorerTx(tx2), gasUsed: gas2, wbt: { before: wbt0, after: wbt1 }, from: rc2.from, relayer,
    settled: settled2 ? { amountMicro: settled2.args.amountMicro, orderId: settled2.args.orderId } : null,
    delivery: c2.body.delivery, quoteKey: c2.quoteKey, payeeRead: payee.ok ? { payee: payee.payee, node: payee.node, epoch: payee.epoch } : payee, payerGate: c2.gate,
  };
  say(`C2 ${out.rows.C2.pass ? 'pass' : 'FAIL'}: ${out.rows.C2.explorer} gas ${gas2}, payer WBT unchanged ${wbt1 === wbt0}, delivery ${c2.body.delivery}`);

  // C5: the same request with the same PAYMENT-SIGNATURE.
  const n5 = await nonce();
  const usdt5 = (await balances(pub, who)).payer;
  const again = await post(payPath, c2.terms, { ...passcode, ...c2.signature });
  const againBody = await again.json().catch(() => null);
  await new Promise((ok) => setTimeout(ok, 4_000));
  const n5b = await nonce();
  const usdt5b = (await balances(pub, who)).payer;
  out.rows.C5 = { pass: again.status === 200 && againBody?.alreadyPaid === true && n5b === n5 && usdt5b === usdt5, status: again.status, body: againBody, relayerNonce: { before: n5, after: n5b }, payerUsdt: { before: usdt5, after: usdt5b } };
  say(`C5 ${out.rows.C5.pass ? 'pass' : 'FAIL'}: ${again.status} alreadyPaid ${againBody?.alreadyPaid}, nonce ${n5} → ${n5b}`);

  // C3: the refund (local, SHOP_KESAR, only with --refund and after the delivery's receipt).
  const c3 = {};
  out.rows.C3 = c3;
  let delivered = false;
  for (let i = 0; refundToo && i < 30 && !delivered; i += 1) {
    delivered = Number((await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'orders', args: [q0.orderId] })).status) === 3;
    if (!delivered) await new Promise((ok) => setTimeout(ok, 3_000));
  }
  if (refundToo && !delivered) c3.refund = { pass: null, why: 'the hosted delivery had not landed after 90 s; refund skipped' };
  if (refundToo && delivered) {
    if ((await pub.getChainId()) !== config.networks.whitechain.chainId) throw new Error('not Whitechain');
    const account = privateKeyToAccount(env[`${shop.walletRole}_PRIVATE_KEY`]);
    // The hosted shop sends markDelivered with this key too: refuse while it has one in flight.
    const [latest, pending] = await Promise.all(['latest', 'pending'].map((blockTag) => pub.getTransactionCount({ address: account.address, blockTag })));
    if (latest !== pending) throw new Error(`${shop.walletRole} has a pending transaction (nonce ${latest}); no refund`);
    const merchant = merchantActions({ publicClient: pub, walletClients: { [shop.key]: whitechain.walletClient(account) }, checkout, chain: whitechain.chain });
    const before = (await balances(pub, who)).payer;
    const rf = await merchant.refund(shop.key, q0.orderId, story.order.refundMicro);
    const rrc = await pub.waitForTransactionReceipt({ hash: rf.hash, timeout: 120_000 });
    const after = (await balances(pub, who)).payer;
    const ev = events(rrc).find((e) => e.eventName === 'Refunded');
    c3.refund = { tx: rf.hash, explorer: whitechain.explorerTx(rf.hash), gasUsed: Number(rrc.gasUsed), amountMicro: ev?.args.amountMicro ?? null, full: ev?.args.full ?? null, payerDelta: after - before };
    c3.refund.pass = ev?.args.amountMicro === BigInt(story.order.refundMicro) && ev?.args.full === false && after - before === BigInt(story.order.refundMicro) && within(c3.refund.gasUsed, 75_344, 75_344);
    say(`C3 refund ${c3.refund.pass ? 'ok' : 'FAIL'}: ${c3.refund.explorer} gas ${c3.refund.gasUsed}`);
  }
  // C3: the story's re-order through the hosted reorder route: its own item when it names one
  // (ADR-0073: "another coffee", 0.80), else the order's.
  const qr = await quote({ shop: shop.ensName, item: story.order.reorder.sku ?? story.order.sku, qty: String(story.order.reorder.quantity), buyer: persona.ensName, payer: payer.ensName, wallet: wallet.address, parent: q0.orderId });
  const re = await payOnce(qr, new URL(qr.payUrl).pathname, { mandate: `M13 C3 ${out.startedAt}`, max: story.order.reorder.priceMicro, payee });
  if (re.status === 200) {
    const rc = await pub.waitForTransactionReceipt({ hash: re.body.transaction, timeout: 120_000 });
    const evs = events(rc);
    const created = evs.find((e) => e.eventName === 'OrderCreated');
    const settled = evs.find((e) => e.eventName === 'PaymentSettled');
    c3.reorder = { tx: re.body.transaction, explorer: whitechain.explorerTx(re.body.transaction), gasUsed: Number(rc.gasUsed), kind: created ? Number(created.args.kind) : null, parent: created?.args.parentOrderId ?? null, amountMicro: settled?.args.amountMicro ?? null, quoteKey: re.quoteKey };
    c3.reorder.pass = c3.reorder.kind === 1 && String(c3.reorder.parent).toLowerCase() === q0.orderId.toLowerCase() && c3.reorder.amountMicro === BigInt(story.order.reorder.priceMicro) && within(c3.reorder.gasUsed, 252_082, 252_082);
  } else c3.reorder = { pass: false, response: { stage: re.stage, status: re.status, body: re.body, gate: re.gate } };
  say(`C3 re-order ${c3.reorder.pass ? 'ok' : 'FAIL'}: ${c3.reorder.explorer ?? JSON.stringify(c3.reorder.response)}`);

  // C4(b): one more order is over the acceptance cap: refused off-chain (signed ungated, so the hosted
  // facilitator refuses it and its recorder writes the off-chain fail edge).
  const one = await quote({ shop: shop.ensName, item: story.order.sku, qty: '1', buyer: persona.ensName, payer: payer.ensName, wallet: wallet.address });
  // Only when it is really over the cap: otherwise the ungated 0.40 would settle.
  const policy = await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [payerNode] });
  const spent4 = BigInt(await pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'spentToday', args: [payerNode] }));
  if (spent4 + BigInt(one.priceMicro) <= BigInt(policy.dailyCapMicro)) {
    out.rows.C4 = { b: { pass: null, why: `not over the cap (spent ${spent4} of ${policy.dailyCapMicro})` }, a: { pass: null, why: 'needs a POLICY_WRITER revoke of the scout agent while the workers hold that key' } };
    throw new Error('C4(b) skipped: the payer is not over its cap, so the attempt would settle');
  }
  const n4 = await nonce();
  const over = await payOnce(one, new URL(one.payUrl).pathname, { mandate: `M13 C4b ${out.startedAt}`, max: one.priceMicro, payee, gated: false });
  await new Promise((ok) => setTimeout(ok, 4_000));
  const n4b = await nonce();
  let failEdge = null;
  if (over.status === 402) {
    const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
    for (let i = 0; i < 12 && !failEdge; i += 1) {
      await new Promise((ok) => setTimeout(ok, 5_000));
      const edges = await readAll(arkiv.publicClient, ENTITIES.edge, { owner: writerAddresses().W_SYNC, cap: 2000, truncate: true });
      failEdge = edges.find((e) => String(e.ref).startsWith(`att:${one.orderId.toLowerCase()}:`)) ?? null;
    }
    if (failEdge) await mirrorSync().catch(() => {});
  }
  const reason = over.body?.reason ?? null;
  out.rows.C4 = { b: { pass: over.status === 402 && reason === 'CAP_EXCEEDED' && n4b === n4 && Boolean(failEdge), status: over.status, reason, relayerNonce: { before: n4, after: n4b }, failEdge: failEdge ? { entityKey: failEdge.$key, kind: failEdge.kind, ref: failEdge.ref, reason: failEdge.reason ?? null } : null }, a: { pass: null, why: 'needs a POLICY_WRITER revoke of the scout agent while the workers hold that key' } };
  say(`C4(b) ${out.rows.C4.b.pass ? 'pass' : 'FAIL'}: ${over.status} ${reason}, nonce ${n4} → ${n4b}, fail edge ${failEdge?.$key ?? 'none'}`);
}

