// node scripts/ens/acceptance.mjs [--fork <loopback url>] [--relabel <shop key>=<label>,…]
// Read-only checks on Ethereum Sepolia (or a fork): B1 (every name registered, epoch, own resolver,
// kind, wallet), B4 (x-graphpay-accepts), B5 (the wildcard), B8's record reads and B9 (a)'s address
// reads and its payee comparison (each cast shop's last settled order's merchant against the shop's ENS
// address). B8's MCP call is made against the hosted endpoint.
// With --relabel, the shops are checked under their new labels (before the story flips to them).
// Exit 1 on any failure. Prints names, nodes and public addresses only.

import { createPublicClient, getAddress, http } from 'viem';
import { activeCast, config } from '../../packages/config/index.mjs';
import { coinResource, disposableAgent, ensChain, KEYS, namehash, namespacePlan, parseAccepts, parseRelabel, permissionedResolverAbi, readAddressBytes, readText, relabelShops, RESOLVER, retryingReads, textResource, WHITECHAIN_COIN_TYPE, walkName } from '../../packages/ens/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { roleAddresses } from '../lib/wallets.mjs';

const fork = process.argv.includes('--fork') ? process.argv[process.argv.indexOf('--fork') + 1] : null;
const { values } = loadEnv();
const wallets = roleAddresses(values);
const rawClient = fork ? createPublicClient({ chain: ensChain(), transport: http(fork, { timeout: 120_000 }) }) : (await clientsFor(config.ens.network, Object.fromEntries(values))).publicClient;
const client = retryingReads(rawClient);
const relabel = parseRelabel(process.argv.includes('--relabel') ? process.argv[process.argv.indexOf('--relabel') + 1] : '');
const plan = namespacePlan({ cast: relabel.size > 0 ? relabelShops(activeCast(), relabel) : activeCast() });
const disposable = process.env.DISPOSABLE_N ? [disposableAgent(Number(process.env.DISPOSABLE_N))] : [];
const agents = [...plan.agents, ...disposable];
const failures = [];
const check = (id, ok, what) => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${id} ${what}`);
  if (!ok) failures.push(`${id} ${what}`);
};
const safe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    return `error: ${(e.shortMessage ?? e.message).slice(0, 80)}`;
  }
};

// B1: every name registered, in the future, its own resolver at offset 0, kind, wallet.
const resolvers = new Set();
for (const e of [...plan.owners, ...agents]) {
  const w = await walkName(client, e.name);
  check('B1', w.ok && w.expiry > w.now && w.epoch === 0 && !resolvers.has(w.resolver), `${e.name} registered${w.ok ? `, epoch ${w.epoch}, node ${w.node.slice(0, 10)}…` : ` (${w.reason})`}`);
  if (w.ok) resolvers.add(w.resolver);
  const kind = await safe(() => readText(client, e.name, KEYS.kind));
  check('B1', kind === (e.kind === 'agent' ? 'agent' : e.kind), `${e.name} kind ${kind}`);
  check('B1', (await safe(() => readText(client, e.name, KEYS.status))) === 'active', `${e.name} status active`);
  const own = e.kind === 'shop' || e.pays;
  if (own) {
    const a = await safe(() => readAddressBytes(client, e.name, WHITECHAIN_COIN_TYPE));
    check('B1/B9a', typeof a === 'string' && a.startsWith('0x') && getAddress(a) === getAddress(wallets[e.walletRole]), `${e.name} coin type 2147485522 address is ${e.walletRole}'s wallet`);
  }
}
const payers = agents.filter((a) => a.pays).map((a) => getAddress(wallets[a.walletRole]));
check('B1', new Set(payers).size === payers.length, 'no two paying agents share a wallet');

// B3 on the real chain, by roles (no transaction): a paying agent holds nothing on the resolver's root
// and exactly SET_TEXT on agent-context and SET_ADDRESS on its Whitechain coin type; nothing on the cap,
// status, accepts, endpoint, principal or kind keys, and nothing on coin type 60.
for (const a of agents.filter((x) => x.pays)) {
  const w = await walkName(client, a.name);
  if (!w.ok) continue;
  const holder = getAddress(wallets[a.walletRole]);
  const roles = (resource) => client.readContract({ address: w.resolver, abi: permissionedResolverAbi, functionName: 'roles', args: [resource, holder] });
  const none = [0n, ...[KEYS.capMicro, KEYS.status, KEYS.acceptsText, KEYS.agentEndpointMcp, KEYS.principal, KEYS.kind].map(textResource), coinResource(60n)];
  const held = await Promise.all(none.map(roles));
  check('B3', held.every((r) => r === 0n), `${a.name}: no role on the root, cap, status, accepts, endpoint, principal, kind or coin type 60`);
  check('B3', (await roles(textResource(KEYS.agentContext))) === RESOLVER.SET_TEXT && (await roles(coinResource(WHITECHAIN_COIN_TYPE))) === RESOLVER.SET_ADDRESS, `${a.name}: exactly SET_TEXT on agent-context and SET_ADDRESS on coin type 2147485522`);
}

