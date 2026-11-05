// pnpm e2e:food (M12, planning/SPEC/INTEGRATION_AND_MIRROR.md §4–§6): the story's errand
// through every layer on the real networks: agents → ENS gate → 402 → our facilitator →
// the checkout on Whitechain → the mirror (the running workers process) → Arkiv → GraphQL,
// checked with assertions A–E (F, the kill, with E2E_KILL=real; it needs a fresh disposable
// agent). Env (names only): E2E_NETWORK=real (the fork mode is not built), E2E_BUYER
// (rehearsal by default; payer only for the counting run), AGENT_PRESET, E2E_KILL (skip),
// ALLOW_REAL_NETWORK=1, and the role keys through the env loader. Writes the run file and
// the transcript to integration/runs/<run id>/ and prints the calibration row (ADR-0048).
// Never run it while another process relays with FACILITATOR, or while the website demo is
// live.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createShopGateway, runErrand, teamCast } from '@graphpay/agents';
import { activeCast, castEntries, config, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { decodeLogs } from '../packages/mirror/src/decode.mjs';
import { connectArkiv } from '@graphpay/money-graph';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../scripts/lib/redact.mjs';
import { roleAddresses } from '../scripts/lib/wallets.mjs';
import { batchedActivity } from './src/activity.mjs';
import { assertChoice, assertMirrored, assertRefund, assertSettled, assertTallies } from './src/assertions.mjs';
import { balances, mirrorCursor, mirrorSync, tallies, trail } from './src/evidence.mjs';
import { createReadHooks } from './src/hooks.mjs';
import { connectMcp } from './src/mcp.mjs';
import { buildRunFile, transcript } from './src/runfile.mjs';
import { startStack, x402Codec } from './src/stack.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = { ...Object.fromEntries(values), ...process.env };
const redact = redactor(values);
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${redact(l)}\n`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x));

if ((env.E2E_NETWORK ?? 'real') !== 'real') throw new Error('e2e:food: only E2E_NETWORK=real is built (the fork mode is not)');
const buyerKey = env.E2E_BUYER ?? 'rehearsal';
const cast = activeCast();
const team = teamCast();
const entries = castEntries(cast);
const buyer = entries.find((e) => e.kind === 'buyer-agent' && e.pays && e.key === buyerKey);
if (!buyer) throw new Error(`E2E_BUYER ${buyerKey} is not a paying agent of the story`);
const shopOf = (role) => entries.find((e) => e.kind === 'shop' && e.storyRole === role);
const good = shopOf('good');
const trap = shopOf('trap');
const runnerUp = shopOf('runner-up');
const startedAt = new Date().toISOString();

// 1. The one workers process must be running and caught up (never a second one).
const cursor0 = await mirrorCursor();
say(`mirror: instance ${cursor0.instance}, ${cursor0.lagBlocks} blocks behind`);

// 2. Clients and connections (each checked by chain id).
const whitechain = await clientsFor('whitechain', env);
const sepolia = await clientsFor('sepolia', env);
const arkiv = await connectArkiv({ backend: 'rabdi', env });
const directory = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
const sync = await connectArkiv({ backend: 'rabdi', env, role: 'W_SYNC' });
const mcp = await connectMcp();
const wallets = roleAddresses(values);
const startBlock = Number(await whitechain.publicClient.getBlockNumber({ cacheTime: 0 }));
say(`whitechain ${whitechain.rpcLabel}, sepolia ${sepolia.rpcLabel}, arkiv ${arkiv.label}; from block ${startBlock}`);

// 3. The stack and the live hooks.
let read = null;
// The shop writes its quote with the directory's shop key (the read hooks' discovery).
const stack = await startStack({ env, whitechain, sepolia, directory, sync, shopKeyOf: (name) => read.shopKey(name), log: say });
read = createReadHooks({ ens: sepolia.publicClient, arkiv, gate: stack.gate, wallets });
const activity = batchedActivity(directory, { log: say });
const storefront = (shopEns) => `${stack.base}/storefront/${shopEns.split('.')[0]}`;
const hooks = {
  ...read,
  x402: x402Codec,
  catalog: (shopEns) => stack.surfaceFor(shopEns).catalog(),
  storefrontUrl: async (shopEns) => storefront(shopEns),
  sign: stack.gate.gatedSign(stack.signerFor(buyer.walletRole)),
  presence: activity.presence,
  handoff: activity.handoff,
};
hooks.shopClient = (shopEns, t) => createShopGateway({ shopEns, surface: stack.surfaceFor(shopEns), mcp, hooks, storefront: storefront(shopEns), names: team.shopAgentNames(shopEns), ...t });

// 4. Evidence before.
const who = { payer: wallets[buyer.walletRole], good: wallets[good.walletRole], trap: wallets[trap.walletRole] };
const before = { balances: await balances(whitechain.publicClient, who), graph: await tallies(mcp, { good: good.ensName, payer: buyer.ensName }) };
say(`before: ${good.ensName} all-time orders ${before.graph.good.all?.orders}, payer TODAY paid ${before.graph.payer.today?.paidMicro}`);

// 5. The errand (the story's request, the active preset, live hooks).
say(`errand as ${buyer.ensName} on preset ${env.AGENT_PRESET ?? story.agentModels?.active ?? 'active'}`);
const { runLog, metrics } = await runErrand({ mode: 'anthropic', env, buyer: buyerKey, hooks, mcp, label: `${cast.key ?? 'story'} errand, real networks (SYNTHETIC story)` });
await activity.flush();
const r = runLog.result;
say(`errand: ${r.status}, chose ${r.chosenShop}, ${metrics.seconds.toFixed(1)} s, $${metrics.apiCostUsd.toFixed(4)}${r.refusals.length ? `, refusals ${r.refusals.map((x) => x.reason).join(', ')}` : ''}`);

// 6. Mirror, then read.
const eventsSince = async () => {
  const head = Number(await whitechain.publicClient.getBlockNumber({ cacheTime: 0 }));
  const logs = await whitechain.publicClient.getLogs({ address: config.whitechain.contracts.checkout.address, fromBlock: BigInt(startBlock), toBlock: BigInt(head) });
  return decodeLogs(checkoutAbi, logs, { chainId: whitechain.chain.id }).events;
};
const settle = async () => {
  for (let i = 0; i < 12; i += 1) {
    await mirrorSync();
    const events = await eventsSince();
    const last = events.at(-1);
    if (!last || (await mirrorCursor()).scannedTo >= last.block) return events;
    await new Promise((ok) => setTimeout(ok, 5_000));
  }
  return eventsSince();
};
let events = await settle();
const afterPay = { balances: await balances(whitechain.publicClient, who), graph: await tallies(mcp, { good: good.ensName, payer: buyer.ensName }) };
const orderTrail = r.orderId ? await trail(mcp, r.orderId) : { edges: [] };
const cursor1 = await mirrorCursor();
const assertions = [
  assertChoice({ runLog, events, balances: { before: before.balances, after: afterPay.balances }, shops: { good: good.ensName, runnerUp: runnerUp.ensName, trap: trap.ensName, trapNode: await read.nodeOf(trap.ensName) } }),
  assertSettled({ runLog, events, balances: { before: before.balances, after: afterPay.balances }, priceMicro: story.order.priceMicro, network: 'WHITECHAIN' }),
  assertMirrored({ trail: { edges: orderTrail.edges, cursorBlock: cursor1.scannedTo }, events }),
  assertTallies({ graph: { before: before.graph, after: afterPay.graph, explainIds: [before.graph.explainId, afterPay.graph.explainId] }, priceMicro: story.order.priceMicro }),
];

// 7. The partial refund (E), as the good shop's merchant.
if (r.status === 'paid' && r.orderId) {
  const shopKey = cast.shops.find((s) => `${s.label}.${config.root.ens}` === good.ensName).key;
  const refund = await stack.merchant.refund(shopKey, r.orderId, story.order.refundMicro);
  say(`refund ${story.order.refundMicro} micro: ${whitechain.explorerTx(refund.hash)} (${refund.status})`);
  events = await settle();
  const afterRefund = await tallies(mcp, { good: good.ensName, payer: buyer.ensName });
  const refundTrail = await trail(mcp, r.orderId);
  assertions.push(assertRefund({ graph: { before: afterPay.graph, after: afterRefund }, trail: refundTrail, refundMicro: story.order.refundMicro }));
}
stack.close();
await mcp.close();

// 8. Outputs.
const endedAt = new Date().toISOString();
const run = buildRunFile({
  network: 'real',
  model: runLog.model,
  startedAt,
  endedAt,
  runLog,
  events,
  answers: [{ what: 'tallies before', explainId: before.graph.explainId }, { what: 'tallies after the payment', explainId: afterPay.graph.explainId }, { what: 'the order trail', explainId: orderTrail.explainId ?? null }],
  kill: env.E2E_KILL === 'real' ? { status: 'not built in this run' } : null,
  assertions,
  cost: { apiCostUsd: Number(metrics.apiCostUsd.toFixed(4)), seconds: Number(metrics.seconds.toFixed(1)), tokens: metrics.tokens },
});
const dir = join(here, 'runs', runLog.runId);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'run.json'), `${redact(json(run))}\n`);
writeFileSync(join(dir, 'e2e-food-transcript.md'), redact(transcript(run)));
for (const a of assertions) say(`${a.id}: ${a.pass ? 'pass' : `FAIL (${a.failed.join('; ')})`}`);
say(`calibration: | ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST | e2e:food real, ${buyerKey} | ${runLog.model} | ${metrics.seconds.toFixed(1)} s | $${metrics.apiCostUsd.toFixed(4)} | ${r.status} |`);
say(`run file: ${join('integration', 'runs', runLog.runId, 'run.json')}`);
process.exit(run.pass ? 0 : 1);
