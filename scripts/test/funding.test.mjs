import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, erc20Abi, http, numberToHex, parseEther, parseGwei, parseUnits } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';
import { clientsOver, NETWORKS } from '../lib/chains.mjs';
import { fundNative, fundPlan, fundUsdt } from '../funding/fund.mjs';
import {
  assertOwnReceipt,
  assertTransferLog,
  gasAbove,
  gasLimitFor,
  identityProblems,
  nativeBudget,
  nonceProblem,
  parseArgs,
  planRoles,
  planTopUps,
  topUp,
  usdtBudget,
  withGas,
} from '../funding/logic.mjs';
import { fakeChain } from './fake-chain.mjs';
import { hex } from './samples.mjs';

const plan = JSON.parse(readFileSync('scripts/funding/plan.json', 'utf8'));
const fresh = config.wallets.fresh.map((w) => w.role);
// Fake wallets, made at run time: no key-shaped literal sits in the repository.
const fakeAccount = () => privateKeyToAccount(generatePrivateKey());
const fakeAddress = () => fakeAccount().address;

// A throwaway git repo whose .env is git-ignored, as ENV_FILE requires.
function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'gp-fund-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, '.gitignore'), '.env\n');
  return dir;
}

function envFile(lines = []) {
  const file = join(tempRepo(), '.env');
  writeFileSync(file, lines.map((line) => `${line}\n`).join(''));
  return file;
}

// The script as the operator runs it, with a fake ENV_FILE. Asynchronous, so a fake
// chain served by this process can still answer it.
function runFund(args, envPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/funding/fund.mjs', ...args], { env: { ...process.env, ENV_FILE: envPath } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

// A fake chain for one network and the script's clients over it.
async function onFakeChain(key, options = {}) {
  const chain = await fakeChain({ chainId: config.networks[key].chainId, ...options });
  return { chain, c: clientsOver(key, http(chain.url, { retryCount: 0 }), { rpcLabel: 'fake chain' }) };
}

const rpcCalls = (journal, method) => journal.filter((e) => e.rpc === method);
// viem's default max fee: the base fee × 1.2 plus the tip.
const maxFeeOf = (baseFee, tip) => (baseFee * 12n) / 10n + tip;

test('every funded role is a fresh role in the config (FUNDER and OPERATOR are never targets)', () => {
  for (const section of [plan.m0, plan.later, plan.usdt]) {
    for (const network of ['whitechain', 'sepolia', 'rabdi']) {
      for (const role of Object.keys(section[network] ?? {})) assert.ok(fresh.includes(role), `${network} ${role}`);
    }
  }
});

test('amounts are decimal strings and FUNDER keeps a reserve on every network', () => {
  for (const section of [plan.m0, plan.later, plan.usdt]) {
    for (const targets of Object.values(section).filter((v) => typeof v === 'object')) {
      for (const amount of Object.values(targets)) assert.match(amount, /^\d+(\.\d+)?$/);
    }
  }
  for (const network of ['whitechain', 'sepolia', 'rabdi']) assert.match(plan.funderReserve[network], /^\d+(\.\d+)?$/);
});

test('real sending needs both --execute and --real', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gp-fund-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, '.gitignore'), '.env\n');
  writeFileSync(join(dir, '.env'), '');
  const res = spawnSync(process.execPath, ['scripts/funding/fund.mjs', '--execute'], {
    encoding: 'utf8',
    env: { ...process.env, ENV_FILE: join(dir, '.env') },
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /real sending needs both --execute and --real/);
});

// --- the money rules (logic.mjs) ---

