// The live errand runner behind the site's POST /api/agents/run (planning/SPEC/ARCHITECTURE.md
// row 7; the founder's go, Fri 6 Nov): the buyer team on the `live` preset, over live ENS,
// Arkiv, the MCP and the hosted shop and facilitator (stack.mjs, hosted mode), as the story's
// payer agent. Server side only: the keys come from the server's environment and never leave it.
// Guardrails, all in the path of every run:
//   - the payer-side ENS gate before every signature (gatedSign), the contract's policy caps,
//     the facilitator's own gate and the x402 spend control (at most the story's budget);
//   - the passcode and one run at a time (the route and the registry), and a rate limit here;
//   - the site's runId as the errand's runId, so its presence and handoff rows carry it;
//   - presence and handoffs batched as W_DIRECTORY (batchedActivity) and flushed at the end.
// createLiveRunner(env) answers null when a needed name is missing, and the route then says so.

import { createShopGateway, runErrand, teamCast } from '@graphpay/agents';
import { castEntries, config, network, resolveRpc } from '@graphpay/config';
import { connectArkiv } from '@graphpay/money-graph';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { batchedActivity } from './activity.mjs';
import { createReadHooks } from './hooks.mjs';
import { connectMcp } from './mcp.mjs';
import { startStack, x402Codec } from './stack.mjs';

// What the runner needs on the server (names only; the values are never read into a log).
export const LIVE_RUNNER_NEEDS = ['ANTHROPIC_API_KEY', 'PAYER_PRIVATE_KEY', 'W_DIRECTORY_PRIVATE_KEY', 'ARKIV_ACCESS_KEY', 'DEMO_PASSCODE', 'ALLOW_REAL_NETWORK'];
// At most this many errands per instance in a rolling hour (each one spends test USDT and API).
export const RUNS_PER_HOUR = 6;
const PAYER = 'payer';

export function liveRunnerMissing(env = process.env) {
  return LIVE_RUNNER_NEEDS.filter((name) => !env[name] || (name === 'ALLOW_REAL_NETWORK' && env[name] !== '1'));
}

// One network's checked clients (every candidate RPC must answer the config's chain id).
async function clientsFor(key, env) {
  const n = network(key);
  const rpc = await resolveRpc(key, { env });
  const chain = defineChain({ id: n.chainId, name: n.name, nativeCurrency: { name: n.nativeSymbol, symbol: n.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: [] } } });
  const transport = http(rpc.url, { retryCount: 2, timeout: 20_000 });
  const publicClient = createPublicClient({ chain, transport });
  if ((await publicClient.getChainId()) !== chain.id) throw new Error(`${n.name}: refused, the RPC reports another chain`);
  return { key, chain, rpcLabel: rpc.label, publicClient, walletClient: (account) => createWalletClient({ account, chain, transport }), explorerTx: (hash) => `${n.explorer}/tx/${hash}` };
}

// env: the server's environment (process.env on Vercel). log: one line, no secrets.
export function createLiveRunner(env = process.env, { log = () => {}, now = Date.now } = {}) {
  if (liveRunnerMissing(env).length) return null;
  const runEnv = { ...env, AGENT_PRESET: 'live', AGENT_MODE: 'anthropic' }; // the live preset only
  const started = [];
  let parts = null; // the clients, connections and stack, built on the first run of an instance

  async function build() {
    const [whitechain, sepolia] = await Promise.all([clientsFor('whitechain', runEnv), clientsFor('sepolia', runEnv)]);
    const [arkiv, directory] = await Promise.all([connectArkiv({ backend: 'rabdi', env: runEnv }), connectArkiv({ backend: 'rabdi', env: runEnv, role: 'W_DIRECTORY' })]);
    const stack = await startStack({ env: runEnv, whitechain, sepolia, log });
    if (!stack.hosted) throw new Error('live runner: the stack must be the hosted one');
    const payer = castEntries().find((e) => e.kind === 'buyer-agent' && e.key === PAYER);
    const wallets = { [payer.walletRole]: privateKeyToAccount(runEnv[`${payer.walletRole}_PRIVATE_KEY`]).address };
    const read = createReadHooks({ ens: sepolia.publicClient, arkiv, gate: stack.gate, wallets });
    return { whitechain, directory, stack, payer, read };
  }

  return async function liveErrand({ runId, request, onEvent, signal }) {
    const t = now();
    while (started.length && t - started[0] > 3_600_000) started.shift();
    if (started.length >= RUNS_PER_HOUR) throw new Error(`rate limited: at most ${RUNS_PER_HOUR} errands an hour`);
    started.push(t);
    parts ??= build().catch((e) => {
      parts = null;
      throw e;
    });
    const { stack, payer, read, directory } = await parts;
    const mcp = await connectMcp();
    const activity = batchedActivity(directory, { log });
    const team = teamCast();
    const storefront = (shopEns) => `${config.site.url}/storefront/${shopEns.split('.')[0]}`;
    const hooks = {
      ...read,
      x402: x402Codec,
      catalog: (shopEns) => stack.surfaceFor(shopEns).catalog(),
      storefrontUrl: async (shopEns) => storefront(shopEns),
      // The payer-side ENS gate runs before every signature; nothing is signed if it refuses.
      sign: stack.gate.gatedSign(stack.signerFor(payer.walletRole)),
      presence: activity.presence,
      handoff: activity.handoff,
    };
    hooks.shopClient = (shopEns, opts) => createShopGateway({ shopEns, surface: stack.surfaceFor(shopEns), mcp, hooks, storefront: storefront(shopEns), names: team.shopAgentNames(shopEns), ...opts });
    try {
      const { runLog, metrics } = await runErrand({ mode: 'anthropic', env: runEnv, buyer: PAYER, hooks, mcp, runId, request, onEvent, signal, secrets: stack.secrets, label: 'live errand on the site (SYNTHETIC story)' });
      log(`live errand ${runId}: ${runLog.result.status}, ${metrics.seconds.toFixed(1)} s, $${metrics.apiCostUsd.toFixed(4)}`);
      return runLog.result;
    } finally {
      await activity.flush().catch(() => {});
      await Promise.resolve(mcp.close?.()).catch(() => {});
    }
  };
}
