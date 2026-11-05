// pnpm -s secrets:vercel NAME [NAME...] [--env production,preview] [--dry-run]
// Copies values from .env to the Vercel project in the config file as Sensitive
// values (planning/SPEC/SECURITY_AND_OPS.md §3, §6). Each value goes on the CLI's
// stdin, never on the command line, and is never printed. Refuses names a browser
// bundle would expose (NEXT_PUBLIC_, VITE_) and names not in env.example. The
// project and team are pinned, and VERCEL_ORG_ID / VERCEL_PROJECT_ID are dropped.

import { spawnSync } from 'node:child_process';
import { config } from '../../packages/config/index.mjs';
import { EnvError, readEnvFile, safeName } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { fail, guard, isKnownName } from './common.mjs';

guard();

const TARGETS = new Set(['production', 'preview']);
const CLIENT_EXPOSED = /^(?:NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_|NUXT_PUBLIC_|EXPO_PUBLIC_)/;

function main() {
  const args = process.argv.slice(2);
  const envArg = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'production,preview';
  const targets = envArg.split(',');
  const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--env');
  const dryRun = args.includes('--dry-run');
  const { project, projectId, team } = config.site.vercel;
  if (names.length === 0) throw new EnvError('usage: pnpm -s secrets:vercel NAME [NAME...] [--env production,preview] [--dry-run]');
  for (const t of targets) if (!TARGETS.has(t)) throw new EnvError(`refused: environment must be production or preview`);
  const values = readEnvFile(locateEnvFile().path);
  for (const name of names) {
    if (CLIENT_EXPOSED.test(name)) throw new EnvError(`${safeName(name)}: refused (a client-exposed name would put the value in the browser bundle)`);
    if (!isKnownName(name)) throw new EnvError(`${safeName(name)}: refused (not a name in env.example)`);
    if (!values.get(name)) throw new EnvError(`${name}: refused (not set in .env)`);
  }
  const env = { ...process.env };
  delete env.VERCEL_ORG_ID;
  delete env.VERCEL_PROJECT_ID;
  let failed = 0;
  for (const name of names) {
    for (const target of targets) {
      const argv = ['env', 'add', name, '--environment', target, '--force', '--yes', '--sensitive', '--project', projectId, '--scope', team];
      if (dryRun) {
        console.log(`${name} → ${project} ${target} (Sensitive): dry run`);
        continue;
      }
      const res = spawnSync('vercel', argv, { input: values.get(name), env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      // CLI output is not echoed (it can quote what it read); only the outcome is.
      if (res.status === 0) console.log(`${name} → ${project} ${target} (Sensitive): set`);
      else {
        console.log(`${name} → ${project} ${target}: refused by the Vercel CLI (exit ${res.status})`);
        failed += 1;
      }
    }
  }
  if (failed > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  fail(error);
}
