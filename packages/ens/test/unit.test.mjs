import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeCast, config, network } from '@graphpay/config';
import { decodeFunctionData, getAddress, hexToBytes, keccak256, stringToBytes } from 'viem';
import {
  acceptsValue,
  agentRecords,
  agentSetterGrants,
  ALL_ROLES,
  canonicalId,
  coinResource,
  coinTypeOf,
  DEFAULT_RECORD_NAME,
  disposableAgent,
  dnsEncode,
  encodeInteropAddress,
  encodeInteropList,
  epochOf,
  exactName,
  identityKey,
  isRoleBitmap,
  KEYS,
  labelId,
  NAME_OWNER_TOKEN_ROLES,
  namehash,
  namespacePlan,
  OPERATOR_OWNER_REGISTRY_ROLES,
  OPERATOR_ROOT_ROLES,
  OWNER_REGISTRY_ROOT_ROLES,
  ownerRecords,
  parseAccepts,
  parseInteropList,
  permissionedResolverAbi,
  REGISTRY,
  RESOLVER,
  rootRecords,
  saltOf,
  seedCalls,
  setterCalls,
  STATUS,
  textResource,
  walletRolesOf,
  WHITECHAIN_COIN_TYPE,
  wildcardRecords,
} from '../index.mjs';

const ROOT = config.root.ens;
const plan = namespacePlan();
const WALLET = getAddress(`0x${'ab'.repeat(20)}`); // a stand-in address built at run time, not a real wallet

test('names: labelhash, namehash, DNS encoding and the exact-spelling rule', () => {
  // graphpay's labelhash as read on chain at M0 (docs/technical/FACTS.md, graphpay.eth row)
  assert.equal(labelId(ROOT.split('.')[0]), BigInt('0x320146c7c755e3f9df8c71e0d57ad72b85b487866fe361de07160bbcb9c72ea0'));
  assert.equal(labelId('eth'), BigInt(keccak256(stringToBytes('eth'))));
  assert.equal(namehash(''), `0x${'0'.repeat(64)}`);
  assert.equal(namehash('eth'), '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae'); // the well-known eth node
  assert.equal(dnsEncode('awkweb.eth'), '0x0661776b7765620365746800'); // viem's own packetToBytes example
  assert.throws(() => dnsEncode(''), /default record/);
  const real = plan.agents.find((a) => a.selfHeld).name;
  assert.equal(exactName(real), real);
  assert.throws(() => exactName(real.toUpperCase()), /normalised/, 'an upper-case look-alike is refused, not mapped');
  assert.throws(() => exactName(` ${real}`), 'a leading space is refused');
  assert.deepEqual(STATUS, { AVAILABLE: 0, RESERVED: 1, REGISTERED: 2 });
});

test('names: epoch is the low 32 bits; the canonical id clears them; the identity key is abi.encode(node, uint32)', () => {
  const id = (BigInt(keccak256(stringToBytes('x'))) >> 32n) << 32n;
  assert.equal(epochOf(id), 0, 'fresh names are epoch 0');
  assert.equal(epochOf(id | 2n), 2);
  assert.equal(canonicalId(id | 7n), id);
  const node = namehash(ROOT);
  assert.equal(identityKey(node, 1), keccak256(`${node}${'0'.repeat(63)}1`));
});

test('coin type: Whitechain Sepolia is ENSIP-11 2147485522 (0x80000752), as in the config', () => {
  assert.equal(coinTypeOf(1874), 2147485522n);
  assert.equal(WHITECHAIN_COIN_TYPE, 0x80000752n);
  assert.equal(WHITECHAIN_COIN_TYPE, coinTypeOf(network('whitechain').chainId));
  assert.equal(Number(WHITECHAIN_COIN_TYPE), config.networks.whitechain.ensCoinType);
});

// The ENSIP-31 draft's own example (docs.ens.domains/ensip/31, as of 2026-11-03), byte for byte.
const USDC_ETHEREUM = '0x00010000010114a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDC_BASE = '0x0001000002210514833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const NATIVE_ETH = '0x00010000010100';
const DRAFT_RECORD = `${USDC_ETHEREUM}${USDC_BASE.slice(2)}${NATIVE_ETH.slice(2)}`;