test('arguments: the defaults, and an unknown plan, network or argument is refused', () => {
  assert.deepEqual(parseArgs([], plan), { balances: false, planName: 'm0', network: undefined, execute: false, real: false, networks: NETWORKS });
  assert.deepEqual(parseArgs(['--plan', 'usdt'], plan).networks, ['whitechain']);
  assert.deepEqual(parseArgs(['--plan', 'later', '--network', 'rabdi', '--execute', '--real'], plan), {
    balances: false,
    planName: 'later',
    network: 'rabdi',
    execute: true,
    real: true,
    networks: ['rabdi'],
  });
  assert.equal(parseArgs(['--balances'], plan).balances, true);
  const refused = [
    [['--plan', 'funderReserve'], /unknown plan funderReserve/],
    [['--plan', 'about'], /unknown plan about/],
    [['--network', 'mainnet'], /unknown network mainnet/],
    [['--plan', 'later', '--network', 'whitechain'], /plan later funds nothing on whitechain/],
    [['--plan', 'usdt', '--network', 'sepolia'], /plan usdt funds nothing on sepolia/],
    [['--netwrok', 'sepolia', '--execute', '--real'], /unknown argument --netwrok/],
    [['--plan'], /--plan needs a value/],
    [['--network', '--execute', '--real'], /--network needs a value/],
    [['--plan', 'm0', '--plan', 'later'], /--plan given twice/],
    [['--real'], /real sending needs both --execute and --real/],
    [['--balances', '--execute', '--real'], /--balances is read-only/],
  ];
  for (const [argv, message] of refused) assert.throws(() => parseArgs(argv, plan), message, argv.join(' '));
});

test('arguments: a key-shaped value is never echoed', () => {
  const keyShaped = `0x${hex(64, 'd')}`;
  for (const argv of [[keyShaped], ['--plan', keyShaped], ['--network', keyShaped]]) {
    assert.throws(
      () => parseArgs(argv, plan),
      (error) => error.message.includes('that value') && !error.message.includes(hex(64, 'd')),
    );
  }
});

test('top-ups: up to the target, nothing at or above it, and less than 1% short is dust', () => {
  const target = parseEther('0.05');
  assert.deepEqual(topUp(target, parseEther('0.02')), { need: parseEther('0.03'), action: 'send' });
  assert.deepEqual(topUp(target, target), { need: 0n, action: 'at-target' });
  assert.deepEqual(topUp(target, parseEther('0.06')), { need: 0n, action: 'at-target' });
  assert.deepEqual(topUp(target, target - target / 100n), { need: target / 100n, action: 'send' });
  assert.deepEqual(topUp(target, target - target / 100n + 1n), { need: target / 100n - 1n, action: 'dust' });

  const [a, b] = [fakeAddress(), fakeAddress()];
  const rows = planTopUps({
    targets: { A: '0.05', B: '0.05', C: '0.05', D: '0.05' },
    addresses: { A: a, B: b, C: null },
    balances: new Map([
      ['A', 0n],
      ['B', parseEther('0.0499')],
    ]),
    parse: parseEther,
  });
  assert.deepEqual(
    rows.map((r) => [r.role, r.action, r.need]),
    [
      ['A', 'send', parseEther('0.05')],
      ['B', 'dust', parseEther('0.0001')],
      ['C', 'no-key', undefined],
      ['D', 'no-key', undefined],
    ],
  );
  assert.deepEqual([rows[2].why, rows[3].why], ['not a valid key', 'no key']);
});

test('identity: FUNDER is the configured FUNDER; each recipient is a fresh role with its own address', () => {
  const { carried, labNotUsed } = config.wallets;
  const base = { funder: carried.FUNDER, carried, labNotUsed, fresh };
  const own = { PAYER: fakeAddress(), VITALIK: fakeAddress(), SHOP_KESAR: fakeAddress() };
  assert.deepEqual(identityProblems({ ...base, roles: Object.keys(own), addresses: own }), []);
  assert.deepEqual(identityProblems({ ...base, roles: ['PAYER', 'VITALIK'], addresses: { VITALIK: null } }), [], 'roles without a key pass');

  const wrongFunder = identityProblems({ ...base, funder: fakeAddress(), roles: [], addresses: {} });
  assert.equal(wrongFunder.length, 1);
  assert.match(wrongFunder[0], /^FUNDER_PRIVATE_KEY gives 0x[0-9a-fA-F]{40}, not the configured FUNDER 0x/);

  const operatorKey = fakeAddress();
  const twin = fakeAddress();
  const cases = [
    [{ PAYER: carried.FUNDER.toLowerCase() }, /^PAYER has the address of FUNDER/],
    [{ PAYER: carried.OPERATOR }, /^PAYER has the address of OPERATOR/],
    [{ PAYER: operatorKey, OPERATOR: operatorKey }, /^PAYER has the address of OPERATOR/],
    [{ PAYER: labNotUsed[3] }, /^PAYER has the address of a lab wallet/],
    [{ PAYER: twin, DEAL_HUNTER: twin }, /^PAYER and DEAL_HUNTER have the same address/],
  ];
  for (const [addresses, message] of cases) {
    const problems = identityProblems({ ...base, roles: ['PAYER', 'DEAL_HUNTER'], addresses });
    assert.equal(problems.length, 1, JSON.stringify(problems));
    assert.match(problems[0], message);
  }
  assert.match(identityProblems({ ...base, roles: ['OPERATOR'], addresses: {} })[0], /^OPERATOR is in the plan but is not a fresh role/);

  const roles = planRoles(plan);
  assert.equal(new Set(roles).size, roles.length);
  for (const role of [...Object.keys(plan.m0.whitechain), ...Object.keys(plan.later.rabdi), ...Object.keys(plan.usdt.whitechain)]) {
    assert.ok(roles.includes(role), `${role} is checked`);
  }
});

