// pnpm workers: the one workers process (E-2) on the founder's Mac, under
// `caffeinate -ims -w <pid>` (ADR-0056). It mirrors the checkout's events into Graph
// Arkiv as W_LEDGER, folds the recorder's refusals, writes the labelled cast history
// once, patches its heartbeat every 30 s and serves /health, /status, /sync on
// 127.0.0.1. Secrets come from the git-based env loader and are never printed; RPCs
// are chosen by chain id (Whitechain 1874, Rabdi 7794095) or refused.
//
// Env (names only): W_LEDGER_PRIVATE_KEY, ARKIV_ACCESS_KEY, ARKIV_BACKEND (rabdi),
// WHITECHAIN_RPC_URL (optional), GRAPHPAY_CONTRACT and DEPLOY_BLOCK (only when the config
// has no whitechain.contracts.checkout), CONFIRMATIONS (2), DELIVERY_PROMISE_S (7200), E2E_HISTORY_SCALE (0.05;
// 0 skips the history), BOOTSTRAP_FILE (epochs by ENS name), MIRROR_PORT.

import { readFileSync } from 'node:fs';
import { checkoutAbi } from '@graphpay/contracts';
import { castActors } from './actors.mjs';
import { keepAwake } from './awake.mjs';
import { historyParams } from './history.mjs';
import { isZeroNode } from './ids.mjs';
import { DEFAULT_PORT, startServer } from './server.mjs';
import { connectMirror, loadWorkersEnv } from './setup.mjs';
import { createWorkers } from './workers.mjs';

const { env, redact, log } = loadWorkersEnv();
const { whitechain, address, ledger, actors, mirror } = await connectMirror({ env, log });

// The cast with its ENS epochs (the identity track's hand-off; fresh names are epoch 0).
const epochs = env.BOOTSTRAP_FILE ? JSON.parse(readFileSync(env.BOOTSTRAP_FILE, 'utf8')).epochs ?? {} : {};
const scale = Number(env.E2E_HISTORY_SCALE ?? 0.05);
const bindings = {
  async nodeOfWallet(wallet) {
    const node = await whitechain.publicClient.readContract({ address, abi: checkoutAbi, functionName: 'nodeOfWallet', args: [wallet] });
    return isZeroNode(node) ? null : node.toLowerCase();
  },
};

const workers = createWorkers({
  mirror,
  ledger,
  actors,
  bootstrap: castActors({ epochs }),
  history: scale > 0 ? { paramsFor: (endDay) => historyParams({ scale, endDay }) } : null,
  bindings,
  onLost: () => process.exit(1),
  log,
  redact,
});

// Installed before the start: a Ctrl-C during the history still writes the "stopped" beat.
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    log(`workers: ${signal}, stopping`);
    await workers.stop();
    process.exit(0);
  });
}

const awake = keepAwake();
log(`keep-awake: ${awake.why}`);
await workers.start();
const port = Number(env.MIRROR_PORT ?? DEFAULT_PORT);
await startServer(workers, { port, log, redact });
log(`workers: running as instance ${workers.state.instance}; http://127.0.0.1:${port}/status`);
