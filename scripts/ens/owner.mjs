// node scripts/ens/owner.mjs <pause|resume|kill> <agent name> [--fork <loopback url> | --real]
// node scripts/ens/owner.mjs disposable [--fork <loopback url> | --real] [--n <k>]
// The owner's actions on an agent's name (packages/ens/src/actions.mjs), signed with the agent's
// owner wallet from the git-ignored .env (a fork impersonates it and sends nothing to Sepolia).
// The chain id is checked before every signing step; only addresses and hashes are printed.
//   disposable  picks the next free disposable-<n>, makes its key (pnpm wallet:gen --only DISPOSABLE_<n>,
//               one role per run), provisions the name (scripts/ens/real-run.mjs, the two setter grants
//               included) and has the policy writer create its policy (scripts/whitechain/setup.mjs).
//               The wallet needs 0.005 WBT and 1 test USDT first: ask the Coordinator for pnpm funding.

import { execFileSync } from 'node:child_process';
import { createPublicClient, createWalletClient, getAddress, http, isAddressEqual } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';
import { createOwnerActions, createTxRunner, disposableAgent, ensChain, nextFreeDisposable, ownerRoleOf } from '../../packages/ens/index.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';
import { roleAddresses } from '../lib/wallets.mjs';

let envValues = new Map();
installErrorBoundary(() => envValues);

const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const [action, target] = argv;
const forkUrl = arg('--fork');
const real = argv.includes('--real');
const sepolia = config.networks[config.ens.network];
if (!['pause', 'resume', 'kill', 'disposable'].includes(action)) throw new Error('usage: owner.mjs <pause|resume|kill> <name> | disposable  [--fork url | --real]');
if (!forkUrl && !real) throw new Error('say where: --fork <loopback url> or --real (Ethereum Sepolia)');
if (forkUrl && real) throw new Error('use --fork or --real, not both');

const run = (file, args) => execFileSync(process.execPath, [file, ...args], { stdio: 'inherit' });

async function main() {
  const { values } = loadEnv();
  envValues = values;
  let client;
  let explorerTx;
  let walletFor;
  if (forkUrl) {
    if (!/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(forkUrl)) throw new Error('--fork takes a loopback anvil URL only');
    client = createPublicClient({ chain: ensChain(), transport: http(forkUrl, { timeout: 120_000 }) });
    explorerTx = (h) => `fork:${h}`;
    walletFor = async (role, address) => {
      if ((await client.getBalance({ address })) < 10n ** 18n) await client.request({ method: 'anvil_setBalance', params: [address, '0xde0b6b3a7640000'] });
      const wc = createWalletClient({ account: address, chain: ensChain(), transport: http(forkUrl, { timeout: 120_000 }) });
      return { role, address, sendTransaction: (req) => wc.sendTransaction({ account: address, ...req }) };
    };
  } else {
    const c = await clientsFor(config.ens.network, Object.fromEntries(values));
    client = c.publicClient;
    explorerTx = (h) => `${sepolia.explorer}/tx/${h}`;
    walletFor = async (role, address) => {
      const account = privateKeyToAccount(values.get(`${role}_PRIVATE_KEY`));
      if (!isAddressEqual(account.address, address)) throw new Error(`${role}: key and address disagree`);
      const wc = c.walletClient(account);
      return { role, address, sendTransaction: (req) => wc.sendTransaction(req) };
    };
  }
  const chainId = await client.getChainId();
  if (chainId !== sepolia.chainId) throw new Error(`refused: chain ${chainId} is not ${sepolia.name} ${sepolia.chainId}`);

  if (action === 'disposable') {
    const free = await nextFreeDisposable(client);
    const n = arg('--n') ? Number(arg('--n')) : free;
    if (!Number.isInteger(n) || n < 1 || n > 64 || n !== free) throw new Error(`--n must be the next free label (${free}): a killed or live label is never provisioned again`);
    const agent = disposableAgent(n);
    console.log(`next free label: ${agent.name} (wallet role ${agent.walletRole})`);
    const wallet = `${agent.walletRole}_PRIVATE_KEY`;
    if (!values.get(wallet)) run('scripts/secrets/gen-wallet.mjs', ['--only', agent.walletRole]);
    const addr = roleAddresses(loadEnv().values)[agent.walletRole];
    console.log(`${agent.walletRole}: ${addr}`);
    console.log('fund it first if it is new: 0.005 WBT and 1 test USDT (ask the Coordinator: pnpm funding)');
    const where = forkUrl ? ['--fork', forkUrl] : ['--real'];
    run('scripts/ens/real-run.mjs', [...where, '--disposable', String(n), ...(forkUrl && arg('--out') ? ['--out', arg('--out')] : [])]);
    // The setup script signs admin steps too (relayer, merchant floats), so it is not auto-confirmed here.
    console.log(real ? 'next: node scripts/whitechain/setup.mjs (dry run), then --yes: the policy writer creates its 1.00/day policy' : 'fork: the policy writer step is skipped (Whitechain policies are never written from a fork)');
    return;
  }

  const addresses = roleAddresses(values);
  const senders = new Map();
  const actions = createOwnerActions({
    client,
    retryReads: !forkUrl,
    runner: createTxRunner({ client, chainId: sepolia.chainId, explorerTx }),
    senderFor: (role) => {
      if (!senders.has(role)) throw new Error(`${role}: sender not prepared`);
      return senders.get(role);
    },
  });
  const role = ownerRoleOf(target);
  if (!addresses[role]) throw new Error(`${role}: no key in .env`);
  senders.set(role, await walletFor(role, getAddress(addresses[role])));
  const result = await actions[action](target);
  const at = result.receipt ? `block ${result.receipt.blockNumber}, tx ${result.hash}` : result.reason ?? (result.killedEarlier ? 'killed earlier' : '');
  console.log(`${action} ${result.name ?? target}: ${result.changed ? 'done' : 'no change'} (${at})`);
}

await main();