test('fees: the gas limit sent is the estimate + 20% rounded up, and the fee bound and the reserve use it', () => {
  assert.equal(gasLimitFor(21_000n), 25_200n);
  assert.equal(gasLimitFor(207_391n), 248_870n);
  assert.equal(gasLimitFor(11n), 14n);
  const maxFee = parseGwei('6.001');
  const t = withGas({ role: 'DEPLOYER', need: parseEther('0.08') }, 21_000n, maxFee);
  assert.deepEqual([t.gasLimit, t.fee], [25_200n, 25_200n * maxFee]);

  const reserve = parseEther('0.2');
  const exact = parseEther('0.08') + t.fee + reserve;
  assert.deepEqual(nativeBudget({ balance: exact, transfers: [t], reserve }), { value: parseEther('0.08'), fees: t.fee, left: reserve, ok: true });
  assert.equal(nativeBudget({ balance: exact - 1n, transfers: [t], reserve }).ok, false);
  const enoughForTheEstimateOnly = parseEther('0.08') + 21_000n * maxFee + reserve;
  assert.equal(nativeBudget({ balance: enoughForTheEstimateOnly, transfers: [t], reserve }).ok, false);
});

test('fees: test USDT needs FUNDER USDT for the top-ups and WBT for every fee bound plus the WBT reserve', () => {
  const maxFee = parseGwei('6');
  const transfers = [withGas({ need: 20_000_000n }, 50_000n, maxFee), withGas({ need: 10_000_000n }, 52_000n, maxFee)];
  const fees = (60_000n + 62_400n) * maxFee;
  const reserve = parseEther('0.2');
  assert.deepEqual(usdtBudget({ units: 30_000_000n, wbt: reserve + fees, transfers, reserve }), {
    value: 30_000_000n,
    fees,
    wbtLeft: reserve,
    unitsOk: true,
    wbtOk: true,
  });
  assert.equal(usdtBudget({ units: 29_999_999n, wbt: reserve + fees, transfers, reserve }).unitsOk, false);
  assert.equal(usdtBudget({ units: 30_000_000n, wbt: reserve + fees - 1n, transfers, reserve }).wbtOk, false);
});

test('Sepolia gas stop: base fee + tip above sepoliaMaxGwei, not at it', () => {
  assert.equal(gasAbove({ baseFee: 17n, tip: 1000n, maxGwei: plan.sepoliaMaxGwei }), false);
  assert.equal(gasAbove({ baseFee: parseGwei('0.4'), tip: parseGwei('0.1'), maxGwei: '0.5' }), false);
  assert.equal(gasAbove({ baseFee: parseGwei('0.4'), tip: parseGwei('0.1') + 1n, maxGwei: '0.5' }), true);
});

test('pending-nonce guard: send only when the pending nonce equals the nonce at the pinned block', () => {
  assert.equal(nonceProblem({ confirmed: 7, pending: 7 }), null);
  assert.match(nonceProblem({ confirmed: 7, pending: 8 }), /in flight \(nonce 7 at the pinned block, 8 pending\)/);
  assert.match(nonceProblem({ confirmed: 7, pending: 6 }), /behind the pinned block/);
});

