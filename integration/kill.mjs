// pnpm e2e:kill: assertion F of e2e:food (E7, and B6's gate denial), once per disposable
// label. The disposable agent pays one piece (0.40) while alive, the owner kills its name on
// Sepolia (T2's scripts/ens/owner.mjs kill --real), then it tries again every 3 s: the
// facilitator must answer HTTP 402 refused: ENS_EXPIRED_OR_REVOKED within 25 s of the kill's
// receipt, and the recorder's off-chain fail edge must land on Arkiv. It signs with the
// UNGATED signer on purpose: the check is that the facilitator refuses, and records it.
// Env: E2E_DISPOSABLE (1), ALLOW_REAL_NETWORK=1, the keys through the env loader. The kill is
// irreversible for that label. Writes docs/sessions/integration/runs/kill-<label>/kill.json.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeCast, config, disposableEntry } from '@graphpay/config';
import { connectArkiv, ENTITIES, writerAddresses } from '@graphpay/money-graph';
import { readAll } from '@graphpay/arkiv-graph';
import { erc20Abi, keccak256, toHex } from 'viem';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../scripts/lib/redact.mjs';
import { roleAddresses } from '../scripts/lib/wallets.mjs';
import { assertKilled } from './src/assertions.mjs';
import { mirrorCursor, mirrorSync } from './src/evidence.mjs';
import { createReadHooks } from './src/hooks.mjs';
import { startStack, x402Codec } from './src/stack.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = { ...Object.fromEntries(values), ...process.env };
let redact = redactor(values);
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${redact(l)}\n`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

const cast = activeCast();
const n = Number(env.E2E_DISPOSABLE ?? 1);
const agent = disposableEntry(n, cast);
const persona = `${cast.persona.label}.${config.root.ens}`;
const good = cast.shops.find((s) => s.storyRole === 'good');
const goodEns = `${good.label}.${config.root.ens}`;
const wallets = roleAddresses(values);
const wallet = wallets[agent.walletRole];
if (!wallet) throw new Error(`no ${agent.walletRole} key`);

await mirrorCursor(); // the one workers process must be running
const whitechain = await clientsFor('whitechain', env);
const sepolia = await clientsFor('sepolia', env);
const arkiv = await connectArkiv({ backend: 'rabdi', env });
const directory = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
const sync = await connectArkiv({ backend: 'rabdi', env, role: 'W_SYNC' });
const balance = await whitechain.publicClient.readContract({ address: config.whitechain.tokens.usdt.address, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] });
const piece = BigInt(good.products[0].priceMicro) / BigInt(good.products[0].quantity);
if (balance < piece * 2n) throw new Error(`${agent.walletRole} holds ${balance} micro USDT; it needs ${piece * 2n} (fund it first)`);

let read = null;
const stack = await startStack({ env, whitechain, sepolia, directory, sync, shopKeyOf: (s) => read.shopKey(s), log: say });
read = createReadHooks({ ens: sepolia.publicClient, arkiv, gate: stack.gate, wallets });
redact = redactor(new Map([...values, ...stack.secrets.map((v, i) => [`KILL_RUN_SECRET_${i}`, v])]));
const surface = stack.surfaceFor(goodEns);
const sign = stack.signerFor(agent.walletRole); // ungated on purpose
const mandate = { hash: keccak256(toHex(`kill check ${agent.ensName} ${Date.now()}`)) };
const item = good.products[0].name;

async function attempt() {
  const q = await surface.quote({ item, quantity: 1, buyer: persona, payer: agent.ensName, wallet });
  const r402 = await surface.pay({ payUrl: q.payUrl, terms: q.terms });
  if (r402.status !== 402) return { status: r402.status, body: r402.body, stage: 'quote' };
  const paymentRequired = x402Codec.decodePaymentRequired(r402.headers['payment-required']);
  const signature = await sign({ paymentRequired, mandate, payerEns: agent.ensName });
  const res = await surface.pay({ payUrl: q.payUrl, terms: q.terms, signature });
  return { status: res.status, body: res.body, orderId: q.orderId };
}

const out = { agent: agent.ensName, startedAt: new Date().toISOString() };
const alive = await attempt();
out.alive = { status: alive.status, reason: alive.body?.reason ?? null, transaction: alive.body?.transaction ?? null };
say(`alive: HTTP ${alive.status} ${alive.body?.status ?? ''} ${alive.body?.transaction ? whitechain.explorerTx(alive.body.transaction) : ''}`);
if (alive.status !== 200) throw new Error('the payment while alive did not settle; no kill');

say(`kill: owner.mjs kill ${agent.ensName} --real`);
const killOut = execFileSync(process.execPath, [join(here, '..', 'scripts/ens/owner.mjs'), 'kill', agent.ensName, '--real'], { encoding: 'utf8' });
// Taken when owner.mjs returns after the receipt: a little later than the receipt itself,
// so the 25 s window is measured slightly in the refusal's favour (noted in kill.json).
const receiptMs = Date.now();
out.kill = { output: redact(killOut.trim().split('\n').at(-1)), receiptAt: new Date(receiptMs).toISOString(), timing: 'receipt time taken when owner.mjs returned (slightly late)' };
say(out.kill.output);

// From here on the kill has happened: every outcome is written to kill.json.
const dir = join(here, '..', 'docs', 'sessions', 'integration', 'runs', `kill-${agent.ensName.split('.')[0]}`);
const save = () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kill.json'), `${redact(json(out))}\n`);
};
process.on('exit', save);
let refused = null;
out.attempts = [];
for (let i = 0; i < 14 && !refused; i += 1) {
  await new Promise((ok) => setTimeout(ok, 3_000));
  let r;
  try {
    r = await attempt();
  } catch (e) {
    r = { status: null, body: { error: e.name } };
  }
  const t = ((Date.now() - receiptMs) / 1000).toFixed(1);
  out.attempts.push({ afterS: Number(t), status: r.status, reason: r.body?.reason ?? r.body?.status ?? r.body?.error ?? null });
  say(`after ${t} s: HTTP ${r.status} ${r.body?.reason ?? r.body?.status ?? r.body?.error ?? ''}`);
  // Only the kill's own refusal ends the loop; a transient read failure is retried.
  if (r.status === 402 && r.body?.reason === 'ENS_EXPIRED_OR_REVOKED') refused = { ms: Date.now(), status: 402, reason: r.body.reason, orderId: r.orderId };
  else if (r.status === 200) out.paidAfterKill = (out.paidAfterKill ?? 0) + 1;
}

// The recorder's fail edge (W_SYNC), then the mirror's fold.
let failEdge = null;
for (let i = 0; i < 10 && refused && !failEdge; i += 1) {
  await new Promise((ok) => setTimeout(ok, 3_000));
  failEdge = stack.refusals.find((x) => x.entityKey && x.ref.startsWith(`att:${refused.orderId.toLowerCase()}:`))?.entityKey ?? null;
}
if (failEdge) await mirrorSync();
const syncEdges = failEdge ? await readAll(arkiv.publicClient, ENTITIES.edge, { owner: writerAddresses().W_SYNC, cap: 500, truncate: true }) : [];
stack.close();

const verdict = assertKilled({ kill: { receiptMs, refusedMs: refused?.ms ?? NaN, status: refused?.status ?? null, reason: refused?.reason ?? null, failEdge } });
// A payment that settled after the kill means the gate was slow: F does not pass silently.
if (out.paidAfterKill) {
  verdict.pass = false;
  verdict.failed.push(`${out.paidAfterKill} payment(s) settled after the kill`);
}
out.refused = refused;
out.failEdge = failEdge ? { entityKey: failEdge, onArkiv: syncEdges.some((e) => e.$key === failEdge) } : null;
out.assertion = verdict;
save();
say(`F: ${verdict.pass ? 'pass' : `FAIL (${verdict.failed.join('; ')})`}; ${join('docs/sessions/integration/runs', `kill-${agent.ensName.split('.')[0]}`, 'kill.json')}`);
process.exit(verdict.pass ? 0 : 1);
