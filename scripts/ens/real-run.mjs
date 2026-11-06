// node scripts/ens/real-run.mjs [--fork <loopback url>] [--real] [--disposable <n>] [--relabel <shop key>=<label>,…] [--out <file>]
// Provisions the namespace under the root (planning/PROMPTS/05-ens-namespace.md, as amended by
// docs/plan/amendments/M5-ens.md): the root, every owner and agent of the active story cast,
// the wildcard and, with --disposable n, disposable-n under the persona. With --relabel, the
// named shops are planned under new labels (same wallet roles, so no funds move); their old
// names stay registered as history and stay in the record.
//   (no flag)   dry run on Ethereum Sepolia: reads only, prints the plan, what exists and the gas check
//   --fork url  a local anvil fork of Sepolia started with --auto-impersonate: transactions are sent
//               from the role addresses without any key (fork transactions never reach Sepolia)
//   --real      Ethereum Sepolia, signed with the role keys from the git-ignored .env
// Every step skips what is already on chain and re-reads after each write. The chain id is
// checked before every signing step. Only addresses and transaction hashes are printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createPublicClient, createWalletClient, formatEther, formatGwei, getAddress, http, isAddressEqual } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { activeCast, config } from '../../packages/config/index.mjs';
import { createProvisioner, createTxRunner, disposableAgent, ENS, ensChain, namespacePlan, permissionedRegistryAbi, parseRelabel, registryState, relabelShops, STATUS } from '../../packages/ens/index.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';
import { roleAddresses } from '../lib/wallets.mjs';

const OPERATOR_GAS_BUDGET = 75_000_000n; // the namespace in the lab: about 68–75M gas (planning/SPEC/IDENTITY_ENS.md §4)
const OWNER_GAS_BASE = 400_000n; // setParent and slack
const OWNER_GAS_PER_GRANTED_AGENT = 600_000n; // two setter grants, with margin
const MARGIN_PCT = 130n;

let envValues = new Map();
installErrorBoundary(() => envValues);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name) => process.argv.includes(name);

const mode = has('--real') ? 'real' : arg('--fork') ? 'fork' : 'dry';
if (has('--real') && arg('--fork')) throw new Error('use --real or --fork, not both');
const disposableN = arg('--disposable') ? Number(arg('--disposable')) : undefined;
// shop key → new label, checked by relabelShops; a bare --relabel is an error, never the old story
if (process.argv.some((a) => a.startsWith('--relabel='))) throw new Error('use --relabel <shop key>=<label>,…, not --relabel=…');
const relabel = parseRelabel(has('--relabel') ? (arg('--relabel') ?? '') : undefined);
const outFile = arg('--out') ?? (mode === 'real' ? 'docs/sessions/identity/namespace.json' : undefined);
const sepolia = config.networks[config.ens.network];

