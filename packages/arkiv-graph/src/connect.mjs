// One connection to Arkiv: with no RPC URL it is ArkivSim (in memory, no keys, no network);
// with a URL it is that node, and the chain id you pass is checked before anything is signed.
// Returns the stock SDK clients over the metered, redacting transport, and, when there is a
// private key, a safe writer. Nothing here reads a file or the environment.

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ArkivSim } from './sim/arkivsim.mjs';
import { arkivChain, arkivClients, arkivTransport, assertChain } from './transport.mjs';
import { createWriter } from './writer.mjs';

// Arkiv sends every entity operation to one fixed address on every network.
export const ENTITY_ADDRESS = `0x44${'0'.repeat(36)}44`;
const SIM_CHAIN_ID = 31337001;
const SIM_URL = 'http://arkivsim.invalid/';

// options: { rpcUrl?, chainId?, privateKey?, log?, sim? }
//   no rpcUrl: ArkivSim, a fresh funded key unless you pass one
//   rpcUrl: chainId is required; without privateKey the connection is read-only (writer: null)
export async function connect({ rpcUrl, chainId, privateKey, log, sim } = {}) {
  const live = Boolean(rpcUrl);
  if (live && !Number.isInteger(chainId)) throw new Error('arkiv-graph: connect needs the chainId of the node you point it at');
  const id = live ? chainId : SIM_CHAIN_ID;
  const secrets = [];
  let fetchFn = globalThis.fetch;
  let url = rpcUrl;
  let simulator = null;
  if (!live) {
    simulator = sim ?? new ArkivSim({ chainId: id, entityContract: ENTITY_ADDRESS });
    fetchFn = simulator.fetch;
    url = SIM_URL;
    privateKey ??= generatePrivateKey();
  } else {
    secrets.push(rpcUrl);
  }
  let account = null;
  if (privateKey) {
    try {
      account = privateKeyToAccount(privateKey);
    } catch {
      throw new Error('arkiv-graph: privateKey is not a valid 32-byte hex key');
    }
    secrets.push(privateKey, privateKey.replace(/^0x/, ''));
  }
  const transport = arkivTransport({ url, fetchFn, secrets, log });
  const chain = arkivChain({ id });
  const { publicClient, walletClient, stats } = arkivClients({ transport, chain, account, pollingInterval: live ? 1_000 : 20 });
  await assertChain(publicClient, id);
  const writer = walletClient ? createWriter({ walletClient, publicClient, entityContract: ENTITY_ADDRESS, log }) : null;
  return { backend: live ? 'node' : 'sim', publicClient, walletClient, writer, owner: account ? account.address.toLowerCase() : null, stats, sim: simulator, chainId: id };
}
