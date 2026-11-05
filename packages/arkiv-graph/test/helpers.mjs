// Shared test setup: an ArkivSim with its own chain id and a made-up entity contract
// address (never a real network's), and stock SDK clients over the sim's fetch.

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ArkivSim, arkivChain, arkivClients, arkivTransport, createWriter, defineGraph } from '../index.mjs';

export const CHAIN_ID = 31337001;
// The SDK sends every entity operation to Arkiv's fixed entity address (0x44, zeros,
// 0x44), so the sim must answer there. Built at run time: the literal lives only in
// the project's config file.
export const ENTITY_CONTRACT = `0x44${'0'.repeat(36)}44`;

export function setup({ simOptions = {}, writerOptions = {}, account = privateKeyToAccount(generatePrivateKey()) } = {}) {
  const sim = new ArkivSim({ chainId: CHAIN_ID, entityContract: ENTITY_CONTRACT, ...simOptions });
  const transport = arkivTransport({ url: 'http://arkivsim.invalid/', fetchFn: sim.fetch });
  const { publicClient, walletClient } = arkivClients({ transport, chain: arkivChain({ id: CHAIN_ID }), account, pollingInterval: 10 });
  const writer = createWriter({ walletClient, publicClient, entityContract: ENTITY_CONTRACT, recoveryMs: 300, pollMs: 20, ...writerOptions });
  return { sim, transport, publicClient, walletClient, writer, account, owner: account.address.toLowerCase() };
}

// A small social graph: users follow and like; totals count likes and follows, the
// value of a "tip" edge is summed.
export function socialGraph(extra = {}) {
  return defineGraph({
    project: 'demo',
    node: { columns: ['handle:str/i'] },
    edge: { columns: ['note:str/o'] },
    totals: {
      counters: ['likes', 'follows', 'tips', 'tipped'],
      rules: { like: { likes: 'count' }, follow: { follows: 'count' }, tip: { tips: 'count', tipped: 'value' } },
    },
    link: { kinds: ['tip', 'like'] },
    ...extra,
  });
}

export const nodeKey = (i) => `0x${i.toString(16).padStart(64, '0')}`;

export function event(ref, kind, from, to, { value = 0n, ts = 1_760_000_000, epochs = [0, 0], position } = {}) {
  return { ref, kind, from: { node: nodeKey(from), epoch: epochs[0], kind: 'user' }, to: { node: nodeKey(to), epoch: epochs[1], kind: 'user' }, value, ts, position };
}
