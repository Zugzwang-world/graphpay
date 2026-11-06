// ALLOW_REAL_NETWORK=1 node integration/c4a.mjs [--yes]     (M13's C4(a))
// The policy writer revokes the scout agent's spending policy (its ENS name stays active), the
// scout pays one piece through the hosted shop and facilitator, and the contract records the
// refusal (PaymentFailed AGENT_REVOKED). Then the policy is restored and read back. The workers
// process also holds POLICY_WRITER (T2's watcher), so it must be stopped first: this refuses
// while its status port answers or while POLICY_WRITER has a pending transaction. The mirror
// writes the on-chain fail edge after it restarts; acceptance reads it (checks.mjs hosted()).
// Writes docs/sessions/integration/hosted/c4a-<time>.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castEntries, config, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsReader } from '@graphpay/ens';
import { decodePaymentRequiredHeader, graphPayOrderClient, x402Client, x402HTTPClient } from '@graphpay/facilitator';
import { nodeOf } from '@graphpay/money-graph';
import { PASSCODE_HEADER } from '@graphpay/shop';
import { decodeEventLog, isAddressEqual, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../scripts/lib/redact.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = { ...Object.fromEntries(values), ...process.env };
const redact = redactor(values);
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${redact(l)}\n`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
const send = process.argv.includes('--yes');
if (send && env.ALLOW_REAL_NETWORK !== '1') throw new Error('c4a --yes needs ALLOW_REAL_NETWORK=1');

const SITE = String(config.site.url).replace(/\/+$/, '');
const post = (path, body, headers = {}) => fetch(`${SITE}${path}`, { method: 'POST', redirect: 'error', cache: 'no-store', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const entries = castEntries();
const scout = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'scout');
const persona = entries.find((e) => e.kind === 'persona');
const good = entries.find((e) => e.kind === 'shop' && e.key === story.order.shop);
const wc = await clientsFor('whitechain', env);
const pub = wc.publicClient;
const checkout = config.whitechain.contracts.checkout.address;
const token = config.whitechain.tokens.usdt;
const node = nodeOf(scout.ensName);
const readPolicy = () => pub.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] });
const out = { startedAt: new Date().toISOString(), agent: scout.ensName, shop: good.ensName };

// The workers must be stopped (one POLICY_WRITER sender), and the key quiet.
const workersUp = await fetch('http://127.0.0.1:8788/status', { signal: AbortSignal.timeout(2_000) }).then(() => true, () => false);
const writer = privateKeyToAccount(env.POLICY_WRITER_PRIVATE_KEY);
const quiet = async () => {
  const [latest, pending] = await Promise.all(['latest', 'pending'].map((blockTag) => pub.getTransactionCount({ address: writer.address, blockTag })));
  return latest === pending ? latest : null;
};
const before = await readPolicy();
out.policyBefore = { wallet: before.wallet, epoch: Number(before.epoch), revoked: before.revoked, dailyCapMicro: before.dailyCapMicro, expiry: before.expiry };
say(`workers up: ${workersUp}; POLICY_WRITER nonce ${await quiet()}; ${scout.ensName} policy revoked ${before.revoked}, cap ${before.dailyCapMicro}`);
if (!send) process.exit(0);
if (workersUp) throw new Error('the workers process is running (it holds POLICY_WRITER); stop it first');
if (before.revoked) throw new Error('the policy is already revoked; restore it first');

const save = () => {
  out.endedAt = new Date().toISOString();
  const dir = join(here, '..', 'docs', 'sessions', 'integration', 'hosted');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `c4a-${out.startedAt.replace(/[:.]/g, '-')}.json`), `${redact(json(out))}\n`);
};
process.on('exit', save);

async function setPolicy(revoked, label) {
  const nonce = await quiet();
  if (nonce === null) throw new Error('POLICY_WRITER has a pending transaction; nothing sent');
  if ((await pub.getChainId()) !== config.networks.whitechain.chainId) throw new Error('not Whitechain; nothing sent');
  const request = { address: checkout, abi: checkoutAbi, functionName: 'setPolicy', args: [node, before.epoch, before.wallet, revoked, before.dailyCapMicro, before.expiry], account: writer };
  const gas = ((await pub.estimateContractGas(request)) * 12n) / 10n;
  const hash = await wc.walletClient(writer).writeContract({ ...request, chain: wc.chain, nonce, gas });
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== 'success') throw new Error(`${label} reverted: ${wc.explorerTx(hash)}`);
  say(`${label}: ${wc.explorerTx(hash)} (${receipt.gasUsed} gas)`);
  return { tx: hash, explorer: wc.explorerTx(hash), gasUsed: Number(receipt.gasUsed) };
}

// Armed before the revoke: whatever happens next, the policy is restored.
out.revoke = await setPolicy(true, 'revoke');
try {
  const payer = privateKeyToAccount(env[`${scout.walletRole}_PRIVATE_KEY`]);
  const qs = new URLSearchParams({ shop: good.ensName, item: story.order.sku, qty: '1', buyer: persona.ensName, payer: scout.ensName, wallet: payer.address });
  const q = await (await fetch(`${SITE}/api/shop/quote?${qs}`, { redirect: 'error', cache: 'no-store' })).json();
  const path = new URL(q.payUrl).pathname;
  const passcode = { [PASSCODE_HEADER]: env.DEMO_PASSCODE };
  const r402 = await post(path, q.terms, passcode);
  if (r402.status !== 402) throw new Error(`the 402 step answered ${r402.status}`);
  const required = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
  const payee = await createEnsReader({ client: (await clientsFor('sepolia', env)).publicClient }).resolvePayee(good.ensName);
  if (!payee.ok || !isAddressEqual(required.accepts[0].payTo, payee.payee)) throw new Error('the payTo is not the shop\'s ENS payee; nothing signed');
  const network = `eip155:${wc.chain.id}`;
  const scheme = graphPayOrderClient({ account: payer, publicClient: pub, chainId: wc.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: scout.ensName, mandateHash: keccak256(toHex(`M13 C4a ${out.startedAt}`)) });
  const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(q.priceMicro) }] });
  // Signed without the payer-side gate on purpose: the facilitator and the contract must refuse.
  const signature = new x402HTTPClient(client).encodePaymentSignatureHeader(await client.createPaymentPayload(required));
  const res = await post(path, q.terms, { ...passcode, ...signature });
  const body = await res.json().catch(() => null);
  out.attempt = { status: res.status, reason: body?.reason ?? null, orderId: q.orderId, tx: body?.transaction ?? null };
  if (body?.transaction) {
    const receipt = await pub.waitForTransactionReceipt({ hash: body.transaction, timeout: 120_000 });
    const failed = receipt.logs.flatMap((l) => {
      try {
        return l.address.toLowerCase() === checkout.toLowerCase() ? [{ ...decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics }), logIndex: l.logIndex }] : [];
      } catch {
        return [];
      }
    }).find((e) => e.eventName === 'PaymentFailed');
    Object.assign(out.attempt, { explorer: wc.explorerTx(body.transaction), gasUsed: Number(receipt.gasUsed), paymentFailed: failed ? { reason: Number(failed.args.reason), logIndex: failed.logIndex, ref: `${wc.chain.id}:${body.transaction}:${failed.logIndex}` } : null });
  }
  say(`scout pays while revoked: HTTP ${res.status} ${out.attempt.reason ?? ''} ${out.attempt.explorer ?? ''} ${out.attempt.gasUsed ?? ''}`);
} finally {
  out.restore = await setPolicy(false, 'restore');
  const after = await readPolicy();
  out.policyAfter = { wallet: after.wallet, epoch: Number(after.epoch), revoked: after.revoked, dailyCapMicro: after.dailyCapMicro, expiry: after.expiry };
  out.restoredExactly = !after.revoked && isAddressEqual(after.wallet, before.wallet) && after.epoch === before.epoch && after.dailyCapMicro === before.dailyCapMicro && after.expiry === before.expiry;
  say(`restored: revoked ${after.revoked}, cap ${after.dailyCapMicro}, same as before ${out.restoredExactly}`);
}
const a = out.attempt ?? {};
out.pass = a.status === 402 && a.reason === 'AGENT_REVOKED' && Boolean(a.paymentFailed) && a.gasUsed >= Math.floor(160_525 * 0.85) && a.gasUsed <= Math.ceil(160_525 * 1.15) && out.restoredExactly;
say(`C4(a) chain part ${out.pass ? 'pass' : 'FAIL'}; the on-chain fail edge follows when the workers restart`);
