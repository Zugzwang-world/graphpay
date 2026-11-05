// `pnpm syntax`: `node --check` on every script and `sh -n` on every shell script.

import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const scripts = files.filter((f) => /^scripts\/.*\.m?js$/.test(f));
const shells = files.filter((f) => f.endsWith('.sh') || f.startsWith('.githooks/'));

let failed = 0;
for (const f of scripts) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch {
    console.log(`syntax error: ${f}`);
    failed += 1;
  }
}
for (const f of shells) {
  try {
    execFileSync('sh', ['-n', f], { stdio: 'pipe' });
  } catch {
    console.log(`syntax error: ${f}`);
    failed += 1;
  }
}
console.log(`syntax: ${scripts.length} scripts, ${shells.length} shell files, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
