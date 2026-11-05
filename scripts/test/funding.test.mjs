import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { config } from '../../packages/config/index.mjs';

const plan = JSON.parse(readFileSync('scripts/funding/plan.json', 'utf8'));
const fresh = new Set(config.wallets.fresh.map((w) => w.role));

test('every funded role is a fresh role in the config (FUNDER and OPERATOR are never targets)', () => {
  for (const section of [plan.m0, plan.later, plan.usdt]) {
    for (const network of ['whitechain', 'sepolia', 'rabdi']) {
      for (const role of Object.keys(section[network] ?? {})) assert.ok(fresh.has(role), `${network} ${role}`);
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
