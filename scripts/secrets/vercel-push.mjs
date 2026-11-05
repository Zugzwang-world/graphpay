// pnpm -s secrets:vercel NAME [NAME...] [--env production[,preview]] [--dry-run]
// Copies values from .env to the Vercel project in the config file as Sensitive
// values (planning/SPEC/SECURITY_AND_OPS.md §3, §6). Each value goes on the CLI's
// stdin, never on the command line, and is never printed. Refuses names a browser
// bundle would expose (NEXT_PUBLIC_, VITE_), names not in env.example, and the role
// keys that stay on the founder's Mac (LOCAL_ONLY). Production only unless --env
// adds preview; any other flag is refused before anything is read or sent. The
// project and team are pinned, and VERCEL_ORG_ID / VERCEL_PROJECT_ID are dropped.

import { spawnSync } from 'node:child_process';
import { config } from '../../packages/config/index.mjs';
import { EnvError, readEnvFile, safeName } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { fail, guard, isKnownName } from './common.mjs';

guard();

const USAGE = 'usage: pnpm -s secrets:vercel NAME [NAME...] [--env production[,preview]] [--dry-run]';
const TARGETS = new Set(['production', 'preview']);
const CLIENT_EXPOSED = /^(?:NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_|NUXT_PUBLIC_|EXPO_PUBLIC_)/;

// Role keys no hosted service holds (planning/SPEC/ARCHITECTURE.md §3, planning/WALLETS.md §1).
// Every other role key (the relayers, the recorder, the directory writer, the persona,
// the shops, the paying, working and disposable agents) may go to Vercel.
const LOCAL_ONLY = Object.freeze({
  FUNDER_PRIVATE_KEY: 'the bank: funding transfers run from there',
  OPERATOR_PRIVATE_KEY: 'it owns the ENS root: ENS provisioning runs from there',
  DEPLOYER_PRIVATE_KEY: 'the contract admin: deploys and role grants run from there',
  POLICY_WRITER_PRIVATE_KEY: 'setPolicy runs in the one workers process there',
  W_LEDGER_PRIVATE_KEY: 'the single mirror writer: a second writer corrupts tallies',
  W_SEED_EVENT_PRIVATE_KEY: 'the seeder runs there',
  W_SEED_M_EVENT_PRIVATE_KEY: 'the seeder runs there',
});

// A flag is echoed only as a short plain flag word, never past an '='.
function flagLabel(arg) {
  const [word, ...rest] = arg.split('=');
  const shown = /^--?[a-z][a-z0-9-]{0,23}$/.test(word) ? word : 'that flag';
  return rest.length > 0 ? `${shown}=…` : shown;
}

function parseArgs(args) {
  const names = [];
  let targets = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--env') {
      const value = args[i + 1];
      if (targets !== null || value === undefined || value.startsWith('-')) throw new EnvError(USAGE);
      targets = [...new Set(value.split(','))];
      i += 1;
    } else if (arg.startsWith('-')) {
      throw new EnvError(`refused (unrecognised flag ${flagLabel(arg)}; the flags are --env production[,preview] and --dry-run)`);
    } else {
      names.push(arg);
    }
  }
  if (names.length === 0) throw new EnvError(USAGE);
  targets ??= ['production'];
  for (const t of targets) if (!TARGETS.has(t)) throw new EnvError('refused: --env takes production, preview or production,preview');
  return { names: [...new Set(names)], targets, dryRun };
}

function main() {
  const { names, targets, dryRun } = parseArgs(process.argv.slice(2));
  const { project, projectId, team } = config.site.vercel;
  const values = readEnvFile(locateEnvFile().path);
  for (const name of names) {
    if (CLIENT_EXPOSED.test(name)) throw new EnvError(`${safeName(name)}: refused (a client-exposed name would put the value in the browser bundle)`);
    if (Object.hasOwn(LOCAL_ONLY, name)) throw new EnvError(`${name}: refused (this key stays on the founder's Mac; ${LOCAL_ONLY[name]})`);
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