// B4: accepts text on every shop.
for (const shop of plan.owners.filter((o) => o.kind === 'shop')) {
  const raw = await safe(() => readText(client, shop.name, KEYS.acceptsText));
  const parsed = parseAccepts(raw);
  check('B4', raw === config.whitechain.tokens.usdt.erc7930 && parsed.length === 1 && parsed[0].chainId === config.networks.whitechain.chainId && parsed[0].token === getAddress(config.whitechain.tokens.usdt.address), `${shop.name} accepts ${raw}`);
}
check('B4', parseAccepts(`${config.whitechain.tokens.usdt.erc7930}00`).length === 0, 'a malformed copy is ignored whole');

// B5: the wildcard.
const wild = `acceptance-${Math.random().toString(36).slice(2, 8)}.${plan.wildcard.name}`;
check('B5', (await safe(() => readText(client, wild, KEYS.synthetic))) === 'true', `${wild} graphpay.synthetic=true`);
check('B5', (await safe(() => readText(client, wild, KEYS.kind))) === 'agent', 'wildcard kind agent');
check('B5', (await safe(() => readText(client, wild, KEYS.status))) === '', 'wildcard status empty');
check('B5', (await walkName(client, wild)).reason === 'ENS_SYNTHETIC', 'the walk says ENS_SYNTHETIC');

// B8: ENSIP-26 records.
const mcp = `${config.site.url}${config.site.mcpPath}`;
check('B8', (await safe(() => readText(client, plan.root.name, KEYS.agentContext))).length > 0, `${plan.root.name} agent-context`);
check('B8', (await safe(() => readText(client, plan.root.name, KEYS.agentEndpointMcp))) === mcp, `${plan.root.name} agent-endpoint[mcp] = ${mcp}`);
check('B8', (await safe(() => readText(client, plan.root.name, KEYS.agentEndpointWeb))) === config.site.url, `${plan.root.name} agent-endpoint[web] = ${config.site.url}`);
for (const a of agents) {
  const ctx = await safe(() => readText(client, a.name, KEYS.agentContext));
  const ep = await safe(() => readText(client, a.name, KEYS.agentEndpointMcp));
  check('B8', ctx.length > 0 && !ctx.startsWith('error') && ep === mcp, `${a.name} agent-context and agent-endpoint[mcp]`);
}

// B8's MCP call: the endpoint the root's ENS record names answers initialize and lists the four tools (M7b).
const endpoint = await safe(() => readText(client, plan.root.name, KEYS.agentEndpointMcp));
const rpc = async (id, method, params) => {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(30_000) });
  return res.json();
};
try {
  const init = await rpc(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'graphpay-acceptance', version: '0' } });
  const tools = (await rpc(2, 'tools/list', {})).result?.tools?.map((t) => t.name) ?? [];
  check('B8', Boolean(init.result?.serverInfo) && ['schema', 'ask', 'graphql', 'explain'].every((n) => tools.includes(n)), `${endpoint}: initialize and tools/list = ${tools.join(', ')}`);
} catch (e) {
  check('B8', false, `${endpoint}: MCP call failed (${e.message})`);
}

// B9 (a): for each cast shop with a settled payment, the merchant of its last settled order equals the
// address its ENS name resolves to for coin type 2147485522 (read-only, Whitechain Sepolia).
if (!fork) {
  const checkout = config.whitechain.contracts?.checkout;
  const wc = (await clientsFor('whitechain', Object.fromEntries(values))).publicClient;
  const head = await wc.getBlockNumber();
  const settledEvent = checkoutAbi.find((x) => x.type === 'event' && x.name === 'PaymentSettled');
  // The Whitechain RPC answers a log range of 1000 blocks, not 5000: one pass from the deploy block, all shops.
  const settled = [];
  for (let from = BigInt(checkout.deployBlock); from <= head; from += 1_000n) {
    const to = from + 999n < head ? from + 999n : head;
    settled.push(...(await wc.getLogs({ address: checkout.address, event: settledEvent, fromBlock: from, toBlock: to })));
  }
  for (const shop of plan.owners.filter((o) => o.kind === 'shop')) {
    const node = namehash(shop.name);
    const last = settled.filter((l) => l.args.shopNode === node).at(-1);
    if (!last) {
      console.log(`skip B9a ${shop.name}: no settled payment yet`);
      continue;
    }
    const order = await wc.readContract({ address: checkout.address, abi: checkoutAbi, functionName: 'orders', args: [last.args.orderId] });
    const ens = await safe(() => readAddressBytes(client, shop.name, WHITECHAIN_COIN_TYPE));
    check('B9a', typeof ens === 'string' && ens.startsWith('0x') && ens.toLowerCase() === order.merchant.toLowerCase(), `${shop.name}: last settled order ${last.args.orderId.slice(0, 10)}… paid ${order.merchant} (tx ${last.transactionHash}); ENS addr(2147485522) is ${ens}`);
  }
}

console.log(failures.length === 0 ? '\nENS acceptance reads: all pass' : `\n${failures.length} failure(s)`);
if (failures.length > 0) process.exitCode = 1;
