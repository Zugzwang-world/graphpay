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
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const NAME = /^[A-Z][A-Z0-9_]*$/;
const UNSAFE = /["'\\$`\r\n\0]/;
const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

// Every message names the variable at most, never its value.
export class EnvError extends Error {}

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
  if (UNSAFE.test(value)) {
    throw new EnvError(`${name}: refused (quotes, backslash, $, backtick or newline cannot be stored safely)`);
  }
  if (value !== value.trim()) throw new EnvError(`${name}: refused (leading or trailing whitespace)`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(path, fn) {
  const lock = `${path}.lock`;
  let fd;
  for (let tries = 0; fd === undefined; tries += 1) {
    try {
      fd = openSync(lock, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST' || tries >= 50) {
        throw new EnvError(`.env is locked by another writer (remove ${basename(lock)} if no script is running)`);
      }
      sleep(100);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    unlinkSync(lock);
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