async function main() {
  const { values } = loadEnv();
  envValues = values;
  const addresses = roleAddresses(values);
  const story = activeCast();
  // Owner labels already on chain (the record) are taken too: an old name is never a new one.
  const recorded = existsSync(outFile ?? '') ? JSON.parse(readFileSync(outFile, 'utf8')).owners ?? [] : [];
  const alsoTaken = recorded.map((o) => o.name.split('.')[0]);
  const plan = namespacePlan({ cast: relabel.size > 0 ? relabelShops(story, relabel, { alsoTaken }) : story });
  const extra = disposableN ? [disposableAgent(disposableN)] : [];
  const agents = [...plan.agents, ...extra];
  const roles = [...new Set(['OPERATOR', ...plan.owners.map((o) => o.walletRole), ...agents.map((a) => a.walletRole)])];
  const wallets = {};
  for (const role of roles) {
    if (!addresses[role]) throw new Error(`${role}: no valid key in .env${role.startsWith('DISPOSABLE_') ? ` (run pnpm -s wallet:gen --only ${role})` : ''}`);
    wallets[role] = addresses[role];
  }
  if (!isAddressEqual(wallets.OPERATOR, config.wallets.carried.OPERATOR)) throw new Error('OPERATOR key does not match the carried-over OPERATOR address');

  let client;
  let real;
  let explorerTx = (h) => `${sepolia.explorer}/tx/${h}`;
  let rpcLabel;
  if (mode === 'fork') {
    const url = arg('--fork');
    if (!/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url)) throw new Error('--fork takes a loopback anvil URL only');
    client = createPublicClient({ chain: ensChain(), transport: http(url, { timeout: 120_000 }) });
    rpcLabel = `anvil fork ${url}`;
    explorerTx = (h) => `fork:${h}`;
  } else {
    real = await clientsFor(config.ens.network, Object.fromEntries(values));
    client = real.publicClient;
    rpcLabel = real.rpcLabel;
  }
  const chainId = await client.getChainId();
  if (chainId !== sepolia.chainId) throw new Error(`refused: chain ${chainId} is not ${sepolia.name} ${sepolia.chainId}`);
  console.log(`${mode} run on ${sepolia.name} (chain ${chainId}, via ${rpcLabel})`);
  console.log(`plan: root ${plan.root.name}, ${plan.owners.length} owners, ${agents.length} agents, wildcard ${plan.wildcard.name}`);

  // Gas check (05-ens-namespace.md): OPERATOR ≥ 1.3 × 75M × (base fee + tip); each owner ≥ 1.3 × its planned gas × the same.
  const block = await client.getBlock({ blockTag: 'latest' });
  const tip = await client.estimateMaxPriorityFeePerGas();
  const price = (block.baseFeePerGas ?? 0n) + tip;
  console.log(`gas: base fee ${block.baseFeePerGas} wei + tip ${tip} wei = ${price} wei (${formatGwei(price)} gwei)`);
  const short = [];
  const need = { OPERATOR: (OPERATOR_GAS_BUDGET * price * MARGIN_PCT) / 100n };
  for (const o of plan.owners) {
    const granted = agents.filter((a) => a.selfHeld && a.ownerWalletRole === o.walletRole).length;
    need[o.walletRole] = ((OWNER_GAS_BASE + OWNER_GAS_PER_GRANTED_AGENT * BigInt(granted)) * price * MARGIN_PCT) / 100n;
  }
  for (const [role, wei] of Object.entries(need)) {
    const bal = await client.getBalance({ address: wallets[role] });
    const ok = bal >= wei;
    if (!ok) short.push(role);
    console.log(`  ${role.padEnd(12)} ${wallets[role]} holds ${formatEther(bal)} ETH, needs ${formatEther(wei)}: ${ok ? 'ok' : 'SHORT'}`);
  }
  if (short.length > 0) {
    console.log(`STOP: ${short.join(', ')} short of Sepolia ETH; founder to-do (planning/WALLETS.md §3): about 0.1 Sepolia ETH to OPERATOR, then say done`);
    if (mode !== 'fork') {
      process.exitCode = 2;
      if (mode === 'real') return;
    }
  }

  if (mode === 'dry') {
    const root = await registryState(client, ENS.ethRegistry, plan.root.label);
    console.log(`\n${plan.root.name}: ${['AVAILABLE', 'RESERVED', 'REGISTERED'][root.status]}, held by ${root.latestOwner}, expiry ${root.expiry}`);
    const read = (functionName) => client.readContract({ address: ENS.ethRegistry, abi: permissionedRegistryAbi, functionName, args: [plan.root.label] });
    console.log(`resolver ${await read('getResolver')}, subregistry ${await read('getSubregistry')}`);
    console.log('dry run: nothing signed. Rehearse with --fork, then run with --real.');
    return;
  }

  const senders = {};
  for (const role of roles) {
    const address = getAddress(wallets[role]);
    if (mode === 'fork') {
      // anvil's default tip is 1 gwei, not Sepolia's few wei: fund the impersonated signers on the fork only.
      if ((await client.getBalance({ address })) < 10n ** 18n) await client.request({ method: 'anvil_setBalance', params: [address, '0xde0b6b3a7640000'] });
      const wc = createWalletClient({ account: address, chain: ensChain(), transport: http(arg('--fork'), { timeout: 120_000 }) });
      senders[role] = { role, address, sendTransaction: (req) => wc.sendTransaction({ account: address, ...req }) };
    } else {
      const key = values.get(`${role}_PRIVATE_KEY`);
      const account = privateKeyToAccount(key);
      if (!isAddressEqual(account.address, address)) throw new Error(`${role}: key and address disagree`);
      const wc = real.walletClient(account);
      senders[role] = { role, address, sendTransaction: (req) => wc.sendTransaction(req) };
    }
  }

  const record = loadRecord(outFile);
  const runner = createTxRunner({ client, chainId: sepolia.chainId, explorerTx });
  const provisioner = createProvisioner({
    client,
    runner,
    senders,
    wallets,
    retryReads: mode === 'real',
    onTx: (step, name, hash, receipt) => {
      record.txs.push({ step, name, hash, block: Number(receipt.blockNumber), gasUsed: Number(receipt.gasUsed), at: new Date().toISOString() });
      saveRecord(outFile, record);
    },
  });
  const result = await provisioner.provisionAll(plan, { agents });
  record.updatedAt = new Date().toISOString();
  record.mode = mode;
  record.root = { name: plan.root.name, resolver: result.root.resolver, registry: result.root.registry, expiry: Number(result.root.expiry) };
  // Merged by name: names outside this run's plan (a renamed shop's old name, a killed disposable
  // agent) stay in the record as history.
  record.owners = mergeByName(record.owners, result.owners.map((o) => ({ name: o.name, registry: o.registry, resolver: o.resolver, holder: o.holder })));
  record.agents = mergeByName(record.agents, result.agents.map((a) => ({ name: a.name, node: a.node, epoch: a.epoch, expiry: Number(a.expiry), resolver: a.resolver, registry: a.registry, holder: a.holder })));
  record.wildcard = result.wildcard;
  for (const [key, label] of relabel) {
    const shop = story.shops.find((s) => s.key === key);
    const entry = { shop: key, from: `${shop.label}.${plan.root.name}`, to: `${label}.${plan.root.name}`, walletRole: shop.walletRole };
    record.renamed = record.renamed ?? [];
    if (!record.renamed.some((r) => r.from === entry.from && r.to === entry.to)) record.renamed.push({ ...entry, at: new Date().toISOString() });
  }
  saveRecord(outFile, record);
  const gas = record.txs.reduce((s, t) => s + t.gasUsed, 0);
  console.log(`\ndone: ${record.txs.length} transaction(s) recorded${outFile ? ` in ${outFile}` : ''}, ${gas} gas in all`);
  const leaf = await registryState(client, result.owners[0].registry, agents[0].label);
  console.log(`check: ${agents[0].name} is ${leaf.status === STATUS.REGISTERED ? 'REGISTERED' : 'NOT registered'} (epoch ${leaf.epoch})`);
}

function mergeByName(existing = [], fresh) {
  const out = existing.map((e) => fresh.find((f) => f.name === e.name) ?? e);
  for (const f of fresh) if (!out.some((e) => e.name === f.name)) out.push(f);
  return out;
}

function loadRecord(file) {
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  return { about: 'Written by scripts/ens/real-run.mjs: the namespace contracts and every transaction it sent (public addresses and hashes only).', txs: [] };
}
function saveRecord(file, record) {
  if (!file) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}

await main();
