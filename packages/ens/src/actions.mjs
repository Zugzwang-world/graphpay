// The owner's actions on an agent's name (planning/PROMPTS/06-ens-gate-kill-watcher.md;
// planning/SPEC/IDENTITY_ENS.md §6): pause and resume (graphpay.status, instant and
// reversible), kill (the owner's `unregister`, one-shot per label) and the choice of the next
// free disposable label. Each is signed by the agent's owner wallet, never by the agent.
// The owner's registry and the agent's resolver are re-read from chain state before every
// signing step; nothing here trusts a hand-off file. Timings count from the receipt.

import { encodeFunctionData, getAddress, isAddressEqual, zeroAddress } from 'viem';
import { permissionedRegistryAbi, permissionedResolverAbi } from './abi.generated.mjs';
import { ENS } from './contracts.mjs';
import { dnsEncode, exactName, isUnder, labelId, labelsOf, STATUS, STATUS_NAME } from './names.mjs';
import { disposableAgent, namespacePlan } from './plan.mjs';
import { eventually, retryingReads } from './tx.mjs';
import { registryState, readText } from './reads.mjs';
import { KEYS } from './records.mjs';
import { config } from '@graphpay/config';

const PAUSED = 'paused';
const ACTIVE = 'active';

// The registry that holds `name`'s label, the label and the leaf state, read from chain
// state: root registry → each ancestor's subregistry. A missing ancestor is an error.
export async function locate(client, name) {
  const exact = exactName(name);
  if (!isUnder(exact, config.root.ens) || exact === config.root.ens) throw new Error(`${name}: not a name under ${config.root.ens}`);
  const labels = labelsOf(exact);
  let registry = ENS.rootRegistry;
  for (let i = labels.length - 1; i > 0; i -= 1) {
    registry = await client.readContract({ address: registry, abi: permissionedRegistryAbi, functionName: 'getSubregistry', args: [labels[i]] });
    if (isAddressEqual(registry, zeroAddress)) throw new Error(`${name}: no registry under ${labels[i]}`);
  }
  const label = labels[0];
  const state = await registryState(client, registry, label);
  const resolver = await client.readContract({ address: registry, abi: permissionedRegistryAbi, functionName: 'getResolver', args: [label] });
  return { name: exact, label, registry: getAddress(registry), resolver, state };
}

// The wallet role that signs for an agent's owner: from the plan (the cast and the
// disposable agents), never typed in.
export function ownerRoleOf(name, { plan = namespacePlan(), disposableMax = 64 } = {}) {
  const exact = exactName(name);
  const agent = plan.agents.find((a) => a.name === exact) ?? Array.from({ length: disposableMax }, (_, i) => disposableAgent(i + 1)).find((a) => a.name === exact);
  if (!agent) throw new Error(`${name}: not an agent of the active story`);
  return agent.ownerWalletRole;
}

// ctx: { client, runner (createTxRunner), senderFor(role) → sender, log, retryReads }.
export function createOwnerActions(ctx) {
  const { runner, senderFor, log = console.log } = ctx;
  const client = ctx.retryReads === false ? ctx.client : retryingReads(ctx.client);

  async function setStatus(name, value, step) {
    const at = await locate(client, name);
    if (at.state.status !== STATUS.REGISTERED) return { changed: false, reason: `${at.name} is ${STATUS_NAME[at.state.status]}, not REGISTERED` };
    const before = await readText(client, at.name, KEYS.status);
    if (before === value) return { changed: false, reason: `already ${value}`, name: at.name };
    const sender = senderFor(ownerRoleOf(at.name));
    const data = encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'setText', args: [dnsEncode(at.name), KEYS.status, value] });
    const { hash, receipt } = await runner.send(step, sender, { to: at.resolver, data });
    await eventually(async () => (await readText(client, at.name, KEYS.status)) === value, { what: `${step}: ${KEYS.status} reads ${value}` });
    return { changed: true, name: at.name, hash, receipt };
  }

  // The kill: the owner unregisters the label (§6). One-shot: a killed label (or a lapsed
  // one) is never registered again, so a second call reports "killed earlier".
  async function kill(name) {
    const at = await locate(client, name);
    if (at.state.status !== STATUS.REGISTERED) {
      log(`  ${at.name}: killed earlier (${STATUS_NAME[at.state.status]})`);
      return { changed: false, killedEarlier: true, name: at.name, state: STATUS_NAME[at.state.status] };
    }
    const sender = senderFor(ownerRoleOf(at.name));
    const data = encodeFunctionData({ abi: permissionedRegistryAbi, functionName: 'unregister', args: [labelId(at.label)] });
    const { hash, receipt } = await runner.send('kill', sender, { to: at.registry, data });
    await eventually(async () => (await registryState(client, at.registry, at.label)).status !== STATUS.REGISTERED, { what: `${at.name} unregistered` });
    return { changed: true, name: at.name, hash, receipt };
  }

  return {
    pause: (name) => setStatus(name, PAUSED, 'pause'),
    resume: (name) => setStatus(name, ACTIVE, 'resume'),
    kill,
  };
}

// The next free `disposable-<n>`: the first n whose label has never been registered
// (expiry 0 and AVAILABLE). A killed, lapsed or live label is never reused.
export async function nextFreeDisposable(client, { max = 64, parentRegistry } = {}) {
  const registry = parentRegistry ?? (await locate(client, disposableAgent(1).name)).registry;
  for (let n = 1; n <= max; n += 1) {
    const s = await registryState(client, registry, disposableAgent(n).label);
    if (s.status === STATUS.AVAILABLE && s.expiry === 0n) return n;
  }
  throw new Error(`no free disposable label up to ${max}`);
}
