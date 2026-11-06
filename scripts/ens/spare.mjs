// node scripts/ens/spare.mjs [--yes]
// Keeps one spare disposable agent ready for the kill (the site's POST /api/customer/kill-disposable):
// the lowest disposable-<n> whose key is in .env and whose name is live on Ethereum Sepolia, with its
// spending pass on the Whitechain checkout and the story's daily cap in test USDT. When none is live it
// provisions the next free label (never a killed or lapsed one, planning/SPEC/IDENTITY_ENS.md §4 C):
//   1. ENS: its own resolver and its non-transferable registration (OPERATOR), the two setter grants (the owner);
//   2. the policy: setPolicy as POLICY_WRITER, from the payments setup's plan (scripts/whitechain/plan.mjs);
//   3. the money: FUNDER tops its wallet up to the story's disposable cap in test USDT (no gas: it signs).
// Dry run by default; --yes sends. Each step reads chain state first and is skipped when done; the chain
// id is checked before every send. Only names, addresses and transaction hashes are printed. The site can
// kill only a spare whose key it holds: keep the pool's DISPOSABLE_<n>_PRIVATE_KEY in Vercel
// (pnpm -s secrets:vercel); a next free label without a key stops here (exit 2).
// The workers process runs this after the watcher revoked a killed disposable agent (and once at start).

import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeFunctionData, erc20Abi, formatUnits, getAddress, isAddressEqual, parseEventLogs, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { activeCast, config } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { createProvisioner, createTxRunner, disposableAgent, liveDisposable, locate, namehash, namespacePlan, nextFreeDisposable, permissionedRegistryAbi, registryState, retryingReads, STATUS } from '../../packages/ens/index.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../lib/redact.mjs';
import { roleAddresses } from '../lib/wallets.mjs';
import { policyAction, policyPlan } from '../whitechain/plan.mjs';

const SEND = process.argv.includes('--yes');
// FUNDER keeps at least this much test USDT after a spare's top-up (the payer's top-ups come first).
const FUNDER_USDT_RESERVE_MICRO = 10_000_000n;
const LOCK = join(tmpdir(), 'graphpay-spare.lock');
const LOCK_STALE_MS = 15 * 60_000;
const SITE_ROUTE = `${String(config.site.url).replace(/\/+$/, '')}/api/customer/kill-disposable`;

let envValues = new Map();
installErrorBoundary(() => envValues);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

// One keeper at a time on this Mac (the workers' hook and a manual run must not share nonces). A lock
// whose process is gone (a Ctrl-C of the workers, a timed-out child) or that is old is taken over.
function takeLock() {
  try {
    const pid = Number(readFileSync(LOCK, 'utf8').trim());
    if (!Number.isSafeInteger(pid) || pid <= 0 || !alive(pid) || Date.now() - statSync(LOCK).mtimeMs > LOCK_STALE_MS) unlinkSync(LOCK);
  } catch {
    // no lock yet
  }
  try {
    const fd = openSync(LOCK, 'wx');
    writeSync(fd, String(process.pid));
    closeSync(fd);
  } catch {
    throw Object.assign(new Error(`another spare keeper is running (pid ${readFileSync(LOCK, 'utf8').trim() || '?'}); try again later`), { exitCode: 3 });
  }
  process.on('exit', () => {
    try {
      if (readFileSync(LOCK, 'utf8').trim() === String(process.pid)) unlinkSync(LOCK);
    } catch {
      // gone already
    }
  });
}

function signerOf(values, c, role) {
  const key = values.get(`${role}_PRIVATE_KEY`);
  if (!key) throw new Error(`${role}: no key in .env`);
  const account = privateKeyToAccount(key);
  const wc = c.walletClient(account);
  return { role, address: account.address, sendTransaction: (req) => wc.sendTransaction(req) };
}

