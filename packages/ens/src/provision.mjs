// Provisioning the namespace under the root (planning/SPEC/IDENTITY_ENS.md §4, as amended by
// docs/plan/amendments/M5-ens.md): (A) the root's resolver and registry, (B) each owner's own
// registry and resolver, (C) each agent's own resolver, its non-transferable registration and,
// for an agent that holds its own wallet, its two setter grants, (D) the synthetic wildcard.
// Every step reads chain state first and is skipped when already done; every write is re-read
// until it shows. A label that was registered before and is no longer is refused: a killed
// label is never provisioned again.

import { decodeFunctionResult, encodeFunctionData, getAddress, isAddressEqual, zeroAddress } from 'viem';
import { permissionedRegistryAbi, permissionedResolverAbi, userRegistryAbi, verifiableFactoryAbi } from './abi.generated.mjs';
import { ENS, profileAbi } from './contracts.mjs';
import { dnsEncode, labelId, namehash, STATUS, STATUS_NAME } from './names.mjs';
import {
  agentRecords,
  agentSetterGrants,
  coinResource,
  DEFAULT_RECORD_NAME,
  KEYS,
  ownerRecords,
  rootRecords,
  saltOf,
  setterCalls,
  textResource,
  wildcardRecords,
  WHITECHAIN_COIN_TYPE,
} from './records.mjs';
import { registryState } from './reads.mjs';
import {
  AGENT_TOKEN_ROLES,
  ALL_ROLES,
  NAME_OWNER_TOKEN_ROLES,
  OPERATOR_OWNER_REGISTRY_ROLES,
  OPERATOR_ROOT_ROLES,
  OWNER_REGISTRY_ROOT_ROLES,
  RESOLVER,
} from './roles.mjs';
import { eventually, retryingReads } from './tx.mjs';

const DAY = 86_400n;