test('ERC-7930: the draft vectors encode byte for byte (27, 28, 7 and 62 bytes)', () => {
  const usdcEth = encodeInteropAddress({ chainId: 1, address: `0x${USDC_ETHEREUM.slice(-40)}` });
  const usdcBase = encodeInteropAddress({ chainId: 8453, address: `0x${USDC_BASE.slice(-40)}` });
  const eth = encodeInteropAddress({ chainId: 1 });
  assert.equal(usdcEth, USDC_ETHEREUM);
  assert.equal(usdcBase, USDC_BASE);
  assert.equal(eth, NATIVE_ETH);
  assert.deepEqual([usdcEth, usdcBase, eth].map((h) => hexToBytes(h).length), [27, 28, 7]);
  const list = encodeInteropList([
    { chainId: 1, address: `0x${USDC_ETHEREUM.slice(-40)}` },
    { chainId: 8453, address: `0x${USDC_BASE.slice(-40)}` },
    { chainId: 1 },
  ]);
  assert.equal(list, DRAFT_RECORD);
  assert.equal(hexToBytes(list).length, 62);
  assert.deepEqual(parseInteropList(DRAFT_RECORD).map((e) => [e.chainId, e.address && e.address.toLowerCase()]), [
    [1, `0x${USDC_ETHEREUM.slice(-40)}`],
    [8453, `0x${USDC_BASE.slice(-40)}`],
    [1, null],
  ]);
});

test('ERC-7930: the accepts value for test USDT on 1874 is the configured 28 bytes and parses to chain and token', () => {
  const usdt = config.whitechain.tokens.usdt;
  assert.equal(acceptsValue(), usdt.erc7930, 'the encoder output equals the value stored in the config, byte for byte');
  assert.equal(acceptsValue(), `0x00010000020752${'14'}${usdt.address.slice(2).toLowerCase()}`, 'version 1, eip155, 2-byte reference 0x0752, 20-byte token');
  assert.equal(hexToBytes(acceptsValue()).length, 28);
  assert.deepEqual(parseAccepts(acceptsValue()), [{ chainId: network('whitechain').chainId, token: getAddress(usdt.address) }]);
});

test('ERC-7930: a malformed record is ignored whole; empty means no preference', () => {
  const good = acceptsValue();
  const malformed = [
    `${good}00`, // a trailing byte
    good.slice(0, -2), // truncated address
    `0x0002${good.slice(6)}`, // version 2
    `0x00010000020007${good.slice(14)}`, // chain reference with a leading zero
    `${good.slice(0, 16)}13${good.slice(18, -2)}`, // address length 19
    `${USDC_ETHEREUM}${good.slice(2)}ff`, // one good entry, then garbage: the whole record goes
    '0xzz',
    'not hex',
  ];
  for (const m of malformed) assert.deepEqual(parseAccepts(m), [], m);
  assert.equal(parseInteropList(`${good}00`), null);
  assert.deepEqual(parseAccepts(''), []);
  assert.deepEqual(parseAccepts('0x'), []);
  assert.deepEqual(parseAccepts(null), []);
});

test('roles: the bitmaps of planning/SPEC/IDENTITY_ENS.md §3', () => {
  assert.equal(REGISTRY.CAN_TRANSFER_ADMIN, 1n << 156n);
  assert.equal(ALL_ROLES, BigInt(`0x${'1'.repeat(64)}`));
  assert.equal(OPERATOR_ROOT_ROLES, 0x1111101n);
  assert.equal(OPERATOR_OWNER_REGISTRY_ROLES, REGISTRY.REGISTRAR);
  assert.equal(OWNER_REGISTRY_ROOT_ROLES, (0x11n << 128n) * 0x1000n + 0x1111100n);
  assert.equal(OWNER_REGISTRY_ROOT_ROLES & REGISTRY.REGISTRAR, 0n, 'only OPERATOR registers agents');
  assert.equal(NAME_OWNER_TOKEN_ROLES, 0x1110000n);
  assert.equal(NAME_OWNER_TOKEN_ROLES & REGISTRY.CAN_TRANSFER_ADMIN, 0n, 'owner names are non-transferable');
  assert.equal(RESOLVER.SET_TEXT, 16n);
  assert.equal(RESOLVER.SET_ADDRESS, 1n);
  for (const b of [OPERATOR_ROOT_ROLES, OWNER_REGISTRY_ROOT_ROLES, NAME_OWNER_TOKEN_ROLES, ALL_ROLES]) assert.ok(isRoleBitmap(b));
  assert.ok(!isRoleBitmap(2n));
});

