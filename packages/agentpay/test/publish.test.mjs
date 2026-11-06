// What must hold for the npm package (ADR-0063): self-contained, Whitechain's own lane, chain
// 1874 only, anti-drain limits that cannot be switched off, no hosted-service defaults.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, custom } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createBuyerAgent, createMerchant, createReferenceRelayer, deployCheckout, resolveLimits, RELAYER_DEFAULTS, whitechainNetwork, usdt, signRefundRequest } from '../index.mjs';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const importsOf = (file) => [...readFileSync(file, 'utf8').matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"\n;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2] ?? m[3]);

const shipped = [...files(join(pkgDir, 'src')), ...files(join(pkgDir, 'examples')), join(pkgDir, 'index.mjs'), join(pkgDir, 'sandbox.mjs')];

test('the vendored ABI, EIP-712 shapes and defaults match the workspace sources', () => {
  execFileSync(process.execPath, [join(pkgDir, 'scripts/vendor.mjs'), '--check'], { stdio: 'pipe' });
});

test('self-contained: every import is relative, a node builtin, itself or a declared dependency', () => {
  const deps = new Set(Object.keys(pkg.dependencies));
  for (const file of shipped) {
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.') || spec.startsWith('node:') || builtinModules.includes(spec)) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      assert.ok(name === pkg.name || deps.has(name), `${file} imports ${spec}, which is not a dependency`);
    }
  }
  assert.deepEqual(Object.keys(pkg.dependencies).filter((d) => d.startsWith('@graphpay/')), []);
});

test('Whitechain lane: agentpay imports nothing from the Arkiv, ENS or money-graph packages, or any workspace package', () => {
  const banned = /^@graphpay\/|arkiv|^@ensdomains|ethers-ens|@ensdomains|money-graph/i;
  for (const file of shipped) {
    for (const spec of importsOf(file)) assert.ok(!banned.test(spec), `${file} imports ${spec}`);
  }
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) assert.ok(!/arkiv|^@graphpay\/(ens|money-graph|arkiv-graph)/.test(dep), `dependency ${dep}`);
});

test('the shipped files name no secret, keyed URL or hosted GraphPay service', () => {
  for (const file of shipped) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /process\.env\.[A-Z_]*(KEY|SECRET|TOKEN)/, `${file} reads a secret from the environment`);
    assert.doesNotMatch(text, /graphpay-event\.vercel\.app|vercel\.app|api\.ankr\.com|rpc\.ankr\.com\/[a-z_]+\/[0-9a-f]{16}/i, `${file} names a hosted service or keyed URL`);
  }
});

test('the package is public, MIT, 0.1.0 with a files list', () => {
  assert.equal(pkg.name, '@graphpay_ethglobal/agentpay');
  assert.equal(pkg.version, '0.1.0');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.ok(!pkg.private);
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0);
  assert.ok(!pkg.files.some((f) => /test|scripts|\.env/.test(f)));
});

test('chain 1874 is the only chain: the network refuses any other', () => {
  assert.equal(whitechainNetwork().chainId, 1874);
  for (const chainId of [1, 11155111, 7794095, 1875]) assert.throws(() => whitechainNetwork({ chainId }), /not an allowed testnet/);
});

const rpcOnChain = (id) => createPublicClient({ transport: custom({ request: async ({ method }) => (method === 'eth_chainId' ? `0x${id.toString(16)}` : null) }) });
const clientOnChain = (id) => createPublicClient({ chain: { id, name: 'x', nativeCurrency: { name: 'x', symbol: 'x', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:1'] } } }, transport: custom({ request: async () => null }) });
const account = privateKeyToAccount(generatePrivateKey());
const walletOn = (client) => createWalletClient({ account, transport: custom({ request: async () => null }) });
const noFacilitator = { verify: async () => ({}), settle: async () => ({}) };

test('client creation refuses a client that names another chain', () => {
  const wrong = clientOnChain(1);
  assert.throws(() => createBuyerAgent({ account, publicClient: wrong, name: 'a.example', pass: { capMicro: usdt('1') } }), /WRONG_CHAIN/);
  assert.throws(() => createMerchant({ name: 'm.example', address: account.address, facilitator: noFacilitator, publicClient: wrong }), /WRONG_CHAIN/);
  assert.throws(() => createReferenceRelayer({ walletClient: walletOn(wrong), publicClient: wrong, allowedMerchants: [account.address] }), /WRONG_CHAIN/);
  assert.doesNotThrow(() => createBuyerAgent({ account, publicClient: clientOnChain(1874), name: 'a.example', pass: { capMicro: usdt('1') } }));
});

test('before signing and sending, eth_chainId must answer 1874', async () => {
  const args = { account, publicClient: rpcOnChain(1), network: whitechainNetwork(), nowSec: 1_800_000_000 };
  await assert.rejects(signRefundRequest({ ...args, orderId: `0x${'11'.repeat(32)}`, amountMicro: 1n, reason: 'test' }), /WRONG_CHAIN/);
  await assert.rejects(deployCheckout({ walletClient: walletOn(), publicClient: rpcOnChain(1), relayer: privateKeyToAccount(generatePrivateKey()).address, policyWriter: privateKeyToAccount(generatePrivateKey()).address }), /WRONG_CHAIN/);
});

test('deployCheckout refuses overlapping roles before sending anything', async () => {
  const other = privateKeyToAccount(generatePrivateKey()).address;
  await assert.rejects(deployCheckout({ walletClient: walletOn(), publicClient: rpcOnChain(1874), relayer: account.address, policyWriter: other }), /three different addresses/);
});

test('anti-drain limits are on by default and cannot be switched off', () => {
  assert.deepEqual(resolveLimits(), RELAYER_DEFAULTS);
  assert.ok(RELAYER_DEFAULTS.maxOrderMicro > 0n && RELAYER_DEFAULTS.maxMicroPerHour > 0n && RELAYER_DEFAULTS.minRelayerBalanceWei > 0n && RELAYER_DEFAULTS.maxSettleGas > 0n);
  assert.equal(resolveLimits({ maxOrderMicro: usdt('2') }).maxOrderMicro, usdt('2'));
  assert.equal(resolveLimits({ maxSettlesPerHour: 5 }).maxSettlesPerHour, 5);
  for (const bad of [undefined, null, 0, 0n, -1, NaN, Infinity, '5', true]) assert.throws(() => resolveLimits({ maxOrderMicro: bad }), /cannot be switched off/, String(bad));
  assert.throws(() => resolveLimits({ maxOrdersPerYear: 3 }), /unknown limit/);
  const relayer = createReferenceRelayer({ walletClient: walletOn(), publicClient: clientOnChain(1874), allowedMerchants: [account.address] });
  assert.deepEqual(relayer.limits, RELAYER_DEFAULTS);
});

test('no hosted facilitator or relayer by default: both are required', () => {
  assert.throws(() => createMerchant({ name: 'm.example', address: account.address, publicClient: clientOnChain(1874) }), /needs a facilitator/);
  assert.throws(() => createReferenceRelayer({ walletClient: walletOn(), publicClient: clientOnChain(1874) }), /merchant allowlist/);
  assert.throws(() => createReferenceRelayer({ walletClient: walletOn(), publicClient: clientOnChain(1874), allowedMerchants: [] }), /merchant allowlist/);
});
