// The live errand runner behind the site's POST /api/agents/run (planning/SPEC/ARCHITECTURE.md
// row 7; the founder's go, Fri 6 Nov): the buyer team on the story's `live` preset (its providers
// and their key names come from the preset and config `models`, ADR-0067), over live ENS,
// Arkiv, the MCP and the hosted shop and facilitator (stack.mjs, hosted mode), as the story's
// payer agent. Server side only: the keys come from the server's environment and never leave it.
// Guardrails, all in the path of every run:
//   - the payer-side ENS gate before every signature (gatedSign), the contract's policy caps,
//     the facilitator's own gate and the x402 spend control (at most the story's budget);
//   - the passcode and one run at a time (the route and the registry, and a busy flag here);
//   - the site's runId as the errand's runId, so its presence and handoff rows carry it;
//   - presence and handoffs batched as W_DIRECTORY (batchedActivity) and flushed at the end.
// createLiveRunner(env) answers null when a needed name is missing, and the route then says so.

import { createShopGateway, runErrand, teamCast } from '@graphpay/agents';
import { castEntries, config, network, resolveRpc, story } from '@graphpay/config';
import { connectArkiv } from '@graphpay/money-graph';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { batchedActivity } from './activity.mjs';
import { createReadHooks } from './hooks.mjs';
import { connectMcp } from './mcp.mjs';
import { startStack, x402Codec } from './stack.mjs';

// What the runner needs on the server (names only; the values are never read into a log).
const PAYER = 'payer'; // the cast's stage payer agent (its key in the story config)
const payerEntry = () => castEntries().find((e) => e.kind === 'buyer-agent' && e.key === PAYER) ?? null;
// The live preset's model keys: each provider's key name from config models (never named here).
const modelKeys = () => [...new Set(Object.values(story.agentModels?.presets?.live?.roles ?? {}).map((r) => config.models?.[r.provider]?.keyEnv ?? `an installed provider for ${r.provider}`))];
export const LIVE_RUNNER_NEEDS = [...modelKeys(), `${payerEntry()?.walletRole ?? 'PAYER'}_PRIVATE_KEY`, 'W_DIRECTORY_PRIVATE_KEY', 'ARKIV_ACCESS_KEY', 'DEMO_PASSCODE', 'ALLOW_REAL_NETWORK'];
// The Arkiv flush of presence and handoffs may not hold the result back longer than this.
const FLUSH_WAIT_MS = 10_000;
// A signed payment the shop answers with "retry is safe" (nothing was sent: the facilitator was
// unavailable, or the instance was starting) is sent again, the same signature for the same
// order, after these waits. The order id makes it idempotent: a payment that did settle answers
// "already paid" from the chain. Any other answer goes to the payer agent as it came (G16).
export const PAY_RETRY_WAITS_MS = [3_000, 8_000];
const retrySafe = (r) => (r.status === 502 && /retry is safe/.test(String(r.body?.error))) || (r.status === 503 && r.body?.error === 'starting');

// pay(args) once, then again after each wait while the answer is retry-safe and the run goes on.
export async function payWithRetry(pay, args, { waits = PAY_RETRY_WAITS_MS, signal = null, log = () => {}, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)) } = {}) {
  let r = await pay(args);
  for (const wait of waits) {
    if (!retrySafe(r) || signal?.aborted) break;
    log(`live runner: the shop answered ${r.status} (retry is safe); the same signed payment again in ${wait / 1000} s`);
    await sleep(wait);
    r = await pay(args);
  }
  return r;
}

