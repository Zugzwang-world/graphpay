// The workers process keeps the Mac awake for as long as it runs (ADR-0056): the
// system sleeps after a minute idle, and the mirror runs overnight. `caffeinate -w`
// ends by itself when the process it watches exits.

import { spawn } from 'node:child_process';

export const CAFFEINATE_ARGS = (pid) => ['-ims', '-w', String(pid)];

export function keepAwake({ pid = process.pid, platform = process.platform, spawnImpl = spawn } = {}) {
  if (platform !== 'darwin') return { held: false, why: `no caffeinate on ${platform}` };
  const child = spawnImpl('caffeinate', CAFFEINATE_ARGS(pid), { stdio: 'ignore', detached: false });
  child.unref?.();
  return { held: true, pid: child.pid, why: `caffeinate -ims -w ${pid}` };
}
