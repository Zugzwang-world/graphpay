import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { EnvError, parseEnv, readEnvFile, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { redactor } from '../lib/redact.mjs';
import { SAMPLES } from './samples.mjs';

// A throwaway git repo whose .env is git-ignored, as in a real checkout.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'gp-env-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  writeFileSync(join(dir, '.gitignore'), '.env\n.env.*\n');
  return dir;
}

function runScript(script, args, envFile, input) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    input,
    env: { ...process.env, ENV_FILE: envFile },
  });
}

test('parseEnv reads CRLF files, quotes and comments without evaluating anything', () => {
  const values = parseEnv('# c\r\nA=1\r\nexport B="two"\r\nC=three # note\r\n');
  assert.deepEqual([...values], [['A', '1'], ['B', 'two'], ['C', 'three']]);
});

test('setEnvValue: new, unchanged, refuses a different value, overwrites on request', () => {
  const file = join(repo(), '.env');
  assert.equal(setEnvValue(file, 'A_NAME', 'first-value'), 'new');
  assert.equal(setEnvValue(file, 'A_NAME', 'first-value'), 'unchanged');
  assert.throws(() => setEnvValue(file, 'A_NAME', 'other-value'), EnvError);
  assert.equal(setEnvValue(file, 'A_NAME', 'other-value', { overwrite: true }), 'updated');
  assert.equal(readEnvFile(file).get('A_NAME'), 'other-value');
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('unsafe values are refused with a name-only message, and no temp or lock file is left', () => {
  const dir = repo();
  const file = join(dir, '.env');
  for (const bad of ['a"b', "a'b", 'a\\b', 'a$b', 'a`b', 'a\nb', ' padded ']) {
    try {
      setEnvValue(file, 'SECRET_NAME', bad);
      assert.fail('accepted an unsafe value');
    } catch (error) {
      assert.ok(error instanceof EnvError);
      assert.ok(error.message.startsWith('SECRET_NAME: refused'));
      assert.ok(!error.message.includes(bad.trim() || 'x'));
    }
  }
  setEnvValue(file, 'OK_NAME', 'fine');
  assert.deepEqual(readdirSync(dir).sort(), ['.env', '.git', '.gitignore']);
});

test('a name that appears twice is refused rather than guessed', () => {
  const file = join(repo(), '.env');
  writeFileSync(file, 'DUP=one\nDUP=two\n');
  assert.throws(() => setEnvValue(file, 'DUP', 'three', { overwrite: true }), /more than once/);
});

test('the loader refuses a .env that git does not ignore, and ENV_FILE outside git', () => {
  const dir = repo();
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  writeFileSync(join(dir, '.env'), '');
  assert.throws(() => locateEnvFile({ cwd: dir, env: {} }), /does not ignore/);
  const outside = mkdtempSync(join(tmpdir(), 'gp-out-'));
  writeFileSync(join(outside, 'x.env'), '');
  assert.throws(() => locateEnvFile({ cwd: dir, env: { ENV_FILE: join(outside, 'x.env') } }), /git-ignored/);
});

test('a worktree without .env uses the main checkout .env when git ignores it there', () => {
  const main = repo();
  writeFileSync(join(main, 'README'), 'x');
  execFileSync('git', ['add', '.'], { cwd: main });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'], { cwd: main });
  writeFileSync(join(main, '.env'), 'A=1\n');
  const wt = join(mkdtempSync(join(tmpdir(), 'gp-wt-')), 'wt');
  execFileSync('git', ['worktree', 'add', '-q', wt], { cwd: main });
  const found = locateEnvFile({ cwd: wt, env: {} });
  assert.equal(found.source, 'main checkout');
  assert.equal(readEnvFile(found.path).get('A'), '1');
});

test('import-lab copies exactly the allowlist, prints names only, refuses other names', () => {
  const lab = join(repo(), '.env');
  const dest = join(repo(), '.env');
  const values = {
    FUNDER_PRIVATE_KEY: generatePrivateKey(),
    ARKIV_ACCESS_KEY: `k${'1'.repeat(30)}`,
    ANTHROPIC_API_KEY: SAMPLES['anthropic-api-key'],
    PAYER_PRIVATE_KEY: generatePrivateKey(),
    FACILITATOR_PRIVATE_KEY: generatePrivateKey(),
  };
  writeFileSync(lab, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n'));
  const res = runScript('scripts/secrets/import-lab.mjs', ['--from', lab], dest);
  for (const v of Object.values(values)) assert.ok(!res.stdout.includes(v) && !res.stderr.includes(v));
  assert.match(res.stdout, /OPERATOR_PRIVATE_KEY: missing in the lab file/);
  assert.match(res.stdout, /FUNDER_PRIVATE_KEY: refused \(its address 0x[0-9a-fA-F]{40} is not the carried-over FUNDER 0x[0-9a-fA-F]{40}\)/);
  assert.equal(res.status, 1);
  // A key that is not the carried-over wallet is never written.
  assert.deepEqual([...readEnvFile(dest).keys()].sort(), ['ANTHROPIC_API_KEY', 'ARKIV_ACCESS_KEY']);
  const refused = runScript('scripts/secrets/import-lab.mjs', ['--from', lab, '--only', 'PAYER_PRIVATE_KEY'], dest);
  assert.match(refused.stdout, /PAYER_PRIVATE_KEY: refused \(not on the import allowlist\)/);
  assert.equal(refused.status, 1);
  writeFileSync(lab, `ARKIV_ACCESS_KEY=k${'2'.repeat(30)}\n`);
  const clash = runScript('scripts/secrets/import-lab.mjs', ['--from', lab, '--only', 'ARKIV_ACCESS_KEY'], dest);
  assert.match(clash.stdout, /ARKIV_ACCESS_KEY: refused \(a different value is already set\)/);
  assert.equal(readEnvFile(dest).get('ARKIV_ACCESS_KEY'), values.ARKIV_ACCESS_KEY);
});

test('wallet:gen makes one role per run, prints the address only, never regenerates', () => {
  const dest = join(repo(), '.env');
  const first = runScript('scripts/secrets/gen-wallet.mjs', ['--only', 'DEPLOYER'], dest);
  assert.equal(first.status, 0);
  assert.match(first.stdout.trim(), /^DEPLOYER 0x[0-9a-fA-F]{40}$/);
  const key = readEnvFile(dest).get('DEPLOYER_PRIVATE_KEY');
  assert.match(key, /^0x[0-9a-f]{64}$/);
  assert.ok(!first.stdout.includes(key.slice(2)));
  const again = runScript('scripts/secrets/gen-wallet.mjs', ['--only', 'DEPLOYER'], dest);
  assert.match(again.stdout, /already set, not regenerated/);
  assert.equal(readEnvFile(dest).get('DEPLOYER_PRIVATE_KEY'), key);
  for (const args of [['--only', 'FUNDER'], ['--only', 'NOT_A_ROLE'], ['--only', 'PAYER', 'VITALIK'], []]) {
    assert.equal(runScript('scripts/secrets/gen-wallet.mjs', args, dest).status, 1, args.join(' '));
  }
  assert.match(runScript('scripts/secrets/gen-wallet.mjs', ['--only', 'DISPOSABLE_1'], dest).stdout, /^DISPOSABLE_1 0x/);
});

test('secrets:gen makes at least 24 characters, keeps an existing value unless --rotate', () => {
  const dest = join(repo(), '.env');
  assert.match(runScript('scripts/secrets/gen-secret.mjs', ['DEMO_PASSCODE'], dest).stdout, /DEMO_PASSCODE: new \(43 characters\)/);
  const value = readEnvFile(dest).get('DEMO_PASSCODE');
  assert.match(runScript('scripts/secrets/gen-secret.mjs', ['DEMO_PASSCODE'], dest).stdout, /kept/);
  assert.equal(readEnvFile(dest).get('DEMO_PASSCODE'), value);
  runScript('scripts/secrets/gen-secret.mjs', ['DEMO_PASSCODE', '--rotate'], dest);
  assert.notEqual(readEnvFile(dest).get('DEMO_PASSCODE'), value);
  assert.equal(runScript('scripts/secrets/gen-secret.mjs', ['PAYER_PRIVATE_KEY'], dest).status, 1);
});

test('secrets:stdin stores piped input without echo; secrets:set refuses without a terminal', () => {
  const dest = join(repo(), '.env');
  const piped = runScript('scripts/secrets/set-from-stdin.mjs', ['RECORDER_TOKEN'], dest, `${'t'.repeat(30)}\n`);
  assert.equal(piped.stdout.trim(), 'RECORDER_TOKEN: new');
  assert.equal(readEnvFile(dest).get('RECORDER_TOKEN'), 't'.repeat(30));
  assert.equal(runScript('scripts/secrets/set-from-stdin.mjs', ['VITALIK_PRIVATE_KEY'], dest, generatePrivateKey()).status, 1);
  const set = runScript('scripts/secrets/set.mjs', ['WHITECHAIN_RPC_URL'], dest, '');
  assert.match(set.stdout, /needs a real terminal/);
});

test('status lists names, never values', () => {
  const dest = join(repo(), '.env');
  writeFileSync(dest, `CRON_SECRET=${'c'.repeat(30)}\n`);
  const res = runScript('scripts/secrets/status.mjs', [], dest);
  assert.match(res.stdout, /set {5}CRON_SECRET/);
  assert.match(res.stdout, /missing FUNDER_PRIVATE_KEY/);
  assert.ok(!res.stdout.includes('c'.repeat(30)));
});

test('the redactor removes .env values (with or without 0x) and secret shapes', () => {
  const key = generatePrivateKey();
  const url = SAMPLES['ankr-api-key-in-url'];
  const redact = redactor(new Map([['A_PRIVATE_KEY', key], ['WHITECHAIN_RPC_URL', url], ['CONFIRMATIONS', '1']]));
  const out = redact(`failed at ${url} with ${key} and ${key.slice(2)}; also ${SAMPLES['github-token']}; 1 confirmation`);
  assert.ok(!out.includes(key.slice(2)) && !out.includes(url) && !out.includes(SAMPLES['github-token']));
  assert.ok(out.includes('1 confirmation'));
});

test('the A5 address check derives public addresses only', () => {
  const dest = join(repo(), '.env');
  runScript('scripts/secrets/gen-wallet.mjs', ['--only', 'PAYER'], dest);
  const res = runScript('scripts/wallets/addresses.mjs', [], dest);
  assert.match(res.stdout, /PAYER {14}0x[0-9a-fA-F]{40} fresh/);
  assert.ok(!res.stdout.includes(readEnvFile(dest).get('PAYER_PRIVATE_KEY').slice(2)));
  assert.equal(res.status, 1); // FUNDER and OPERATOR are missing here, so A5 cannot pass
});

test('env helpers never JSON.parse a value', () => {
  for (const file of ['scripts/lib/env-file.mjs', 'scripts/lib/env-loader.mjs', 'scripts/secrets/import-lab.mjs']) {
    assert.ok(!readFileSync(file, 'utf8').includes('JSON.parse'), file);
  }
});

test('values with # or outside printable ASCII are refused', () => {
  const file = join(repo(), '.env');
  for (const bad of ['abc #def', 'a b', 'tab\there', 'café']) {
    assert.throws(() => setEnvValue(file, 'SOME_NAME', bad), /refused/);
  }
});

test("a dead writer's temp copy is swept, and its lock names it instead of being broken", () => {
  const dir = repo();
  const file = join(dir, '.env');
  setEnvValue(file, 'A_NAME', 'one');
  const dead = 2147483646; // no such process
  writeFileSync(join(dir, `.env.${dead}.0123456789ab.tmp`), 'A_NAME=copy\n');
  assert.equal(setEnvValue(file, 'B_NAME', 'two'), 'new');
  assert.deepEqual(readdirSync(dir).sort(), ['.env', '.git', '.gitignore']);
  writeFileSync(`${file}.lock`, `${dead}:token`);
  assert.throws(() => setEnvValue(file, 'C_NAME', 'three'), /locked by pid 2147483646, not running; if no secrets script is running, remove \.env\.lock in /);
  assert.equal(readEnvFile(file).get('C_NAME'), undefined);
});

test('parallel writers never lose a value', async () => {
  const dir = repo();
  const file = join(dir, '.env');
  const writer = `
    import { setEnvValue } from ${JSON.stringify(new URL('../lib/env-file.mjs', import.meta.url).href)};
    const [name, value] = process.argv.slice(1);
    console.log(setEnvValue(process.env.TARGET, name, value));
  `;
  const run = (i) =>
    new Promise((resolveRun) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', writer, `NAME_${i}`, `value-${i}`], { env: { ...process.env, TARGET: file } });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      child.on('close', (status) => resolveRun({ status, out }));
    });
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => run(i)));
  for (const r of results) assert.equal(r.status, 0, r.out);
  const values = readEnvFile(file);
  for (let i = 0; i < 12; i += 1) assert.equal(values.get(`NAME_${i}`), `value-${i}`);
  assert.deepEqual(readdirSync(dir).sort(), ['.env', '.git', '.gitignore']);
});

