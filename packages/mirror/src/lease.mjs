// Exactly one workers process (E-2; SPEC/INTEGRATION_AND_MIRROR.md §8 item 17). The
// heartbeat row on Arkiv is the lease: patched every 30 s, and a start is refused while
// another instance's row is fresher than 90 s. A local claim file lets a restart on
// the same machine take over at once when the instance that wrote the row has exited.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HEARTBEAT_EVERY_MS = 30_000;
export const STALE_AFTER_S = 90;
export const ARKIV_BLOCK_S = 2;

export const newInstanceId = () => randomBytes(8).toString('hex');

export const defaultClaimPath = () => join(tmpdir(), 'graphpay-workers.claim.json');

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

export function readClaim(path = defaultClaimPath()) {
  if (!existsSync(path)) return null;
  try {
    const c = JSON.parse(readFileSync(path, 'utf8'));
    return typeof c?.instance === 'string' && Number.isInteger(c?.pid) ? c : null;
  } catch {
    return null;
  }
}

export function writeClaim(claim, path = defaultClaimPath()) {
  writeFileSync(path, `${JSON.stringify(claim)}\n`, { mode: 0o600 });
}

// Takes the claim file exclusively: refused while another live process holds it; a
// claim left by an exited process is replaced.
export function takeClaim(claim, path = defaultClaimPath()) {
  const text = `${JSON.stringify(claim)}\n`;
  try {
    writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const held = readClaim(path);
    if (held && held.instance !== claim.instance && held.pid !== process.pid && pidAlive(held.pid)) {
      throw Object.assign(new Error(`workers: another workers process (pid ${held.pid}) holds ${path}`), { code: 'LEASE_HELD' });
    }
    unlinkSync(path);
    writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
  }
}

export function dropClaim(instance, path = defaultClaimPath()) {
  const c = readClaim(path);
  if (c?.instance === instance) unlinkSync(path);
}

// The heartbeat's age in seconds: by Arkiv blocks when both are known (no clock
// skew), else by the row's own timestamp.
export function heartbeatAgeS(row, { arkivBlock, nowS = Math.floor(Date.now() / 1000) } = {}) {
  if (row.updatedBlock != null && arkivBlock != null) return Math.max(0, (arkivBlock - row.updatedBlock) * ARKIV_BLOCK_S);
  return Math.max(0, nowS - row.updatedTs);
}

// May this instance run? row: the heartbeat on Arkiv (or null); claim: this machine's
// claim file (or null), with `alive` = whether its process still runs.
export function leaseDecision({ row, instance, ageS, claim, staleAfterS = STALE_AFTER_S }) {
  if (!row) return { ok: true, why: 'no heartbeat on Arkiv' };
  if (row.instance === instance) return { ok: true, why: 'this instance' };
  if (row.state === 'stopped') return { ok: true, why: `instance ${row.instance} stopped cleanly` };
  if (ageS > staleAfterS) return { ok: true, why: `heartbeat ${ageS} s old (stale after ${staleAfterS} s)` };
  if (claim && claim.instance === row.instance && !claim.alive) {
    return { ok: true, why: `instance ${row.instance} ran on this machine and has exited` };
  }
  return { ok: false, why: `another workers process (instance ${row.instance}) wrote its heartbeat ${ageS} s ago` };
}
