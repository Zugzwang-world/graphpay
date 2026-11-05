// The connections and the mirror the workers process and the replay tool share: the
// checkout from the config (or GRAPHPAY_CONTRACT and DEPLOY_BLOCK), Whitechain by chain
// id 1874, Arkiv Rabdi as W_LEDGER. Secrets come from the git-based env loader and are
// never printed.

import { checkoutAbi } from '@graphpay/contracts';
import { config } from '@graphpay/config';
import { connectArkiv } from '@graphpay/money-graph';
import { clientsFor } from '../../../scripts/lib/chains.mjs';
import { loadEnv } from '../../../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../../../scripts/lib/redact.mjs';
import { Actors, candidateNames } from './actors.mjs';
import { arkivLedger } from './arkiv.mjs';
import { Mirror } from './mirror.mjs';
import { OrderBook } from './orders.mjs';
import { chainSource } from './source.mjs';

// The env (names only in every message) and a log line writer that redacts its values.
export function loadWorkersEnv() {
  let values = new Map();
  installErrorBoundary(() => values);
  values = loadEnv().values;
  const redact = redactor(values);
  const log = (line) => process.stdout.write(`${new Date().toISOString()} ${redact(line)}\n`);
  return { env: Object.fromEntries(values), redact, log };
}

export function checkoutTarget(env) {
  const checkout = config.whitechain.contracts?.checkout ?? {};
  const address = (checkout.address ?? env.GRAPHPAY_CONTRACT ?? '').toLowerCase();
  const deployBlock = Number(checkout.deployBlock ?? env.DEPLOY_BLOCK);
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('workers: no checkout address (config whitechain.contracts.checkout or GRAPHPAY_CONTRACT)');
  if (!Number.isInteger(deployBlock) || deployBlock <= 0) throw new Error('workers: no deploy block (config whitechain.contracts.checkout or DEPLOY_BLOCK)');
  if (config.whitechain.labDoNotReuse.some((a) => a.toLowerCase() === address)) throw new Error('workers: refused, that checkout is a lab deployment');
  const confirmations = Number(env.CONFIRMATIONS ?? 2);
  if (!Number.isInteger(confirmations) || confirmations < 1) throw new Error('workers: CONFIRMATIONS must be a whole number of at least 1');
  return { address, deployBlock, confirmations };
}

// The chain stream's mirror over real Whitechain and Rabdi. `wrapSource` lets the
// replay tool cap the head.
export async function connectMirror({ env, log, wrapSource = (s) => s }) {
  const { address, deployBlock, confirmations } = checkoutTarget(env);
  const whitechain = await clientsFor('whitechain', env);
  log(`whitechain: ${whitechain.rpcLabel} (chain ${whitechain.chain.id})`);
  const arkiv = await connectArkiv({ backend: env.ARKIV_BACKEND ?? 'rabdi', env, role: 'W_LEDGER' });
  log(`arkiv: ${arkiv.label} as W_LEDGER ${arkiv.owner}`);

  const stream = `chain:${whitechain.chain.id}:${address}`;
  const ledger = arkivLedger({ arkiv, stream, log });
  const actors = new Actors();
  const orders = new OrderBook({ load: (id) => ledger.loadOrder(id), loadSub: (id) => ledger.loadSub(id) });
  const source = wrapSource(chainSource({ client: whitechain.publicClient, address, abi: checkoutAbi, chainId: whitechain.chain.id, confirmations }));
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
  return { whitechain, arkiv, address, deployBlock, confirmations, stream, ledger, actors, orders, source, mirror };
}