// ctx: { client, runner (createTxRunner), senders: { ROLE: sender }, wallets: { ROLE: address },
//        log, onTx(step, name, hash, receipt) }. An owner passed to ensureAgent is
// { name, label, registry (its own), parentRegistry (the one holding its label) }.
export function createProvisioner(ctx) {
  const { runner, senders, wallets, log = console.log, onTx = () => {} } = ctx;
  const client = ctx.retryReads === false ? ctx.client : retryingReads(ctx.client);
  const operator = () => senderOf('OPERATOR');

  function senderOf(role) {
    const s = senders[role];
    if (!s) throw new Error(`no signer for ${role}`);
    return s;
  }
  function walletOf(role) {
    const a = wallets[role];
    if (!a) throw new Error(`no address for wallet role ${role}`);
    return getAddress(a);
  }
  async function send(step, name, sender, request) {
    const { hash, receipt } = await runner.send(step, sender, request);
    onTx(step, name, hash, receipt);
    return hash;
  }

  const readReg = (address, functionName, args) => client.readContract({ address, abi: permissionedRegistryAbi, functionName, args });
  const hasCode = async (address) => {
    const code = await client.getCode({ address });
    return code !== undefined && code !== '0x';
  };
  const predict = (salt) => client.readContract({ address: ENS.factory, abi: verifiableFactoryAbi, functionName: 'predictProxyAddress', args: [operator().address, salt] });

  // A factory proxy deployed by OPERATOR at a deterministic address (skipped if it exists).
  async function ensureProxy(step, name, kind, implementation, initData) {
    const salt = saltOf(kind, name);
    const address = getAddress(await predict(salt));
    if (await hasCode(address)) {
      log(`  ${step}: ${kind} of ${name} already at ${address}`);
    } else {
      const data = encodeFunctionData({ abi: verifiableFactoryAbi, functionName: 'deployProxy', args: [implementation, salt, initData] });
      await send(step, name, operator(), { to: ENS.factory, data });
      await eventually(() => hasCode(address), { what: `${step} ${kind} code` });
      log(`  ${step}: ${kind} of ${name} deployed at ${address}`);
    }
    const impl = await client.readContract({ address: ENS.factory, abi: verifiableFactoryAbi, functionName: 'verifyContract', args: [address] });
    if (!isAddressEqual(impl, implementation)) throw new Error(`${step}: ${address} is not a factory proxy of the expected implementation`);
    return address;
  }

  const setterCallsOf = (name, records) => setterCalls(dnsEncode(name), records);
  const resolverInit = (holder, calls) =>
    encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'initialize', args: [[{ account: holder, roleBitmap: ALL_ROLES }], calls] });
  const registryInit = (grants) => encodeFunctionData({ abi: userRegistryAbi, functionName: 'initialize', args: [grants] });

  // A record read on the resolver itself (works before any registry points at it).
  async function readOwn(resolver, dnsName, node, record) {
    const call =
      record.type === 'text'
        ? { functionName: 'text', args: [node, record.key] }
        : { functionName: 'addr', args: [node, record.coinType] };
    const data = encodeFunctionData({ abi: profileAbi, ...call });
    const out = await client.readContract({ address: resolver, abi: permissionedResolverAbi, functionName: 'resolve', args: [dnsName, data] });
    return decodeFunctionResult({ abi: profileAbi, functionName: call.functionName, data: out });
  }
  const same = (record, value) => (record.type === 'text' ? value === record.value : typeof value === 'string' && value.toLowerCase() === record.value.toLowerCase());

  // Records are written once, in the resolver's initialize call. On a resolver that already exists
  // they are only compared with the plan: a difference is logged as DRIFT and never rewritten, because
  // the owner may legitimately have paused the name or changed its cap, and a re-run must not undo it.
  async function checkRecords(step, name, resolver, records, dnsName = dnsEncode(name)) {
    const node = dnsName === DEFAULT_RECORD_NAME ? `0x${'0'.repeat(64)}` : namehash(name);
    const drift = [];
    for (const r of records) if (!same(r, await readOwn(resolver, dnsName, node, r))) drift.push(r.type === 'text' ? r.key : `addr ${r.coinType}`);
    if (drift.length > 0) log(`  ${step}: DRIFT on ${name}: ${drift.join(', ')} differ from the plan (left as they are)`);
    return drift;
  }

  const expiryOf = async (registry, label) => (await registryState(client, registry, label)).expiry;
  const latestTime = async () => (await client.getBlock({ blockTag: 'latest' })).timestamp;

  // (A) The root, already registered bare by OPERATOR (ADR-0018).
  async function ensureRoot(rootEntry) {
    const op = operator();
    log(`\nA. root ${rootEntry.name}`);
    const parentLabel = rootEntry.label;
    const state = await registryState(client, ENS.ethRegistry, parentLabel);
    if (state.status !== STATUS.REGISTERED) throw new Error(`A: ${rootEntry.name} is ${STATUS_NAME[state.status]}, not REGISTERED`);
    if (!isAddressEqual(state.latestOwner, op.address)) throw new Error(`A: ${rootEntry.name} is held by ${state.latestOwner}, not OPERATOR`);

    const rRoot = await ensureProxy('A1', rootEntry.name, 'resolver', ENS.resolverImpl, resolverInit(op.address, setterCallsOf(rootEntry.name, rootRecords(rootEntry))));
    await checkRecords('A1', rootEntry.name, rRoot, rootRecords(rootEntry));

    if (!isAddressEqual(await readReg(ENS.ethRegistry, 'getResolver', [parentLabel]), rRoot)) {
      await send('A2', rootEntry.name, op, { to: ENS.ethRegistry, data: encodeFunctionData({ abi: permissionedRegistryAbi, functionName: 'setResolver', args: [labelId(parentLabel), rRoot] }) });
      await eventually(async () => isAddressEqual(await readReg(ENS.ethRegistry, 'getResolver', [parentLabel]), rRoot), { what: 'A2 resolver' });
    } else log('  A2: resolver already set');

    const urRoot = await ensureProxy('A3', rootEntry.name, 'registry', ENS.userRegistryImpl, registryInit([{ account: op.address, roleBitmap: OPERATOR_ROOT_ROLES }]));

    if (!isAddressEqual(await readReg(ENS.ethRegistry, 'getSubregistry', [parentLabel]), urRoot)) {
      await send('A4', rootEntry.name, op, { to: ENS.ethRegistry, data: encodeFunctionData({ abi: permissionedRegistryAbi, functionName: 'setSubregistry', args: [labelId(parentLabel), urRoot] }) });
      await eventually(async () => isAddressEqual(await readReg(ENS.ethRegistry, 'getSubregistry', [parentLabel]), urRoot), { what: 'A4 subregistry' });
    } else log('  A4: subregistry already set');

    const parentOk = async () => {
      const [parent, label] = await readReg(urRoot, 'getParent', []);
      return isAddressEqual(parent, ENS.ethRegistry) && label === parentLabel;
    };
    if (!(await parentOk())) {
      await send('A5', rootEntry.name, op, { to: urRoot, data: encodeFunctionData({ abi: userRegistryAbi, functionName: 'setParent', args: [ENS.ethRegistry, parentLabel] }) });
      await eventually(parentOk, { what: 'A5 parent' });
    } else log('  A5: parent already set');

    return { resolver: rRoot, registry: urRoot, expiry: state.expiry };
  }

  // The on-chain holder of a registered label must be the signer about to act for it.
  async function assertHolder(step, registry, label, sender) {
    const s = await registryState(client, registry, label);
    if (s.status !== STATUS.REGISTERED || !isAddressEqual(s.latestOwner, sender.address)) {
      throw new Error(`${step}: refused, ${sender.role} ${sender.address} is not the on-chain holder of ${label}`);
    }
  }

  // (B) An owner (human or shop) with its own registry and resolver under UR_root.
  async function ensureOwner(owner, root) {
    const holder = walletOf(owner.walletRole);
    const op = operator();
    log(`\nB. owner ${owner.name} (${owner.kind}, held by ${owner.walletRole} ${holder})`);
    const ur = await ensureProxy('B1', owner.name, 'registry', ENS.userRegistryImpl, registryInit([
      { account: holder, roleBitmap: OWNER_REGISTRY_ROOT_ROLES },
      { account: op.address, roleBitmap: OPERATOR_OWNER_REGISTRY_ROLES },
    ]));
    const records = ownerRecords(owner, holder);
    const r = await ensureProxy('B2', owner.name, 'resolver', ENS.resolverImpl, resolverInit(holder, setterCallsOf(owner.name, records)));
    await checkRecords('B2', owner.name, r, records);

    const s = await registryState(client, root.registry, owner.label);
    if (s.status === STATUS.AVAILABLE && s.expiry === 0n) {
      const data = encodeFunctionData({ abi: userRegistryAbi, functionName: 'register', args: [owner.label, holder, ur, r, NAME_OWNER_TOKEN_ROLES, root.expiry] });
      await send('B3', owner.name, op, { to: root.registry, data });
      await eventually(async () => (await registryState(client, root.registry, owner.label)).status === STATUS.REGISTERED, { what: 'B3 registration' });
    } else if (s.status === STATUS.REGISTERED) {
      if (!isAddressEqual(s.latestOwner, holder)) throw new Error(`B3: ${owner.name} is held by ${s.latestOwner}, not ${owner.walletRole}`);
      log('  B3: already registered');
    } else throw new Error(`B3: ${owner.name} is ${STATUS_NAME[s.status]} after an earlier registration; refusing to provision it again`);
    await eventually(async () => {
      const [sub, res] = await Promise.all([readReg(root.registry, 'getSubregistry', [owner.label]), readReg(root.registry, 'getResolver', [owner.label])]);
      return isAddressEqual(sub, ur) && isAddressEqual(res, r);
    }, { what: `B3 ${owner.name} points at its registry and resolver` });

    const parentOk = async () => {
      const [parent, label] = await readReg(ur, 'getParent', []);
      return isAddressEqual(parent, root.registry) && label === owner.label;
    };
    if (!(await parentOk())) {
      const signer = senderOf(owner.walletRole);
      await assertHolder('B4', root.registry, owner.label, signer);
      await send('B4', owner.name, signer, { to: ur, data: encodeFunctionData({ abi: userRegistryAbi, functionName: 'setParent', args: [root.registry, owner.label] }) });
      await eventually(parentOk, { what: 'B4 parent' });
    } else log('  B4: parent already set');
    return { name: owner.name, registry: ur, resolver: r, holder };
  }

  // (C) An agent under its owner: its own resolver, a registration with role bitmap 0 and, if
  // it holds its own wallet, the two setter grants (one multicall, else two transactions).
  async function ensureAgent(agent, ownerInfo, { now } = {}) {
    const holder = walletOf(agent.walletRole);
    const ownerWallet = walletOf(agent.ownerWalletRole);
    const op = operator();
    log(`\nC. agent ${agent.name} (${agent.selfHeld ? `own wallet ${agent.walletRole}` : `held by ${agent.ownerWalletRole}`} ${holder}, cap ${agent.capMicro})`);
    const records = agentRecords(agent, holder);
    const r = await ensureProxy('C1', agent.name, 'resolver', ENS.resolverImpl, resolverInit(ownerWallet, setterCallsOf(agent.name, records)));
    await checkRecords('C1', agent.name, r, records);

    const s = await registryState(client, ownerInfo.registry, agent.label);
    if (s.status === STATUS.AVAILABLE && s.expiry === 0n) {
      const t = now ?? (await latestTime());
      const expiry = t + BigInt(agent.ttlDays) * DAY;
      const data = encodeFunctionData({ abi: userRegistryAbi, functionName: 'register', args: [agent.label, holder, zeroAddress, r, AGENT_TOKEN_ROLES, expiry] });
      await send('C2', agent.name, op, { to: ownerInfo.registry, data });
      await eventually(async () => (await registryState(client, ownerInfo.registry, agent.label)).status === STATUS.REGISTERED, { what: 'C2 registration' });
    } else if (s.status === STATUS.REGISTERED) {
      if (!isAddressEqual(s.latestOwner, holder)) throw new Error(`C2: ${agent.name} is held by ${s.latestOwner}, not ${agent.walletRole}`);
      log('  C2: already registered');
    } else throw new Error(`C2: ${agent.name} is ${STATUS_NAME[s.status]} after an earlier registration; a killed label is never provisioned again`);
    await eventually(async () => isAddressEqual(await readReg(ownerInfo.registry, 'getResolver', [agent.label]), r), { what: `C2 ${agent.name} points at its resolver` });

    if (agent.selfHeld) await ensureGrants(agent, r, holder, ownerInfo);
    const st = await registryState(client, ownerInfo.registry, agent.label);
    return { name: agent.name, node: namehash(agent.name), epoch: st.epoch, expiry: st.expiry, resolver: r, registry: ownerInfo.registry, holder, tokenId: st.tokenId };
  }

  const roles = (resolver, resource, account) => client.readContract({ address: resolver, abi: permissionedResolverAbi, functionName: 'roles', args: [resource, account] });
  async function grantsInPlace(resolver, holder) {
    const [t, a] = await Promise.all([roles(resolver, textResource(KEYS.agentContext), holder), roles(resolver, coinResource(WHITECHAIN_COIN_TYPE), holder)]);
    return { text: (t & RESOLVER.SET_TEXT) !== 0n, addr: (a & RESOLVER.SET_ADDRESS) !== 0n };
  }

  async function ensureGrants(agent, resolver, holder, ownerInfo) {
    const have = await grantsInPlace(resolver, holder);
    if (have.text && have.addr) {
      log('  C3: setter grants already in place');
      return;
    }
    const signer = senderOf(agent.ownerWalletRole);
    // The owner signs: it must hold the owner's name on chain.
    await assertHolder('C3', ownerInfo.parentRegistry, ownerInfo.label, signer);
    const [grantText, grantAddr] = agentSetterGrants(holder);
    const missing = [!have.text && grantText, !have.addr && grantAddr].filter(Boolean);
    let data = missing.length === 1 ? missing[0] : encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'multicall', args: [missing] });
    if (missing.length > 1) {
      try {
        await client.estimateGas({ account: signer.address, to: resolver, data });
      } catch {
        log('  C3: the multicall of both grants does not simulate; sending them one by one');
        data = null;
      }
    }
    if (data) await send('C3', agent.name, signer, { to: resolver, data });
    else for (const [i, d] of missing.entries()) await send(`C3.${i + 1}`, agent.name, signer, { to: resolver, data: d });
    await eventually(async () => {
      const g = await grantsInPlace(resolver, holder);
      return g.text && g.addr;
    }, { what: 'C3 grants' });
  }

  // (D) The synthetic wildcard: a RESERVED label whose resolver holds only a default record.
  async function ensureWildcard(entry, root) {
    const op = operator();
    log(`\nD. wildcard ${entry.name}`);
    const records = wildcardRecords(entry);
    const calls = setterCalls(DEFAULT_RECORD_NAME, records);
    const r = await ensureProxy('D1', entry.name, 'resolver', ENS.resolverImpl, resolverInit(op.address, calls));
    await checkRecords('D1', entry.name, r, records, DEFAULT_RECORD_NAME);
    const s = await registryState(client, root.registry, entry.label);
    if (s.status === STATUS.AVAILABLE && s.expiry === 0n) {
      const data = encodeFunctionData({ abi: userRegistryAbi, functionName: 'register', args: [entry.label, zeroAddress, zeroAddress, r, 0n, root.expiry] });
      await send('D2', entry.name, op, { to: root.registry, data });
      await eventually(async () => (await registryState(client, root.registry, entry.label)).status === STATUS.RESERVED, { what: 'D2 reservation' });
    } else if (s.status === STATUS.RESERVED) log('  D2: already reserved');
    else throw new Error(`D2: ${entry.name} is ${STATUS_NAME[s.status]}, not RESERVED`);
    await eventually(async () => isAddressEqual(await readReg(root.registry, 'getResolver', [entry.label]), r), { what: 'D2 the wildcard points at its resolver' });
    return { name: entry.name, resolver: r };
  }

  // The whole plan, in order. Returns what the hand-off table needs.
  async function provisionAll(plan, { agents = plan.agents } = {}) {
    const root = await ensureRoot(plan.root);
    const owners = new Map();
    for (const o of plan.owners) owners.set(o.name, { ...(await ensureOwner(o, root)), label: o.label, parentRegistry: root.registry });
    const results = [];
    for (const a of agents) results.push(await ensureAgent(a, owners.get(a.owner)));
    const wildcard = await ensureWildcard(plan.wildcard, root);
    return { root, owners: [...owners.values()], agents: results, wildcard };
  }

  return { ensureRoot, ensureOwner, ensureAgent, ensureWildcard, provisionAll, grantsInPlace };
}