async function main() {
  const { values } = loadEnv();
  envValues = values;
  const env = Object.fromEntries(values);
  const roles = roleAddresses(values);
  const cast = activeCast();
  const prefix = cast.disposable.walletRolePrefix;
  const roleOf = (n) => `${prefix}${n}`;
  const pool = Object.keys(roles)
    .filter((r) => r.startsWith(prefix) && /^[1-9][0-9]*$/.test(r.slice(prefix.length)) && roles[r])
    .map((r) => Number(r.slice(prefix.length)))
    .sort((a, b) => a - b);
  if (SEND) takeLock();

  const sepolia = await clientsFor(config.ens.network, env); // refuses any RPC not on 11155111
  const whitechain = await clientsFor('whitechain', env); // refuses any RPC not on 1874
  const client = retryingReads(sepolia.publicClient);
  const wc = whitechain.publicClient;
  const checkout = config.whitechain.contracts?.checkout?.address;
  if (!checkout) throw new Error('no whitechain.contracts.checkout in the config');
  const token = config.whitechain.tokens.usdt;
  console.log(`${SEND ? 'SENDING' : 'dry run (add --yes to send)'}: Sepolia via ${sepolia.rpcLabel}, Whitechain via ${whitechain.rpcLabel}; key pool ${pool.map(roleOf).join(', ') || '(none)'}`);

  // 1. The live spare, or the next free label provisioned on ENS.
  let spare = await liveDisposable(client, pool);
  if (spare) console.log(`1. live spare: ${spare.name} (epoch ${spare.epoch}, holder ${spare.holder})`);
  else {
    const n = await nextFreeDisposable(client);
    const agent = disposableAgent(n);
    if (!pool.includes(n)) {
      console.log(`STOP: the next free label ${agent.name} has no key. Run pnpm wallet:gen --only ${agent.walletRole}, push it to Vercel (pnpm -s secrets:vercel ${agent.walletRole}_PRIVATE_KEY), redeploy, then run this again.`);
      process.exitCode = 2;
      return;
    }
    // The site kills only a spare whose key it holds: its GET lists them. An older deploy without the
    // list is only a warning.
    const site = await fetch(SITE_ROUTE, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (Array.isArray(site?.pool) && !site.pool.includes(n)) {
      console.log(`STOP: the site holds no key for ${agent.name}. Push it (pnpm -s secrets:vercel ${agent.walletRole}_PRIVATE_KEY), redeploy, then run this again.`);
      process.exitCode = 2;
      return;
    }
    if (!Array.isArray(site?.pool)) console.log("   note: the site's key pool could not be read; going on with this Mac's");
    console.log(`1. no live spare; next free label ${agent.name} (wallet ${roles[agent.walletRole]}): ${SEND ? 'provisioning' : 'would provision'} it`);
    if (SEND) {
      const human = namespacePlan().human;
      const at = await locate(client, human.name);
      const ownRegistry = await client.readContract({ address: at.registry, abi: permissionedRegistryAbi, functionName: 'getSubregistry', args: [human.label] });
      if (isAddressEqual(ownRegistry, zeroAddress)) throw new Error(`${human.name} has no registry`);
      const runner = createTxRunner({ client, chainId: sepolia.chain.id, explorerTx: sepolia.explorerTx });
      const senders = { OPERATOR: signerOf(values, sepolia, 'OPERATOR'), [agent.ownerWalletRole]: signerOf(values, sepolia, agent.ownerWalletRole) };
      const wallets = { OPERATOR: senders.OPERATOR.address, [agent.ownerWalletRole]: senders[agent.ownerWalletRole].address, [agent.walletRole]: roles[agent.walletRole] };
      if (!isAddressEqual(wallets.OPERATOR, config.wallets.carried.OPERATOR)) throw new Error('OPERATOR key does not match the carried-over OPERATOR address');
      const provisioner = createProvisioner({ client: sepolia.publicClient, runner, senders, wallets, retryReads: true });
      await provisioner.ensureAgent(agent, { name: human.name, label: human.label, registry: getAddress(ownRegistry), parentRegistry: at.registry });
      spare = await liveDisposable(client, [n]);
      if (!spare) throw new Error(`${agent.name} is not live after provisioning`);
      console.log(`1. provisioned ${spare.name} (epoch ${spare.epoch})`);
    } else {
      // A dry run goes on with the label as it would be: fresh names are epoch 0, held by their own wallet.
      spare = { n, name: agent.name, node: namehash(agent.name), epoch: 0, holder: getAddress(roles[agent.walletRole]) };
    }
  }
  const role = roleOf(spare.n);
  const wallet = getAddress(roles[role]);
  if (!isAddressEqual(spare.holder, wallet)) throw new Error(`${spare.name} is held by ${spare.holder}, not ${role}'s wallet`);
  // Re-read before each send: still REGISTERED, at the same epoch, by the same wallet. A view of the label
  // as never registered (AVAILABLE, expiry 0) is a lagging RPC node, never a kill (an unregister leaves
  // its expiry): the run stops and is tried again, and nothing is revoked on a stale read.
  const stillLive = async () => {
    const st = await registryState(client, spare.registry ?? (await locate(client, spare.name)).registry, disposableAgent(spare.n).label);
    if (st.status === STATUS.AVAILABLE && st.expiry === 0n) throw new Error(`${spare.name} reads as never registered (a lagging RPC node); try again`);
    return st.status === STATUS.REGISTERED && st.epoch === spare.epoch && isAddressEqual(st.latestOwner, wallet);
  };

  // 2. The policy: the payments setup's plan for this name, at its ENS epoch; never lifts a revocation.
  const block = await wc.getBlock();
  const planned = policyPlan({ roles, now: Number(block.timestamp), epochOf: (name) => (name === spare.name ? spare.epoch : 0) }).find((p) => p.ensName === spare.name);
  if (!planned) throw new Error(`${spare.name}: not in the payments setup's plan`);
  const [onChain, bound] = await Promise.all([
    wc.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [planned.node] }),
    wc.readContract({ address: checkout, abi: checkoutAbi, functionName: 'nodeOfWallet', args: [wallet] }),
  ]);
  const step = policyAction(planned, onChain, bound);
  if (step.action === 'stop') throw new Error(`${spare.name}: policy step stopped (${step.why})`);
  if (step.revoked) throw Object.assign(new Error(`${spare.name}: its pass is revoked while its name is live, so the site will not offer it. Retire it (node scripts/ens/owner.mjs kill ${spare.name} --real), then run this again for the next spare`), { exitCode: 2 });
  const cap = `${formatUnits(planned.capMicro, token.decimals)}/day`;
  if (step.action === 'skip') console.log(`2. policy ${spare.name} → ${role}, epoch ${planned.epoch}, cap ${cap}: set already`);
  else {
    console.log(`2. ${step.action} policy ${spare.name} → ${role} ${wallet}, epoch ${planned.epoch}, cap ${cap}, expiry ${step.expiry}${SEND ? '' : ' (dry run)'}`);
    if (SEND) {
      const runner = createTxRunner({ client: wc, chainId: whitechain.chain.id, explorerTx: whitechain.explorerTx });
      const writer = signerOf(values, whitechain, 'POLICY_WRITER');
      if (!(await wc.readContract({ address: checkout, abi: checkoutAbi, functionName: 'isPolicyWriter', args: [writer.address] }))) throw new Error('POLICY_WRITER is not a policy writer on the checkout');
      // A name killed while it was being provisioned gets no pass: the watcher would find none to revoke.
      if (!(await stillLive())) throw new Error(`${spare.name} was killed while being provisioned; no pass set`);
      const data = encodeFunctionData({ abi: checkoutAbi, functionName: 'setPolicy', args: [planned.node, planned.epoch, wallet, false, planned.capMicro, step.expiry] });
      await runner.send('policy', writer, { to: checkout, data });
      // ...and one killed while the pass was being set loses it again at once, the way the watcher revokes.
      if (!(await stillLive())) {
        console.log(`2. ${spare.name} was killed while its pass was being set: revoking it`);
        const revoke = encodeFunctionData({ abi: checkoutAbi, functionName: 'setPolicy', args: [planned.node, planned.epoch, wallet, true, 0n, 0n] });
        await runner.send('revoke', writer, { to: checkout, data: revoke });
        throw new Error(`${spare.name} was killed while being provisioned; its pass is revoked`);
      }
    }
  }

  // 3. The money: the story's disposable cap in test USDT, from FUNDER.
  const target = BigInt(cast.disposable.capMicro);
  const balanceOf = (address) => wc.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
  const held = await balanceOf(wallet);
  if (SEND && !(await stillLive())) throw new Error(`${spare.name} was killed before its top-up; no money sent`);
  if (held >= target) console.log(`3. ${role} holds ${formatUnits(held, token.decimals)} ${token.symbol}: funded already`);
  else {
    const need = target - held;
    const funder = signerOf(values, whitechain, 'FUNDER');
    if (!isAddressEqual(funder.address, config.wallets.carried.FUNDER)) throw new Error('FUNDER key does not match the carried-over FUNDER address');
    const bank = await balanceOf(funder.address);
    if (bank < need + FUNDER_USDT_RESERVE_MICRO) throw new Error(`FUNDER holds ${formatUnits(bank, token.decimals)} ${token.symbol}; a ${formatUnits(need, token.decimals)} top-up would leave less than its ${formatUnits(FUNDER_USDT_RESERVE_MICRO, token.decimals)} reserve`);
    console.log(`3. FUNDER sends ${formatUnits(need, token.decimals)} ${token.symbol} to ${role} ${wallet}${SEND ? '' : ' (dry run)'}`);
    if (SEND) {
      const runner = createTxRunner({ client: wc, chainId: whitechain.chain.id, explorerTx: whitechain.explorerTx });
      const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [wallet, need] });
      const { receipt } = await runner.send('top-up', funder, { to: token.address, data });
      const moved = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).filter((l) => isAddressEqual(l.address, token.address) && isAddressEqual(l.args.from, funder.address) && isAddressEqual(l.args.to, wallet));
      if (moved.length !== 1 || moved[0].args.value !== need) throw new Error('top-up: the receipt does not show exactly this transfer');
    }
  }
  if (SEND) console.log(`spare ready: ${spare.name} (wallet ${wallet}, cap ${cap}, ${formatUnits(await balanceOf(wallet), token.decimals)} ${token.symbol})`);
}

try {
  await main();
} catch (error) {
  // viem's messages can quote a keyed RPC URL: every .env value is redacted first.
  console.log(`spare: ${redactor(envValues)(error.shortMessage ?? error.message)}`);
  process.exitCode = error.exitCode ?? 1;
}
