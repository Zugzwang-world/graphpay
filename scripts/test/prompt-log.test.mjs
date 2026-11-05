import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildLine, logRoot, MAX_PROMPT_BYTES, shortenHome } from '../hooks/prompt-log.mjs';
import { hex, SAMPLES, twelveWords } from './samples.mjs';

const HOOK = 'scripts/hooks/prompt-log.mjs';

test('harness turns are skipped', async () => {
  const turns = [
    '<task-notification>done</task-notification>',
    '  <system-reminder>note</system-reminder>',
    '<ci-monitor-event>pr</ci-monitor-event>',
    '<side-sessions-event>x</side-sessions-event>',
    '<scheduled-task>tick</scheduled-task>',
    '[Artifact comment sent to Claude] hello',
  ];
  for (const prompt of turns) assert.equal(await buildLine({ prompt, session_id: 's1' }), null, prompt);
});

test('a founder prompt is kept as typed', async () => {
  const line = JSON.parse(await buildLine({ prompt: 'Build M0. Go.', session_id: 'abc-123-def-456' }));
  assert.equal(line.prompt, 'Build M0. Go.');
  assert.equal(line.session, 'abc-123-');
});

test('every secret shape is masked', async () => {
  for (const [label, sample] of Object.entries(SAMPLES)) {
    const out = await buildLine({ prompt: `here it is: ${sample} thanks`, session_id: 's' });
    assert.ok(!out.includes(sample), label);
    assert.ok(out.includes(`<masked:${label}`), label);
  }
});

test('recovery phrases in quotes, lists and comma forms are masked', async () => {
  const words = await twelveWords();
  for (const prompt of [
    `my Secret Recovery Phrase is "${words.join(' ')}"`,
    `seed words:\n${words.map((w, i) => `${i + 1}) ${w}`).join('\n')}`,
    `mnemonic: ${words.join(', ')}`,
  ]) {
    const out = await buildLine({ prompt, session_id: 's' });
    assert.ok(!out.includes(words.slice(2, 6).join(' ')) && !out.includes(words[7]), prompt.slice(0, 30));
  }
});

test('a bare 64-hex value is masked in the prompt log', async () => {
  const out = await buildLine({ prompt: `try ${hex(64, 'f')} please`, session_id: 's' });
  assert.ok(out.includes('<masked:hex-64-possible-key>'));
});

test('prompts over 256 KB are withheld', async () => {
  const out = JSON.parse(await buildLine({ prompt: 'x'.repeat(MAX_PROMPT_BYTES + 1), session_id: 's' }));
  assert.equal(out.withheld, 'prompt over 256 KB');
  assert.equal(out.prompt, undefined);
});

test('the home folder is written as ~', () => {
  assert.equal(shortenHome('see /Users/someone/graphpay/x', '/Users/someone'), 'see ~/graphpay/x');
});

test('the hook prints nothing, exits 0 and writes private files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gp-hook-'));
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt: 'hello', session_id: 'sess1234' }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
  const raw = join(dir, 'prompts', 'raw');
  const [file] = readdirSync(raw);
  assert.match(file, /^\d{4}-\d{2}-\d{2}-sess1234\.jsonl$/);
  assert.equal(statSync(raw).mode & 0o777, 0o700);
  assert.equal(statSync(join(raw, file)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(join(raw, file), 'utf8')).prompt, 'hello');
});

test('malformed input prints nothing and exits 0', () => {
  const res = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
});

test('a worktree session logs into its own checkout, not the project folder', () => {
  const project = mkdtempSync(join(tmpdir(), 'gp-project-'));
  const worktree = realpathSync(mkdtempSync(join(tmpdir(), 'gp-worktree-')));
  assert.equal(spawnSync('git', ['init', '-q', worktree]).status, 0);
  const sub = join(worktree, 'apps', 'web');
  mkdirSync(sub, { recursive: true });
  assert.equal(logRoot({ cwd: sub }, { CLAUDE_PROJECT_DIR: project }), worktree);
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt: 'hello', session_id: 'wt123456', cwd: sub }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
  assert.equal(readdirSync(join(worktree, 'prompts', 'raw')).length, 1);
  assert.equal(existsSync(join(project, 'prompts')), false);
});

test('outside a git checkout the log falls back to the project folder', () => {
  const project = mkdtempSync(join(tmpdir(), 'gp-project-'));
  const plain = mkdtempSync(join(tmpdir(), 'gp-plain-'));
  assert.equal(logRoot({ cwd: plain }, { CLAUDE_PROJECT_DIR: project }), project);
  assert.equal(logRoot({}, { CLAUDE_PROJECT_DIR: project }), project);
});
