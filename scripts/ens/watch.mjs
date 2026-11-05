// node scripts/ens/watch.mjs [--fork <loopback url>] [--seconds n]
// Runs the ENS watcher (packages/ens/src/watcher.mjs) against Ethereum Sepolia with LOGGING sinks:
// it signs nothing and writes nothing. It shows what the watcher would send to the policy writer
// and to the Arkiv node writer. The workers process (M11) hosts the same library with the real
// sinks: updatePolicy through createPolicySink (POLICY_WRITER, configured wallet and cap) and
// patchNode through the mirror's writer.

import { createPublicClient, http } from 'viem';
import { createEnsReader, createEnsGate, createEnsWatcher, disposableAgent, ensChain, ensPublicClient, memoryCheckpoint, namespacePlan, retryingReads } from '../../packages/ens/index.mjs';

const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const fork = arg('--fork');
const seconds = Number(arg('--seconds') ?? 60);
const base = fork ? createPublicClient({ chain: ensChain(), transport: http(fork, { timeout: 60_000 }) }) : (await ensPublicClient()).client;
const client = fork ? base : retryingReads(base, { tries: 4, delayMs: 2000 });
const plan = namespacePlan();
const names = [...plan.owners.map((o) => o.name), ...plan.agents.map((a) => a.name), ...[1, 2, 3].map((n) => disposableAgent(n).name)];

const say = (m) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);
const sink = {
  updatePolicy: async (c) => say(`[dry] updatePolicy ${JSON.stringify(c, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`),
  patchNode: async (node, f) => say(`[dry] patchNode ${node.slice(0, 10)}… ${JSON.stringify(f)}`),
};
const watcher = createEnsWatcher({
  client,
  names,
  sink,
  reader: createEnsReader({ client }),
  gate: createEnsGate({ client, expectedEpoch: async () => null, policyCapMicro: async () => null, spentToday: async () => 0n }),
  checkpoint: memoryCheckpoint(),
  log: say,
});
const started = await watcher.start();
say(`watching ${started.tracked} names from block ${started.checkpoint} (dry run, ${seconds} s)`);
const stop = watcher.run({ pollMs: 6_000, tickMs: 30_000, onError: (e) => say(`error: ${e.message}`) });
await new Promise((r) => setTimeout(r, seconds * 1000));
stop();
say('stopped');