export function liveRunnerMissing(env = process.env) {
  if (!payerEntry()) return ['a paying agent named payer in the story'];
  if (!story.agentModels?.presets?.live) return ['a live preset in the story'];
  if (env.STACK_LOCAL_RELAY === '1' || process.env.STACK_LOCAL_RELAY === '1') return ['STACK_LOCAL_RELAY unset (the runner uses the hosted stack only)'];
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
// buildParts: the tests' seam for the start-up (clients, connections, the stack); the default builds them live.
export function createLiveRunner(env = process.env, { log = () => {}, buildParts = null } = {}) {
  if (liveRunnerMissing(env).length) return null;
  const runEnv = { ...env, AGENT_PRESET: 'live', AGENT_MODE: 'live' }; // the live preset only
  let busy = false; // one errand at a time in this instance, until its last step has finished
  let parts = null; // the clients, connections and stack, built on the first run of an instance

  async function build() {
    const [whitechain, sepolia] = await Promise.all([clientsFor('whitechain', runEnv), clientsFor('sepolia', runEnv)]);
    const [arkiv, directory] = await Promise.all([connectArkiv({ backend: 'rabdi', env: runEnv }), connectArkiv({ backend: 'rabdi', env: runEnv, role: 'W_DIRECTORY' })]);
    const stack = await startStack({ env: runEnv, whitechain, sepolia, merchantKeys: false, log });
    if (!stack.hosted) throw new Error('live runner: the stack must be the hosted one');
    const payer = payerEntry();
    const wallets = { [payer.walletRole]: privateKeyToAccount(runEnv[`${payer.walletRole}_PRIVATE_KEY`]).address };
    const read = createReadHooks({ ens: sepolia.publicClient, arkiv, gate: stack.gate, wallets });
    return { whitechain, directory, stack, payer, read };
  }

  return async function liveErrand({ runId, request, onEvent, signal }) {
    if (busy) throw Object.assign(new Error('busy: an errand is still finishing on this server'), { code: 'LIVE_RUNNER_BUSY' });
    busy = true;
    try {
      return await errand({ runId, request, onEvent, signal });
    } finally {
      busy = false;
    }
  };

  async function errand({ runId, request, onEvent, signal }) {
    parts ??= (buildParts ?? build)().catch((e) => {
      parts = null;
      log(`live runner: start-up failed (${e.code ?? e.name})`); // the name only: messages can carry URLs
      throw e;
    });
    const { stack, payer, read, directory } = await parts;
    const mcp = await connectMcp();
    const activity = batchedActivity(directory, { log });
    const team = teamCast();
    // The hosted shop writes the errand's quote as W_DIRECTORY at the 402 step, from another
    // instance: this run's presence and handoff batches (the same key) are held around it.
    const surfaceOf = (shopEns) => {
      const surface = stack.surfaceFor(shopEns);
      return {
        ...surface,
        async pay(args) {
          if (args.signature) return payWithRetry(surface.pay, args, { signal, log });
          const release = await activity.hold();
          try {
            return await surface.pay(args);
          } finally {
            release();
          }
        },
      };
    };
    const gated = stack.gate.gatedSign(stack.signerFor(payer.walletRole));
    const storefront = (shopEns) => `${config.site.url}/storefront/${shopEns.split('.')[0]}`;
    const hooks = {
      ...read,
      x402: x402Codec,
      catalog: (shopEns) => surfaceOf(shopEns).catalog(),
      storefrontUrl: async (shopEns) => storefront(shopEns),
      // The payer-side ENS gate runs before every signature; nothing is signed if it refuses.
      // After the site has given up on the run (its time limit), nothing more is signed.
      sign: async (req) => {
        if (signal?.aborted) throw new Error('the run was stopped; nothing signed');
        return gated(req);
      },
      presence: activity.presence,
      handoff: activity.handoff,
    };
    hooks.shopClient = (shopEns, opts) => createShopGateway({ shopEns, surface: surfaceOf(shopEns), mcp, hooks, storefront: storefront(shopEns), names: team.shopAgentNames(shopEns), ...opts });
    try {
      const { runLog, metrics } = await runErrand({ mode: 'live', env: runEnv, buyer: PAYER, hooks, mcp, runId, request, onEvent, signal, secrets: stack.secrets, label: 'live errand on the site (SYNTHETIC story)' });
      log(`live errand ${runId}: ${runLog.result.status}, ${metrics.seconds.toFixed(1)} s, $${metrics.apiCostUsd.toFixed(4)}`);
      return runLog.result;
    } finally {
      // Display rows only: a slow Arkiv write never holds the result back past FLUSH_WAIT_MS.
      await Promise.race([activity.flush().catch(() => {}), new Promise((ok) => setTimeout(ok, FLUSH_WAIT_MS))]);
      await Promise.resolve(mcp.close?.()).catch(() => {});
    }
  }
}
