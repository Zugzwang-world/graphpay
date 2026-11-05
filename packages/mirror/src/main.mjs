// pnpm workers: the one workers process (E-2) on the founder's Mac, under
// `caffeinate -ims -w <pid>` (ADR-0056). It mirrors the checkout's events into Graph
// Arkiv as W_LEDGER, folds the recorder's refusals, writes the labelled cast history
// once, patches its heartbeat every 30 s and serves /health, /status, /sync on
// 127.0.0.1. Secrets come from the git-based env loader and are never printed; RPCs
// are chosen by chain id (Whitechain 1874, Rabdi 7794095) or refused.
//
// Env (names only): W_LEDGER_PRIVATE_KEY, ARKIV_ACCESS_KEY, ARKIV_BACKEND (rabdi),
// WHITECHAIN_RPC_URL (optional), GRAPHPAY_CONTRACT and DEPLOY_BLOCK (until the config
// holds them), CONFIRMATIONS (2), DELIVERY_PROMISE_S (7200), E2E_HISTORY_SCALE (0.05;
// 0 skips the history), BOOTSTRAP_FILE (epochs by ENS name), MIRROR_PORT.

import { readFileSync } from 'node:fs';
import { checkoutAbi } from '@graphpay/contracts';
import { config } from '@graphpay/config';
import { connectArkiv } from '@graphpay/money-graph';
import { clientsFor } from '../../../scripts/lib/chains.mjs';
import { loadEnv } from '../../../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../../../scripts/lib/redact.mjs';
import { Actors, candidateNames, castActors } from './actors.mjs';
import { arkivLedger } from './arkiv.mjs';
import { keepAwake } from './awake.mjs';
import { historyParams } from './history.mjs';
import { isZeroNode } from './ids.mjs';
import { Mirror } from './mirror.mjs';
import { OrderBook } from './orders.mjs';
import { DEFAULT_PORT, startServer } from './server.mjs';
import { chainSource } from './source.mjs';
import { createWorkers } from './workers.mjs';

let values = new Map();
installErrorBoundary(() => values);

const { values: loaded } = loadEnv();
values = loaded;
const env = Object.fromEntries(values);
const redact = redactor(values);
const log = (line) => process.stdout.write(`${new Date().toISOString()} ${redact(line)}\n`);

const checkout = config.whitechain.contracts?.checkout ?? {};
const address = (checkout.address ?? env.GRAPHPAY_CONTRACT ?? '').toLowerCase();
const deployBlock = Number(checkout.deployBlock ?? env.DEPLOY_BLOCK);
if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('workers: no checkout address (config whitechain.contracts.checkout or GRAPHPAY_CONTRACT)');
if (!Number.isInteger(deployBlock) || deployBlock <= 0) throw new Error('workers: no deploy block (config whitechain.contracts.checkout or DEPLOY_BLOCK)');

const whitechain = await clientsFor('whitechain', env);
log(`whitechain: ${whitechain.rpcLabel} (chain ${whitechain.chain.id})`);
const arkiv = await connectArkiv({ backend: env.ARKIV_BACKEND ?? 'rabdi', env, role: 'W_LEDGER' });
log(`arkiv: ${arkiv.label} as W_LEDGER ${arkiv.owner}`);

const stream = `chain:${whitechain.chain.id}:${address}`;
const ledger = arkivLedger({ arkiv, stream, log });
const actors = new Actors();
const orders = new OrderBook({ load: (id) => ledger.loadOrder(id), loadSub: (id) => ledger.loadSub(id) });
const source = chainSource({ client: whitechain.publicClient, address, abi: checkoutAbi, chainId: whitechain.chain.id, confirmations: Number(env.CONFIRMATIONS ?? 2) });
const mirror = new Mirror({
  source,
  ledger,
  actors,
  orders,
  stream,
  deployBlock,
  candidates: candidateNames(),
  deliveryPromiseS: env.DELIVERY_PROMISE_S ? Number(env.DELIVERY_PROMISE_S) : undefined,
  log,
});

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
  log,
  redact,
});

const awake = keepAwake();
log(`keep-awake: ${awake.why}`);
await workers.start();
const port = Number(env.MIRROR_PORT ?? DEFAULT_PORT);
await startServer(workers, { port, log, redact });
log(`workers: running as instance ${workers.state.instance}; http://127.0.0.1:${port}/status`);

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
