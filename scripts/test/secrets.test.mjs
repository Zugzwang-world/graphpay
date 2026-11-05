import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('a dead writer leaves no lasting lock or temp copy', () => {
  const dir = repo();
  const file = join(dir, '.env');
  setEnvValue(file, 'A_NAME', 'one');
  const dead = 2147483646; // no such process
  writeFileSync(`${file}.lock`, String(dead));
  writeFileSync(join(dir, `.env.${dead}.0123456789ab.tmp`), 'A_NAME=copy\n');
  assert.equal(setEnvValue(file, 'B_NAME', 'two'), 'new');
  assert.deepEqual(readdirSync(dir).sort(), ['.env', '.git', '.gitignore']);
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
    await createPublicClient({ transport: http(rpc.url, { retryCount: 0 }) }).getBlockNumber();
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