test('the loader anchors on the scripts\' own checkout, not the caller\'s folder', () => {
  const elsewhere = mkdtempSync(join(tmpdir(), 'gp-cwd-'));
  const probe = `
    import { locateEnvFile } from ${JSON.stringify(new URL('../lib/env-loader.mjs', import.meta.url).href)};
    console.log(locateEnvFile({ env: {}, create: true }).path);
  `;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: elsewhere, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const top = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  assert.ok(res.stdout.trim().startsWith(dirname(top)) || res.stdout.trim().startsWith(process.cwd()), res.stdout);
  assert.ok(!res.stdout.includes(elsewhere));
});

test('an argument that is not a plain name is never echoed', () => {
  const dest = join(repo(), '.env');
  const secretish = `ANTHROPIC_API_KEY=${SAMPLES['anthropic-api-key']}`;
  for (const [script, args] of [
    ['scripts/secrets/set.mjs', [secretish]],
    ['scripts/secrets/set-from-stdin.mjs', [secretish]],
    ['scripts/secrets/gen-secret.mjs', [secretish]],
    ['scripts/secrets/gen-wallet.mjs', ['--only', secretish]],
    ['scripts/secrets/import-lab.mjs', ['--only', secretish]],
  ]) {
    const res = runScript(script, args, dest, 'x');
    assert.ok(!res.stdout.includes(SAMPLES['anthropic-api-key']) && !res.stderr.includes(SAMPLES['anthropic-api-key']), script);
    assert.equal(res.status, 1, script);
  }
  assert.match(runScript('scripts/secrets/gen-secret.mjs', ['GRAPHPAY_TOKEN'], dest).stdout, /refused \(only DEMO_PASSCODE/);
});

test('status hides lines that are not plain names', () => {
  const dest = join(repo(), '.env');
  writeFileSync(dest, `CRON_SECRET=${'c'.repeat(30)}\nAbCdEf123=\nlower_case=1\n`);
  const res = runScript('scripts/secrets/status.mjs', [], dest);
  assert.ok(!res.stdout.includes('AbCdEf123') && !res.stdout.includes('lower_case'));
  assert.match(res.stdout, /2 unrecognised line\(s\)/);
});

test('the error boundary redacts a keyed RPC URL from a failing call (fake RPC: chain id, then HTTP 500)', async () => {
  const { createServer } = await import('node:http');
  let calls = 0;
  const server = createServer((req, res) => {
    calls += 1;
    if (calls === 1) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x752' }));
    } else {
      res.statusCode = 500;
      res.end('boom');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const secret = `k${'9'.repeat(40)}`;
  const url = `http://127.0.0.1:${server.address().port}/${secret}`;
  const dest = join(repo(), '.env');
  writeFileSync(dest, `WHITECHAIN_RPC_URL=${url}\n`);
  const probe = `
    import { createPublicClient, http } from 'viem';
    import { resolveRpc } from './packages/config/index.mjs';
    import { loadEnv } from './scripts/lib/env-loader.mjs';
    import { installErrorBoundary } from './scripts/lib/redact.mjs';
    const { values } = loadEnv();
    installErrorBoundary(() => values);
    const rpc = await resolveRpc('whitechain', { env: Object.fromEntries(values) });
    console.log('resolved', JSON.stringify(rpc));
    try {
      await createPublicClient({ transport: http(rpc.url, { retryCount: 0 }) }).getBlockNumber();
    } catch (e) {
      throw new Error(e.message); // the full viem message carries the URL: only the boundary can hide it
    }
  `;
  const res = await new Promise((resolveRun) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', probe], { env: { ...process.env, ENV_FILE: dest } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (status) => resolveRun({ status, out }));
  });
  server.close();
  assert.equal(res.status, 1);
  assert.match(res.out, /resolved \{"label":"WHITECHAIN_RPC_URL \(secret\)"/);
  assert.match(res.out, /^error: /m);
  assert.ok(!res.out.includes(secret), 'the keyed URL leaked');
});

// secrets:vercel runs here only with --dry-run, and with a fake `vercel` first on PATH
// that records any call, so no test can reach the real project.
function runVercelPush(args, envFile) {
  const bin = mkdtempSync(join(tmpdir(), 'gp-bin-'));
  const calls = join(bin, 'calls.log');
  writeFileSync(join(bin, 'vercel'), `#!/bin/sh\necho called >> "${calls}"\nexit 1\n`, { mode: 0o755 });
  const res = spawnSync(process.execPath, ['scripts/secrets/vercel-push.mjs', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ENV_FILE: envFile, PATH: `${bin}:${process.env.PATH}` },
  });
  const called = existsSync(calls);
  rmSync(bin, { recursive: true, force: true });
  return { ...res, called };
}

test('secrets:vercel refuses client-exposed and unknown names, defaults to production only, never prints a value', () => {
  const dest = join(repo(), '.env');
  writeFileSync(dest, `RECORDER_TOKEN=${'r'.repeat(30)}\n`);
  for (const name of ['NEXT_PUBLIC_RPC', 'VITE_KEY', 'NOT_A_NAME']) {
    const res = runVercelPush([name, '--dry-run'], dest);
    assert.equal(res.status, 1, name);
  }
  const dry = runVercelPush(['RECORDER_TOKEN', '--dry-run'], dest);
  assert.equal(dry.status, 0);
  assert.equal(dry.stdout.trim(), 'RECORDER_TOKEN → graphpay-event production (Sensitive): dry run');
  assert.ok(!dry.stdout.includes('r'.repeat(30)));
  const both = runVercelPush(['RECORDER_TOKEN', '--env', 'production,preview', '--dry-run'], dest);
  assert.equal(both.status, 0);
  assert.deepEqual(both.stdout.trim().split('\n'), [
    'RECORDER_TOKEN → graphpay-event production (Sensitive): dry run',
    'RECORDER_TOKEN → graphpay-event preview (Sensitive): dry run',
  ]);
  assert.equal(runVercelPush(['CRON_SECRET', '--dry-run'], dest).status, 1); // not set
  for (const res of [dry, both]) assert.equal(res.called, false);
});

test('secrets:vercel keeps the local-only role keys off Vercel with a name-only reason, and allows the hosted ones', () => {
  const local = ['FUNDER', 'OPERATOR', 'DEPLOYER', 'POLICY_WRITER', 'W_LEDGER', 'W_SEED_EVENT', 'W_SEED_M_EVENT'];
  const hosted = ['FACILITATOR', 'RENEWER', 'W_SYNC', 'W_DIRECTORY', 'VITALIK', 'SHOP_KESAR', 'SHOP_JAMUN', 'SHOP_SYRUP', 'PAYER', 'DEAL_HUNTER', 'REHEARSAL_PAYER', 'ACCEPTANCE_PAYER', 'DISPOSABLE_1', 'DISPOSABLE_2'];
  const keys = Object.fromEntries([...local, ...hosted].map((role) => [`${role}_PRIVATE_KEY`, generatePrivateKey()]));
  const dest = join(repo(), '.env');
  writeFileSync(dest, `${Object.entries(keys).map(([name, key]) => `${name}=${key}`).join('\n')}\n`);
  const leaked = (res) => Object.values(keys).some((key) => res.stdout.includes(key.slice(2)) || res.stderr.includes(key.slice(2)));
  for (const role of local) {
    const res = runVercelPush([`${role}_PRIVATE_KEY`, '--dry-run'], dest);
    assert.equal(res.status, 1, role);
    assert.match(res.stdout, new RegExp(`^${role}_PRIVATE_KEY: refused \\(this key stays on the founder's Mac; .+\\)$`, 'm'), role);
    assert.ok(!leaked(res) && !res.called, role);
  }
  assert.match(runVercelPush(['W_LEDGER_PRIVATE_KEY', '--dry-run'], dest).stdout, /the single mirror writer: a second writer corrupts tallies/);
  // One local-only key among hosted ones stops the whole run before anything is sent.
  const mixed = runVercelPush(['PAYER_PRIVATE_KEY', 'W_LEDGER_PRIVATE_KEY', '--dry-run'], dest);
  assert.equal(mixed.status, 1);
  assert.ok(!mixed.stdout.includes('dry run'));
  const ok = runVercelPush([...hosted.map((role) => `${role}_PRIVATE_KEY`), '--dry-run'], dest);
  assert.equal(ok.status, 0, ok.stdout);
  for (const role of hosted) assert.match(ok.stdout, new RegExp(`^${role}_PRIVATE_KEY → graphpay-event production \\(Sensitive\\): dry run$`, 'm'), role);
  assert.ok(!leaked(ok) && !ok.called);
});

test('secrets:vercel refuses every unrecognised flag before reading or sending anything, never echoing a value', () => {
  const dest = join(repo(), '.env');
  writeFileSync(dest, `RECORDER_TOKEN=${'r'.repeat(30)}\n`);
  const secret = SAMPLES['anthropic-api-key'];
  const cases = [
    ['--dryrun'],
    ['--env=preview'],
    ['--env=production,preview'],
    ['--force'],
    ['-n'],
    ['--'],
    ['--env'],
    ['--env', 'staging'],
    ['--env', 'production,'],
    ['--env', 'production', '--env', 'preview'],
    ['--env', '--dry-run'],
    [`--token=${secret}`],
    [`--${secret}`],
  ];
  for (const extra of cases) {
    const res = runVercelPush(['RECORDER_TOKEN', '--dry-run', ...extra], dest);
    const what = extra.join(' ').replace(secret, '<secret>');
    assert.equal(res.status, 1, what);
    assert.ok(!res.stdout.includes('dry run') && !res.called, what);
    assert.ok(!`${res.stdout}${res.stderr}`.includes(secret) && !res.stdout.includes('r'.repeat(30)), what);
  }
  assert.match(runVercelPush(['RECORDER_TOKEN', '--dry-run', '--dryrun'], dest).stdout, /refused \(unrecognised flag --dryrun; the flags are/);
  assert.match(runVercelPush(['RECORDER_TOKEN', '--dry-run', '--env=preview'], dest).stdout, /refused \(unrecognised flag --env=…;/);
  assert.match(runVercelPush(['RECORDER_TOKEN', '--dry-run', `--token=${secret}`], dest).stdout, /unrecognised flag --token=…;/);
  const named = runVercelPush([`ANTHROPIC_API_KEY=${secret}`, '--dry-run'], dest);
  assert.equal(named.status, 1);
  assert.ok(!`${named.stdout}${named.stderr}`.includes(secret) && !named.called);
  // Flags are checked before .env is read: a missing ENV_FILE is not the reported problem.
  const missing = runVercelPush(['RECORDER_TOKEN', '--dry-run', '--dryrun'], join(dirname(dest), 'absent.env'));
  assert.match(missing.stdout, /unrecognised flag --dryrun/);
});
