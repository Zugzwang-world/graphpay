// Reads and writes the git-ignored .env without ever printing a value
// (SPEC/SECURITY_AND_OPS.md §3). Values are never parsed as JSON; values .env
// cannot hold safely are refused with a name-only error; writes are atomic
// (temp file, fsync, rename) under a lock and leave no temp copy; CRLF files parse.

import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const NAME = /^[A-Z][A-Z0-9_]*$/;
// Printable ASCII only, without quotes, backslash, $, backtick or # (an inline comment).
const SAFE_VALUE = /^[\x20-\x7e]+$/;
const UNSAFE = /["'\\$`#]/;
const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

// Every message names the variable at most, never its value.
export class EnvError extends Error {}

// A name is echoed in messages only once it is known to be a plain variable name.
export function safeName(name) {
  return typeof name === 'string' && NAME.test(name) ? name : 'that name';
}

function parseValue(raw) {
  let value = raw.trim();
  const q = value[0];
  if ((q === '"' || q === "'") && value.length >= 2 && value.at(-1) === q) return value.slice(1, -1);
  const comment = value.search(/\s#/);
  if (comment !== -1) value = value.slice(0, comment).trimEnd();
  return value;
}

export function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (m && !line.trimStart().startsWith('#')) values.set(m[1], parseValue(m[2]));
  }
  return values;
}

export function readEnvFile(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : new Map();
}

export function assertSafeValue(name, value) {
  if (!NAME.test(name)) throw new EnvError('refused: not a valid variable name');
  if (typeof value !== 'string' || value.length === 0) throw new EnvError(`${name}: refused (empty value)`);
  if (!SAFE_VALUE.test(value) || UNSAFE.test(value)) {
    throw new EnvError(`${name}: refused (only printable ASCII without quotes, backslash, $, backtick or # can be stored safely)`);
  }
  if (value !== value.trim()) throw new EnvError(`${name}: refused (leading or trailing whitespace)`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// Temp copies left by a writer that died between write and rename (they hold a full .env).
function sweepStaleTemps(path) {
  const dir = dirname(path);
  const prefix = `${basename(path)}.`;
  for (const name of readdirSync(dir)) {
    const m = name.startsWith(prefix) && /\.(\d+)\.[0-9a-f]{12}\.tmp$/.exec(name);
    if (m && !alive(Number(m[1]))) unlinkSync(join(dir, name));
  }
}

function lockHolder(lock) {
  try {
    return Number(readFileSync(lock, 'utf8').split(':')[0]) || null;
  } catch {
    return null;
  }
}

// The lock appears atomically with its owner already written (a temp file holding
// "pid:token" is hard-linked to the lock name, which fails if the lock exists).
// A held lock is never broken: a writer waits up to 5 s, then stops and names the
// holder, so two writers can never both be inside. Only our own lock is removed.
function withLock(path, fn) {
  const lock = `${path}.lock`;
  const token = `${process.pid}:${randomBytes(8).toString('hex')}`;
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, token, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    throw new EnvError(`could not lock ${basename(path)} (${error.code ?? 'error'})`);
  }
  try {
    for (let tries = 0; ; tries += 1) {
      try {
        linkSync(tmp, lock);
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw new EnvError(`could not lock ${basename(path)} (${error.code ?? 'error'})`);
        if (tries >= 50) {
          const holder = lockHolder(lock);
          const state = holder === null ? 'an unknown writer' : `pid ${holder}${alive(holder) ? ', still running' : ', not running'}`;
          throw new EnvError(
            `${basename(path)} is locked by ${state}; if no secrets script is running, remove ${basename(lock)} in ${dirname(lock)}`,
          );
        }
        sleep(100);
      }
    }
  } finally {
    try {
      unlinkSync(tmp);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  try {
    sweepStaleTemps(path);
    return fn();
  } finally {
    try {
      if (readFileSync(lock, 'utf8') === token) unlinkSync(lock);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function writeAtomic(path, content) {
  const dir = dirname(path);
  const tmp = join(dir, `${basename(path)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  let fd;
  try {
    fd = openSync(tmp, 'wx', 0o600);
    writeSync(fd, content);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
    chmodSync(path, 0o600);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(tmp)) unlinkSync(tmp);
    throw new EnvError(`could not write ${basename(path)} (${error.code ?? 'error'})`);
  }
  try {
    const dirFd = openSync(dir, 'r');
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch {
    // Directory fsync is best effort (not supported everywhere).
  }
}

// Sets one name and keeps every other line as it was. Returns 'new', 'updated'
// or 'unchanged'. A different existing value is refused unless overwrite is true.
export function setEnvValue(path, name, value, { overwrite = false } = {}) {
  assertSafeValue(name, value);
  return withLock(path, () => {
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text === '' ? [] : text.split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    const at = lines.flatMap((line, i) => (LINE.exec(line)?.[1] === name && !line.trimStart().startsWith('#') ? [i] : []));
    if (at.length > 1) throw new EnvError(`${name}: appears more than once in .env; fix it by hand`);
    let status = 'new';
    if (at.length === 1) {
      const current = parseValue(LINE.exec(lines[at[0]])[2]);
      if (current === value) return 'unchanged';
      if (current !== '' && !overwrite) throw new EnvError(`${name}: refused (a different value is already set)`);
      status = current === '' ? 'new' : 'updated';
      lines[at[0]] = `${name}=${value}`;
    } else {
      lines.push(`${name}=${value}`);
    }
    writeAtomic(path, lines.join(eol) + eol);
    return status;
  });
}
