// node scripts/ens/kill-proof.mjs [--yes] [--wait-spare-s 600]
// One kill on the production site, checked from the chains themselves (the night brief's "done when"):
// GET /api/customer/kill-disposable names the spare; with --yes it POSTs the kill (the site signs; this
// script holds no key for it), then checks, read-only: the unregister on Sepolia (the name is no longer
// REGISTERED), the watcher's revocation on the Whitechain checkout (AgentPolicySet, revoked), the refusal's
// `fail` edge on Arkiv (by its ref, through the site's uncached GraphQL POST, with its explain trace) and,
// within --wait-spare-s, a fresh live spare.
// Writes docs/sessions/identity/kill-<label>.json. Prints names, hashes and public addresses only.

import { mkdirSync, writeFileSync } from 'node:fs';
import { getAbiItem, namehash } from 'viem';
import { activeCast, config } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { attemptEdge } from '../../packages/facilitator/index.mjs';
import { locate, retryingReads, STATUS } from '../../packages/ens/index.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../lib/redact.mjs';
import { roleAddresses } from '../lib/wallets.mjs';

let envValues = new Map();
installErrorBoundary(() => envValues);
const argv = process.argv.slice(2);
const SEND = argv.includes('--yes');
const waitSpareS = Number(argv.includes('--wait-spare-s') ? argv[argv.indexOf('--wait-spare-s') + 1] : 600);
const SITE = String(config.site.url).replace(/\/+$/, '');
const ROUTE = `${SITE}/api/customer/kill-disposable`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

async function spareNow() {
  const r = await fetch(ROUTE, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const { values } = loadEnv();
envValues = values;
const redact = redactor(values);
const env = Object.fromEntries(values);
const before = await spareNow();
console.log(`GET ${ROUTE}: ${before.status} ${JSON.stringify(before.body)}`);
if (!before.body?.spare) {
  console.log('no spare is live on the site: nothing to kill');
  process.exit(2);
}
if (!SEND) {
  console.log(`dry run: --yes would kill ${before.body.spare.name} on the production site`);
  process.exit(0);
}

const startedAt = new Date().toISOString();
console.log(`POST ${ROUTE} (the site kills ${before.body.spare.name}; 40 to 110 s)`);
const res = await fetch(ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(320_000) });
const answer = await res.json().catch(() => null);
console.log(`answer: ${res.status} ${redact(JSON.stringify(answer))}`);
const out = { route: ROUTE, startedAt, spareBefore: before.body.spare, status: res.status, answer, checks: {} };
const name = answer?.name ?? before.body.spare.name;
const label = name.split('.')[0];

// Sepolia: the name is no longer REGISTERED.
const sepolia = retryingReads((await clientsFor(config.ens.network, env)).publicClient);
const at = await locate(sepolia, name);
out.checks.unregistered = { status: at.state.status, ok: at.state.status !== STATUS.REGISTERED };

// Whitechain: the checkout's policy for the node is revoked, and its AgentPolicySet.
const wc = (await clientsFor('whitechain', env)).publicClient;
const checkout = config.whitechain.contracts.checkout.address;
const node = namehash(name);
const policy = await wc.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] });
const head = await wc.getBlockNumber();
const logs = await wc.getLogs({ address: checkout, event: getAbiItem({ abi: checkoutAbi, name: 'AgentPolicySet' }), args: { payerNode: node }, fromBlock: head - 999n, toBlock: head });
const revokeLog = logs.filter((l) => l.args.revoked).at(-1);
out.checks.revoked = { revoked: Boolean(policy.revoked), tx: revokeLog?.transactionHash ?? null, ok: Boolean(policy.revoked) };

// Arkiv: the refusal's fail edge, by its ref (the facilitator's attemptEdge), read through GraphQL.
if (answer?.payment?.outcome === 'refused' && answer.payment.orderId && answer.payment.reason) {
  const n = Number(label.slice(activeCast().disposable.labelPrefix.length));
  const payer = roleAddresses(values)[`${activeCast().disposable.walletRolePrefix}${n}`];
  const ref = attemptEdge({ orderId: answer.payment.orderId, payer, reason: answer.payment.reason, payerNode: `0x${'0'.repeat(64)}`, payerName: '', shopName: '', amountMicro: '0', at: Date.now(), onchain: false, status: 'rejected' }).ref;
  let edge = null;
  let trace = null;
  for (let i = 0; i < 12 && !edge; i += 1) {
    const r = await fetch(`${SITE}/api/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query($id: String!) { order(id: $id) { kind ref from { ens } to { ens } } }', variables: { id: answer.payment.orderId } }), signal: AbortSignal.timeout(30_000) });
    const body = await r.json().catch(() => null);
    edge = body?.data?.order?.find((e) => e.kind === 'fail' && e.ref === ref) ?? null;
    trace = body?.extensions?.arkiv ?? null;
    if (!edge) await sleep(5_000);
  }
  out.checks.recorded = { ref, edge, trace, ok: Boolean(edge) };
}

// A fresh spare on the site.
const until = Date.now() + waitSpareS * 1000;
let after = await spareNow();
while (!(after.body?.spare && after.body.spare.name !== name) && Date.now() < until) {
  await sleep(20_000);
  after = await spareNow();
}
out.checks.freshSpare = { spare: after.body?.spare ?? null, at: new Date().toISOString(), ok: Boolean(after.body?.spare && after.body.spare.name !== name) };

const file = `docs/sessions/identity/kill-${label}.json`;
mkdirSync('docs/sessions/identity', { recursive: true });
writeFileSync(file, `${redact(json(out))}\n`);
const failed = Object.entries(out.checks).filter(([, c]) => !c.ok).map(([k]) => k);
if (answer?.payment?.outcome !== 'refused') failed.push(`the payment after the kill was ${answer?.payment?.outcome ?? 'not tried'}`);
console.log(`${failed.length === 0 ? 'kill proof: all pass' : `kill proof: FAIL ${failed.join(', ')}`} (${file})`);
process.exitCode = failed.length === 0 ? 0 : 1;