test('receipt guard: only a successful receipt for this very hash counts', () => {
  const hash = `0x${'ab'.repeat(32)}`;
  const other = `0x${'cd'.repeat(32)}`;
  assertOwnReceipt({ transactionHash: hash, status: 'success' }, hash, 'PAYER');
  assertOwnReceipt({ transactionHash: `0x${'AB'.repeat(32)}`, status: 'success' }, hash, 'PAYER');
  assert.throws(() => assertOwnReceipt({ transactionHash: other, status: 'success' }, hash, 'PAYER'), /^Error: PAYER: the receipt is for 0xcdcd.*, not 0xabab.* \(replaced\?\)$/);
  assert.throws(() => assertOwnReceipt(undefined, hash, 'PAYER'), /the receipt is for no transaction/);
  assert.throws(() => assertOwnReceipt({ transactionHash: hash, status: 'reverted' }, hash, 'PAYER'), /PAYER: 0xabab.* reverted/);
});

test('Transfer-log check: exactly one Transfer from FUNDER to the recipient for exactly the amount, logged by the token', () => {
  const [token, from, to, elsewhere] = [fakeAddress(), fakeAddress(), fakeAddress(), fakeAddress()];
  const transfer = ({ from: f = from, to: t = to, value = 25_000_000n, address = token } = {}) => ({
    address,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: f, to: t } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  });
  const check = (logs) => assertTransferLog({ logs }, { token, from, to, value: 25_000_000n }, 'PAYER');
  check([transfer()]);
  check([transfer({ address: token.toLowerCase() })]);
  const wrong = [
    [],
    [transfer({ value: 24_999_999n })],
    [transfer({ to: elsewhere })],
    [transfer({ from: elsewhere })],
    [transfer({ address: elsewhere })],
    [transfer(), transfer({ to: elsewhere, value: 1n })],
  ];
  for (const logs of wrong) assert.throws(() => check(logs), /^Error: PAYER: no single Transfer log from FUNDER/);
});

// --- the script's network flow, against a fake chain on 127.0.0.1 ---

test('a real run reads at one pinned block, signs for the chain with explicit fees, and logs the hash before the receipt', async () => {
  const journal = [];
  const funder = fakeAccount();
  const [low, full, near] = [fakeAddress(), fakeAddress(), fakeAddress()];
  const { chain, c } = await onFakeChain('whitechain', {
    journal,
    block: 4242n,
    balances: { [funder.address]: parseEther('2'), [low]: parseEther('0.02'), [full]: parseEther('0.1'), [near]: parseEther('0.0496') },
  });
  try {
    const { stops } = await fundNative({
      c,
      funder,
      targets: { DEPLOYER: '0.1', RENEWER: '0.1', POLICY_WRITER: '0.05', SHOP_SYRUP: '0.02' },
      addresses: { DEPLOYER: low, RENEWER: full, POLICY_WRITER: near },
      reserve: '0.2',
      maxGwei: plan.sepoliaMaxGwei,
      real: true,
      log: (line) => journal.push({ log: line }),
    });
    assert.deepEqual(stops, []);
    assert.equal(chain.sent.length, 1, 'only DEPLOYER is short by 1% or more');
    const [tx] = chain.sent;
    assert.equal(tx.chainId, config.networks.whitechain.chainId);
    assert.equal(tx.from, funder.address);
    assert.equal(tx.to.toLowerCase(), low.toLowerCase());
    assert.equal(tx.value, parseEther('0.08'));
    assert.equal(tx.nonce, 7);
    assert.equal(tx.gas, 25_200n);
    assert.equal(tx.maxPriorityFeePerGas, 1_000_000n);
    assert.equal(tx.maxFeePerGas, maxFeeOf(5_000_000_000n, 1_000_000n));

    const pinned = numberToHex(4242n);
    for (const e of rpcCalls(journal, 'eth_getBalance').slice(0, -1)) assert.equal(e.params[1], pinned, 'a balance read off the pin');
    assert.deepEqual(rpcCalls(journal, 'eth_getTransactionCount').map((e) => e.params[1]), [pinned, 'pending']);
    assert.equal(rpcCalls(journal, 'eth_fillTransaction').length, 0);
    const afterEstimate = journal.slice(journal.findLastIndex((e) => e.rpc === 'eth_estimateGas') + 1).filter((e) => e.rpc);
    assert.deepEqual(afterEstimate.map((e) => e.rpc), ['eth_sendRawTransaction', 'eth_getTransactionReceipt', 'eth_getBalance'], 'nothing filled from the RPC');
    const logged = journal.findIndex((e) => e.log?.includes(`nonce 7, tx ${tx.hash}`));
    assert.ok(logged !== -1 && logged < journal.findIndex((e) => e.rpc === 'eth_getTransactionReceipt'), 'hash and nonce logged before the wait');

    const lines = journal.filter((e) => e.log).map((e) => e.log);
    assert.ok(lines.some((l) => l.startsWith('  RENEWER') && l.endsWith('(target 0.1): nothing to send')));
    assert.ok(lines.some((l) => l.startsWith('  POLICY_WRITER') && l.endsWith('within 1% of target: nothing to send')));
    assert.ok(lines.includes('  skip SHOP_SYRUP: no key'));
  } finally {
    await chain.close();
  }
});

