// The one lookup for secrets (SPEC/SECURITY_AND_OPS.md §3). Worktrees have no
// .env of their own, so: ENV_FILE if set (it must be git-ignored); else this
// checkout's .env (git-ignored); else the main checkout's .env, found through
// `git rev-parse --git-common-dir`, only if git ignores it there.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvError, readEnvFile } from './env-file.mjs';

// Lookups start from the checkout that holds these scripts, not the caller's
// working directory, so a script run from another folder never picks up a
// different repo's .env.
const SCRIPTS_CHECKOUT = fileURLToPath(new URL('.', import.meta.url));

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function isGitIgnored(file) {
  try {
    execFileSync('git', ['check-ignore', '-q', basename(file)], { cwd: dirname(file), stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function mainCheckout(cwd) {
  const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return basename(common) === '.git' ? dirname(common) : null;
}

// Returns { path, source }. With create: true and no file anywhere, returns the
// main checkout's .env (which the writer then creates), still only if ignored.
export function locateEnvFile({ cwd = SCRIPTS_CHECKOUT, env = process.env, create = false } = {}) {
  if (env.ENV_FILE) {
    const path = isAbsolute(env.ENV_FILE) ? env.ENV_FILE : resolve(process.cwd(), env.ENV_FILE);
    if (!existsSync(dirname(path)) || !isGitIgnored(path)) throw new EnvError('ENV_FILE: refused (it must be a git-ignored file)');
    if (!create && !existsSync(path)) throw new EnvError('ENV_FILE: refused (no such file)');
    return { path, source: 'ENV_FILE' };
  }
  let top;
  try {
    top = git(cwd, ['rev-parse', '--show-toplevel']);
  } catch {
    throw new EnvError('no .env: not inside a git checkout');
  }
  const local = join(top, '.env');
  if (existsSync(local)) {
    if (!isGitIgnored(local)) throw new EnvError('.env: refused (git does not ignore it in this checkout)');
    return { path: local, source: 'checkout' };
  }
  const main = mainCheckout(top);
  const shared = main ? join(main, '.env') : null;
  if (shared && shared !== local && (existsSync(shared) || create)) {
    if (!isGitIgnored(shared)) throw new EnvError('.env: refused (git does not ignore it in the main checkout)');
    return { path: shared, source: 'main checkout' };
  }
  if (create) {
    if (!isGitIgnored(local)) throw new EnvError('.env: refused (git does not ignore it in this checkout)');
    return { path: local, source: 'checkout' };
  }
  throw new EnvError('no .env found (this checkout, the main checkout or ENV_FILE)');
}

// Loads the values without touching process.env. Never print them.
export function loadEnv(options) {
  const { path, source } = locateEnvFile(options);
  return { path, source, values: readEnvFile(path) };
}
