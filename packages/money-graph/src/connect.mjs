// One connection to Arkiv for GraphPay code: the backend switch (ARKIV_BACKEND = sim,
// local or rabdi), the stock SDK clients over the metered, redacting transport, a check
// that the node answers Rabdi's chain id before anything is signed, and, when a writer
// role is given, a safe writer whose address must equal the config's for that role.
// The caller passes the env values (process.env on Vercel, the loaded .env in scripts);
// nothing here reads a file or prints a URL.

import { ArkivSim, arkivChain, arkivClients, arkivTransport, assertChain, createWriter } from '@graphpay_ethglobal/arkiv-graph';
import { privateKeyToAccount } from 'viem/accounts';
import { ENTITY_CONTRACT, RABDI, writerAddresses } from './model.mjs';

const SIM_URL = 'http://arkivsim.invalid/';

export function newSim(options = {}) {
  return new ArkivSim({ chainId: RABDI.chainId, entityContract: ENTITY_CONTRACT, ...options });
}

export async function connectArkiv({ backend, env = process.env, role = null, privateKey = null, sim = null, log = null, recoveryMs, pollMs } = {}) {
  const which = backend ?? env.ARKIV_BACKEND ?? 'sim';
  let url;
  let fetchFn = globalThis.fetch;
  const secrets = [];
  let label;
  if (which === 'sim') {
    sim ??= newSim();
    url = SIM_URL;
    fetchFn = sim.fetch;
    label = 'ArkivSim';
  } else if (which === 'local') {
    url = env.ARKIV_RPC_URL;
    if (!url || !/^https?:\/\//.test(url)) throw new Error('money-graph: ARKIV_BACKEND=local needs ARKIV_RPC_URL (http or https)');
    secrets.push(url);
    label = 'local Arkiv node';
  } else if (which === 'rabdi') {
    const accessKey = env[RABDI.accessKeyEnv];
    url = accessKey ? `${RABDI.rpcBase}/${encodeURIComponent(accessKey)}` : RABDI.publicRpcs[0].url;
    if (accessKey) secrets.push(accessKey);
    label = accessKey ? `${RABDI.name} keyed` : `${RABDI.name} public (keyless)`;
  } else {
    throw new Error(`money-graph: unknown ARKIV_BACKEND "${which}" (sim, local or rabdi)`);
  }

  let account = null;
  let owner = null;
  if (role) {
    const writers = writerAddresses();
    if (!Object.hasOwn(writers, role)) throw new Error(`money-graph: ${role} is not an Arkiv writer role`);
    const key = privateKey ?? env[`${role}_PRIVATE_KEY`];
    if (!key) throw new Error(`money-graph: ${role}_PRIVATE_KEY is not set`);
    try {
      account = privateKeyToAccount(key);
    } catch {
      throw new Error(`money-graph: ${role}_PRIVATE_KEY is not a valid key`);
    }
    if (key) secrets.push(key, key.replace(/^0x/, ''));
    owner = account.address.toLowerCase();
    if (which !== 'sim' && owner !== writers[role]) throw new Error(`money-graph: ${role}'s key does not match its configured address`);
  }

  const transport = arkivTransport({ url, fetchFn, secrets, log });
  const chain = arkivChain({ id: RABDI.chainId, name: RABDI.name, symbol: RABDI.nativeSymbol });
  const { publicClient, walletClient, stats } = arkivClients({ transport, chain, account, pollingInterval: which === 'sim' ? 20 : 1_000 });
  await assertChain(publicClient, RABDI.chainId);
  const writer = walletClient
    ? createWriter({
        walletClient,
        publicClient,
        entityContract: ENTITY_CONTRACT,
        log: log ? (e) => log({ ...e, role }) : undefined,
        ...(recoveryMs !== undefined ? { recoveryMs } : {}),
        ...(pollMs !== undefined ? { pollMs } : {}),
      })
    : null;
  return { backend: which, label, publicClient, walletClient, writer, owner, role, sim, stats, chainId: RABDI.chainId };
}