// Two top-ups per flow: a native one on Whitechain and a test USDT one.
function twoTopUps(funder, chainOptions = {}) {
  const [a, b] = [fakeAddress(), fakeAddress()];
  const token = { address: fakeAddress(), decimals: 6 };
  const options = {
    ...chainOptions,
    balances: { [funder.address]: parseEther('2') },
    token: { ...token, balances: { [funder.address]: parseUnits('100', 6) } },
  };
  const common = { funder, addresses: { PAYER: a, VITALIK: b }, reserve: '0.2', real: true };
  return [
    ['native', fundNative, options, { ...common, targets: { PAYER: '0.1', VITALIK: '0.1' } }],
    ['USDT', fundUsdt, options, { ...common, targets: { PAYER: '30', VITALIK: '10' }, token }],
  ];
}

test('a FUNDER transaction in flight stops the network before anything is read, estimated or sent', async () => {
  for (const [name, flow, options, args] of twoTopUps(fakeAccount(), { confirmed: 7, pending: 8 })) {
    const journal = [];
    const { chain, c } = await onFakeChain('whitechain', { ...options, journal });
    try {
      const lines = [];
      const { stops } = await flow({ ...args, c, log: (line) => lines.push(line) });
      assert.equal(stops.length, 1, name);
      assert.match(stops[0], /FUNDER has a transaction in flight \(nonce 7 at the pinned block, 8 pending\); nothing sent on Whitechain Sepolia\. Wait until it is mined/);
      assert.ok(lines.includes(`  STOP: ${stops[0]}`), name);
      assert.deepEqual(chain.sent, [], name);
      const reads = ['eth_getBalance', 'eth_call', 'eth_estimateGas'].map((m) => rpcCalls(journal, m).length);
      assert.deepEqual(reads, [0, 0, 0], name);
    } finally {
      await chain.close();
    }
  }
});

test('a receipt for another transaction (same nonce) throws and nothing more is sent', async () => {
  for (const [name, flow, options, args] of twoTopUps(fakeAccount(), { tamper: { receiptHash: true } })) {
    const { chain, c } = await onFakeChain('whitechain', options);
    try {
      await assert.rejects(
        flow({ ...args, c, log: () => {} }),
        /^Error: PAYER \(https:\/\/\S+\/tx\/0x[0-9a-f]{64}\): the receipt is for 0x[0-9a-f]{64}, not 0x[0-9a-f]{64} \(replaced\?\)$/,
        name,
      );
      assert.equal(chain.sent.length, 1, name);
    } finally {
      await chain.close();
    }
  }
});

test('Sepolia above sepoliaMaxGwei stops in a dry run too, saying a real run would stop there', async () => {
  const journal = [];
  const { chain, c } = await onFakeChain('sepolia', { journal, baseFee: parseGwei('0.45'), tip: parseGwei('0.1') });
  try {
    const args = { c, funder: fakeAccount(), targets: { VITALIK: '0.002' }, addresses: { VITALIK: fakeAddress() }, reserve: '0.001', maxGwei: '0.5', log: () => {} };
    const dry = await fundNative({ ...args, real: false });
    assert.deepEqual(dry.stops, ['base fee + tip is above 0.5 gwei: a real run would stop here and fund nothing on Sepolia (founder to-do: about 0.1 Sepolia ETH to OPERATOR)']);
    const real = await fundNative({ ...args, real: true });
    assert.match(real.stops[0], /above 0\.5 gwei: Sepolia not funded/);
    assert.deepEqual([rpcCalls(journal, 'eth_getBalance').length, chain.sent.length], [0, 0]);
  } finally {
    await chain.close();
  }
});