test('plan: every name comes from the story config under the configured root', () => {
  const cast = activeCast();
  assert.equal(plan.root.name, ROOT);
  assert.equal(plan.owners.length, 1 + cast.shops.length);
  assert.equal(plan.agents.length, cast.buyerAgents.length + cast.workingAgents.length + cast.shops.length * cast.shopAgents.length);
  const names = [plan.root.name, ...plan.owners.map((o) => o.name), ...plan.agents.map((a) => a.name), plan.wildcard.name];
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.equal(exactName(n), n);
  assert.equal(plan.owners[0].name, `${cast.persona.label}.${ROOT}`);
  for (const s of cast.shops) assert.ok(plan.owners.some((o) => o.kind === 'shop' && o.name === `${s.label}.${ROOT}` && o.walletRole === s.walletRole));
  assert.equal(plan.wildcard.name, `${config.ens.namespace.wildcardLabel}.${ROOT}`);
});

test('plan: one wallet per paying agent; non-paying agents are held by their owner and publish the no-policy cap', () => {
  const payers = plan.agents.filter((a) => a.pays);
  assert.ok(payers.length > 0);
  assert.equal(new Set(payers.map((a) => a.walletRole)).size, payers.length);
  for (const a of payers) {
    assert.ok(a.selfHeld && a.walletRole !== a.ownerWalletRole, a.key);
    assert.ok(a.capMicro > 0n, a.key);
    assert.match(a.context, new RegExp(config.ens.texts.custodyOwn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const story = activeCast();
  for (const a of [...story.buyerAgents, ...story.workingAgents].filter((x) => x.pays)) {
    assert.equal(plan.agents.find((p) => p.key === a.key).capMicro, BigInt(a.capMicro), `${a.key} cap from the story`);
  }
  for (const a of plan.agents.filter((x) => !x.pays)) {
    assert.ok(!a.selfHeld && a.walletRole === a.ownerWalletRole, a.key);
    assert.equal(a.capMicro, BigInt(config.ens.namespace.capMicroWithoutPolicy));
    assert.ok(a.context.includes(config.ens.texts.custodyOwner), a.key);
  }
  for (const a of plan.agents) assert.equal(a.ttlDays, config.ens.namespace.agentTtlDays);
  const d = disposableAgent(2);
  assert.equal(d.name, `${story.disposable.labelPrefix}2.${plan.owners[0].name}`);
  assert.equal(d.walletRole, `${story.disposable.walletRolePrefix}2`);
  assert.equal(d.capMicro, BigInt(story.disposable.capMicro));
  assert.equal(d.ttlDays, story.disposable.expiryDays);
  assert.ok(d.selfHeld && d.pays);
  assert.throws(() => disposableAgent(0));
  assert.ok(walletRolesOf(plan).includes(payers[0].walletRole));
});

test('records: ENSIP-26 texts point at the hosted MCP and the site; shops publish the payee and accepts', () => {
  const root = Object.fromEntries(rootRecords(plan.root).map((r) => [r.key, r.value]));
  assert.equal(root[KEYS.agentEndpointMcp], `${config.site.url}${config.site.mcpPath}`);
  assert.equal(root[KEYS.agentEndpointWeb], config.site.url);
  assert.equal(root[KEYS.agentContext], config.ens.texts.root);
  const shop = plan.owners.find((o) => o.kind === 'shop');
  const shopRecords = ownerRecords(shop, WALLET);
  assert.ok(shopRecords.some((r) => r.type === 'addr' && r.coinType === WHITECHAIN_COIN_TYPE && r.value === WALLET));
  assert.ok(shopRecords.some((r) => r.key === KEYS.acceptsText && r.value === config.whitechain.tokens.usdt.erc7930));
  assert.ok(!ownerRecords(plan.owners[0], WALLET).some((r) => r.key === KEYS.acceptsText), 'only shops publish accepts');
  const agent = plan.agents.find((a) => a.pays);
  const ar = agentRecords(agent, WALLET);
  const text = Object.fromEntries(ar.filter((r) => r.type === 'text').map((r) => [r.key, r.value]));
  assert.deepEqual(
    { status: text[KEYS.status], cap: text[KEYS.capMicro], principal: text[KEYS.principal], kind: text[KEYS.kind], mcp: text[KEYS.agentEndpointMcp] },
    { status: 'active', cap: agent.capMicro.toString(), principal: agent.owner, kind: 'agent', mcp: `${config.site.url}${config.site.mcpPath}` },
  );
  assert.match(text[KEYS.capMicro], /^\d+$/);
  assert.deepEqual(ar.filter((r) => r.type === 'addr').map((r) => r.coinType), [60n, WHITECHAIN_COIN_TYPE]);
  assert.ok(!(`${KEYS.agentEndpointMcp.replace('mcp', 'a2a')}` in text), 'agent-endpoint[a2a] is dropped');
});

test('records: seeds use the name itself; only the wildcard writes the default record, and never a status or cap', () => {
  const agent = plan.agents[0];
  for (const call of seedCalls(agent.name, agentRecords(agent, WALLET))) {
    const { args } = decodeFunctionData({ abi: permissionedResolverAbi, data: call });
    assert.equal(args[0], dnsEncode(agent.name));
  }
  const wild = wildcardRecords(plan.wildcard);
  assert.deepEqual(wild.map((r) => r.key).sort(), [KEYS.agentContext, KEYS.kind, KEYS.synthetic].sort());
  assert.ok(!wild.some((r) => r.key === KEYS.status || r.key === KEYS.capMicro));
  for (const call of setterCalls(DEFAULT_RECORD_NAME, wild)) {
    assert.equal(decodeFunctionData({ abi: permissionedResolverAbi, data: call }).args[0], '0x00');
  }
});

test('records: an agent with its own wallet gets exactly two setter grants: agent-context and its Whitechain address', () => {
  const grants = agentSetterGrants(WALLET);
  assert.equal(grants.length, 2);
  const inner = grants.map((g) => {
    const { functionName, args } = decodeFunctionData({ abi: permissionedResolverAbi, data: g });
    assert.equal(functionName, 'grantSetterRoles');
    assert.equal(args[1], WALLET);
    return decodeFunctionData({ abi: permissionedResolverAbi, data: args[0] });
  });
  assert.deepEqual([inner[0].functionName, inner[0].args[1]], ['setText', KEYS.agentContext]);
  assert.deepEqual([inner[1].functionName, inner[1].args[1]], ['setAddress', WHITECHAIN_COIN_TYPE]);
  for (const key of [KEYS.capMicro, KEYS.status, KEYS.acceptsText, KEYS.agentEndpointMcp, KEYS.principal, KEYS.kind]) {
    assert.ok(!inner.some((c) => c.args[1] === key), `no grant for ${key}`);
  }
  // PermissionedResolver.decodeSetter: resource = keccak256(bytes(key)) or keccak256(abi.encodePacked(coinType))
  assert.equal(textResource(KEYS.agentContext), BigInt(keccak256(stringToBytes(KEYS.agentContext))));
  assert.equal(coinResource(60n), BigInt(keccak256(`0x${'0'.repeat(62)}3c`)));
});

test('salts are deterministic per kind and name', () => {
  assert.equal(saltOf('resolver', ROOT), saltOf('resolver', ROOT));
  assert.notEqual(saltOf('resolver', ROOT), saltOf('registry', ROOT));
  assert.notEqual(saltOf('resolver', plan.agents[0].name), saltOf('resolver', plan.agents[1].name));
});
