// node scripts/ens/gate-pass.mjs [--fork <loopback url>]
// A read-only gate pass over every agent of the active story (and the disposable agents that
// exist) on Ethereum Sepolia: signs nothing. Two columns per name: the ENS side alone (the
// policy and tally faked from the name's own epoch and published cap) and the full gate with the
// real checkout's policy on Whitechain, which says ENS_NO_POLICY until the payments setup ran.
// Prints names, reasons and timings only.

import { createPublicClient, http } from 'viem';
import { config } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { createEnsGate, disposableAgent, ensChain, ensPublicClient, KEYS, namespacePlan, readText, retryingReads, walkName } from '../../packages/ens/index.mjs';
import { clientsFor } from '../lib/chains.mjs';

const fork = process.argv.includes('--fork') ? process.argv[process.argv.indexOf('--fork') + 1] : undefined;
const plan = namespacePlan();
const names = [...plan.agents.map((a) => a.name), ...[1, 2, 3, 4].map((n) => disposableAgent(n).name)];

const { client: base } = fork ? { client: createPublicClient({ chain: ensChain(), transport: http(fork, { timeout: 60_000 }) }) } : await ensPublicClient();
const client = retryingReads(base, { tries: 4, delayMs: 2000 });

const checkout = config.whitechain.contracts?.checkout?.address;
let wc;
if (checkout) {
  try {
    wc = (await clientsFor('whitechain', {})).publicClient;
  } catch {
    wc = undefined;
  }
}
const policyOf = async (node) => (wc ? wc.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] }) : null);

const enough = (r) => (r.ok ? 'ok' : r.reason);
let pass = 0;
let checked = 0;
for (const name of names) {
  const walk = await walkName(client, name);
  if (!walk.ok) {
    console.log(`${name.padEnd(46)} ${walk.reason} (not provisioned or killed)`);
    continue;
  }
  const t0 = Date.now();
  const cap = BigInt(await readText(client, name, KEYS.capMicro).catch(() => '0'));
  const ensOnly = createEnsGate({ client, expectedEpoch: async () => walk.epoch, policyCapMicro: async () => cap, spentToday: async () => 0n });
  const r1 = await ensOnly.ensGate(name, 1n);
  const full = createEnsGate({
    client,
    expectedEpoch: async (node) => {
      const p = await policyOf(node);
      return p && p.wallet !== '0x0000000000000000000000000000000000000000' ? p.epoch : null;
    },
    policyCapMicro: async (node) => {
      const p = await policyOf(node);
      return p && !p.revoked && p.wallet !== '0x0000000000000000000000000000000000000000' ? BigInt(p.dailyCapMicro) : null;
    },
    spentToday: async () => 0n,
  });
  const r2 = wc ? await full.ensGate(name, 1n) : { ok: false, reason: 'no checkout in the config' };
  checked += 1;
  if (r1.ok || (cap === 0n && r1.reason === 'CAP_EXCEEDED')) pass += 1;
  console.log(`${name.padEnd(46)} ENS side ${enough(r1).padEnd(14)} cap ${String(cap).padStart(9)}  full gate ${enough(r2).padEnd(16)} ${Date.now() - t0} ms`);
}
console.log(`\n${pass}/${checked} registered names pass the ENS side (a cap of 0 refuses by design: ADR-0059)`);