test('the reserve check counts the fee bound at the gas limit sent, not at the estimate', async () => {
  const funder = fakeAccount();
  const to = fakeAddress();
  const need = parseEther('0.08');
  const maxFee = maxFeeOf(5_000_000_000n, 1_000_000n);
  const reserve = parseEther('0.2');
  for (const [balance, stopped] of [
    [need + 21_000n * maxFee + reserve, true],
    [need + 25_200n * maxFee + reserve, false],
  ]) {
    const { chain, c } = await onFakeChain('whitechain', { balances: { [funder.address]: balance } });
    try {
      const lines = [];
      const { stops } = await fundNative({ c, funder, targets: { DEPLOYER: '0.08' }, addresses: { DEPLOYER: to }, reserve: '0.2', real: false, log: (l) => lines.push(l) });
      assert.deepEqual(stops.length, stopped ? 1 : 0, lines.join('\n'));
      if (stopped) assert.match(stops[0], /FUNDER would fall below its 0\.2 WBT reserve; nothing sent on Whitechain Sepolia/);
      else assert.ok(lines.includes('  dry run: 1 transfer(s) not sent'));
      assert.deepEqual(chain.sent, []);
    } finally {
      await chain.close();
    }
  }
});

test('test USDT: explicit chain id and fees, and the receipt must log the exact Transfer', async () => {
  const funder = fakeAccount();
  const payer = fakeAddress();
  const token = { address: fakeAddress(), decimals: 6 };
  const options = {
    balances: { [funder.address]: parseEther('1') },
    token: { ...token, balances: { [funder.address]: parseUnits('100', 6), [payer]: parseUnits('5', 6) } },
  };
  const args = { funder, targets: { PAYER: '30' }, addresses: { PAYER: payer }, token, reserve: '0.2', real: true, log: () => {} };

  const journal = [];
  const ok = await onFakeChain('whitechain', { ...options, journal });
  try {
    assert.deepEqual((await fundUsdt({ ...args, c: ok.c, log: (line) => journal.push({ log: line }) })).stops, []);
    const pinned = numberToHex(1000n);
    assert.deepEqual(rpcCalls(journal, 'eth_call').map((e) => e.params[1]), [pinned, pinned, pinned, 'latest'], 'USDT reads at the pin');
    assert.deepEqual(rpcCalls(journal, 'eth_getBalance').map((e) => e.params[1]), [pinned]);
    const afterEstimate = journal.slice(journal.findLastIndex((e) => e.rpc === 'eth_estimateGas') + 1).filter((e) => e.rpc);
    assert.deepEqual(afterEstimate.map((e) => e.rpc), ['eth_sendRawTransaction', 'eth_getTransactionReceipt', 'eth_call'], 'nothing filled from the RPC');
    const [tx] = ok.chain.sent;
    const logged = journal.findIndex((e) => e.log?.includes(`nonce 7, tx ${tx.hash}`));
    assert.ok(logged !== -1 && logged < journal.findIndex((e) => e.rpc === 'eth_getTransactionReceipt'), 'hash and nonce logged before the wait');
    assert.equal(tx.chainId, config.networks.whitechain.chainId);
    assert.equal(tx.to.toLowerCase(), token.address.toLowerCase());
    assert.equal(tx.gas, gasLimitFor(52_000n));
    assert.deepEqual([tx.maxFeePerGas, tx.maxPriorityFeePerGas], [maxFeeOf(5_000_000_000n, 1_000_000n), 1_000_000n]);
    const { functionName, args: call } = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    assert.deepEqual([functionName, call[0].toLowerCase(), call[1]], ['transfer', payer.toLowerCase(), parseUnits('25', 6)]);
  } finally {
    await ok.chain.close();
  }

  const short = await onFakeChain('whitechain', { ...options, tamper: { transferDelta: -1n } });
  try {
    await assert.rejects(fundUsdt({ ...args, c: short.c }), /^Error: PAYER \(\S+\): no single Transfer log from FUNDER to 0x[0-9a-fA-F]{40} for exactly 25000000 units/);
  } finally {
    await short.chain.close();
  }
});

