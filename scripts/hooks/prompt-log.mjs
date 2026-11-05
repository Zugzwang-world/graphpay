// UserPromptSubmit hook (ADR-0001): appends each founder prompt, masked, to
// prompts/raw/<IST date>-<session>.jsonl in the session's own checkout (one
// file per session, so parallel sessions never conflict). It prints nothing, because a UserPromptSubmit
// hook's stdout enters the context, and it always exits 0.

import { execFileSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_PROMPT_BYTES = 256 * 1024;

// Harness turns are not founder prompts.
const HARNESS_TURN =
  /^\s*(?:<(?:task-notification|system-reminder|ci-monitor-event|side-sessions-event|scheduled-task|local-command-stdout|local-command-stderr|local-command-caveat|user-prompt-submit-hook)\b|\[Artifact comment sent to Claude\])/;

export function istDate(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function sessionTag(sessionId) {
  const tag = String(sessionId ?? '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 8);
  return tag || 'unknown';
}

// The local home folder names a person; the public log says "~" instead.
export function shortenHome(text, home = homedir()) {
  return home && home.length > 1 ? text.split(home).join('~') : text;
}

export async function buildLine(input, now = new Date()) {
  const { findSecrets, maskSecrets } = await import('../lib/secret-shapes.mjs');
  if (typeof input?.prompt !== 'string' || HARNESS_TURN.test(input.prompt)) return null;
  const prompt = shortenHome(input.prompt);
  const base = { ts: now.toISOString(), session: sessionTag(input.session_id) };
  if (Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES) {
    return JSON.stringify({ ...base, withheld: 'prompt over 256 KB' });
  }
  const line = JSON.stringify({ ...base, prompt: maskSecrets(prompt, { promptLog: true }) });
  const left = findSecrets(line, { promptLog: true });
  if (left.length > 0) {
    return JSON.stringify({ ...base, withheld: [...new Set(left.map((f) => f.label))].join(', ') });
  }
  return line;
}

// A session started with the worktree option works in its own checkout while
// CLAUDE_PROJECT_DIR still names the main one. The log belongs to the session's
// checkout, so its PRs carry it and the main checkout stays clean (P-records-1).
export function logRoot(input, env = process.env) {
  const cwd = typeof input?.cwd === 'string' && input.cwd ? input.cwd : null;
  if (cwd) {
    try {
      const top = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000,
      }).trim();
      if (top) return top;
    } catch {
      // Not a git checkout: fall back below.
    }
  }
  return env.CLAUDE_PROJECT_DIR || cwd || process.cwd();
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  try {
    const input = JSON.parse(await readStdin());
    const line = await buildLine(input);
    if (!line) return;
    const root = logRoot(input);
    const dir = join(root, 'prompts', 'raw');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    const file = join(dir, `${istDate()}-${sessionTag(input.session_id)}.jsonl`);
    appendFileSync(file, `${line}\n`, { mode: 0o600 });
    chmodSync(file, 0o600);
  } catch {
    // Never block a prompt and never print: a failed log line is only lost.
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
  process.exitCode = 0;
}