test("test USDT: FUNDER's WBT must cover every fee bound plus the WBT reserve", async () => {
  const funder = fakeAccount();
  const payer = fakeAddress();
  const token = { address: fakeAddress(), decimals: 6 };
  const fee = gasLimitFor(52_000n) * maxFeeOf(5_000_000_000n, 1_000_000n);
  const { chain, c } = await onFakeChain('whitechain', {
    balances: { [funder.address]: parseEther('0.2') + fee - 1n },
    token: { ...token, balances: { [funder.address]: parseUnits('100', 6) } },
  });
  try {
    const { stops } = await fundUsdt({ c, funder, targets: { PAYER: '30' }, addresses: { PAYER: payer }, token, reserve: '0.2', real: true, log: () => {} });
    assert.deepEqual(stops, ["FUNDER's WBT would not cover the fees plus its 0.2 WBT reserve; nothing sent"]);
    assert.deepEqual(chain.sent, []);
  } finally {
    await chain.close();
  }
});

test('a STOP on one network does not keep the next from running, and every STOP is returned', async () => {
  const funder = fakeAccount();
  const roles = Object.keys(plan.m0.rabdi);
  const addresses = Object.fromEntries(roles.map((role) => [role, fakeAddress()]));
  const sepolia = await onFakeChain('sepolia', { baseFee: parseGwei('1') });
  const rabdi = await onFakeChain('rabdi', { balances: { [funder.address]: parseEther('5') } });
  try {
    const chains = { sepolia, rabdi };
    const stops = await fundPlan({ planName: 'm0', networks: ['sepolia', 'rabdi'], funder, addresses, real: true, connect: async (key) => chains[key].c, log: () => {} });
    assert.equal(stops.length, 1);
    assert.match(stops[0], /^Ethereum Sepolia: base fee \+ tip is above 0\.5 gwei: Sepolia not funded/);
    assert.deepEqual(sepolia.chain.sent, []);
    assert.deepEqual(
      rabdi.chain.sent.map((tx) => [tx.to.toLowerCase(), tx.value, tx.nonce]),
      roles.map((role, i) => [addresses[role].toLowerCase(), parseEther(plan.m0.rabdi[role]), 7 + i]),
    );
  } finally {
    await sepolia.chain.close();
    await rabdi.chain.close();
  }
});

// --- the script from the command line ---

test('an unknown plan, network or argument exits 1 before .env is read', () => {
  const missing = join(tempRepo(), '.env');
  for (const [args, message] of [
    [['--plan', 'funderReserve'], /^error: unknown plan funderReserve/],
    [['--network', 'mainnet'], /^error: unknown network mainnet/],
    [['--plan', 'later', '--network', 'sepolia'], /^error: plan later funds nothing on sepolia/],
    [['--network', 'sepolia', '--exectue', '--real'], /^error: unknown argument --exectue/],
  ]) {
    const res = spawnSync(process.execPath, ['scripts/funding/fund.mjs', ...args], { encoding: 'utf8', env: { ...process.env, ENV_FILE: missing } });
    assert.equal(res.status, 1, args.join(' '));
    assert.match(res.stderr, message);
  }
});

test('identity failures stop the whole run before any network is read, naming the roles', async () => {
  const journal = [];
  const chain = await fakeChain({ chainId: config.networks.whitechain.chainId, journal });
  try {
    const funderKey = generatePrivateKey();
    const shared = generatePrivateKey();
    const envPath = envFile([
      `WHITECHAIN_RPC_URL=${chain.url}`,
      `FUNDER_PRIVATE_KEY=${funderKey}`,
      `VITALIK_PRIVATE_KEY=${funderKey}`,
      `PAYER_PRIVATE_KEY=${shared}`,
      `DEAL_HUNTER_PRIVATE_KEY=${shared}`,
    ]);
    const res = await runFund(['--network', 'whitechain'], envPath);
    assert.equal(res.status, 1, res.stderr);
    assert.match(res.stdout, /^STOP: FUNDER_PRIVATE_KEY gives 0x[0-9a-fA-F]{40}, not the configured FUNDER 0x[0-9a-fA-F]{40}$/m);
    assert.match(res.stdout, /^STOP: VITALIK has the address of FUNDER /m);
    assert.match(res.stdout, /^STOP: PAYER and DEAL_HUNTER have the same address /m);
    assert.match(res.stdout, /no network was read and nothing was sent/);
    for (const key of [funderKey, shared]) assert.ok(!`${res.stdout}${res.stderr}`.includes(key.slice(2)), 'a key was printed');
    assert.deepEqual(journal, [], 'the fake chain was contacted');
  } finally {
    await chain.close();
  }
});
