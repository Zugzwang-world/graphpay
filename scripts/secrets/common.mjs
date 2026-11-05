// Shared rules for the secret helpers: which names exist, which may be typed
// or piped in, and the checks a value must pass before it reaches .env.

import { readFileSync } from 'node:fs';
import { probeChainId } from '../../packages/config/index.mjs';
import { EnvError } from '../lib/env-file.mjs';

const ENV_EXAMPLE = new URL('../../env.example', import.meta.url);
export const DISPOSABLE = /^DISPOSABLE_[1-9][0-9]*_PRIVATE_KEY$/;

export function envNames() {
  return readFileSync(ENV_EXAMPLE, 'utf8')
    .split(/\r?\n/)
    .map((line) => /^([A-Z][A-Z0-9_]*)=$/.exec(line.trim())?.[1])
    .filter(Boolean);
}

export function isKnownName(name) {
  return envNames().includes(name) || DISPOSABLE.test(name);
}

// Role keys are generated (wallet:gen) or imported (secrets:import-lab), never typed or piped.
export function assertSettable(name) {
  if (!isKnownName(name)) throw new EnvError(`${name}: refused (not a name in env.example)`);
  if (name.endsWith('_PRIVATE_KEY')) {
    throw new EnvError(`${name}: refused (role keys are generated with wallet:gen or imported with secrets:import-lab)`);
  }
}

const EXPECTED_CHAIN = { WHITECHAIN_RPC_URL: 1874, SEPOLIA_RPC_URL: 11155111 };

export async function validateValue(name, value, { fetchImpl = globalThis.fetch } = {}) {
  if (name === 'ARKIV_RPC_URL') {
    if (!/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/.test(value)) {
      throw new EnvError('ARKIV_RPC_URL: refused (a local Arkiv node only)');
    }
    return;
  }
  if (name.endsWith('_RPC_URL')) {
    if (!value.startsWith('https://')) throw new EnvError(`${name}: refused (must be an https URL)`);
    const expected = EXPECTED_CHAIN[name];
    if (expected) {
      let chainId;
      try {
        chainId = await probeChainId(value, fetchImpl, 10000);
      } catch {
        throw new EnvError(`${name}: refused (the RPC did not answer eth_chainId)`);
      }
      if (chainId !== expected) throw new EnvError(`${name}: refused (chain id ${chainId} is not ${expected})`);
    }
  }
  if (name === 'ANTHROPIC_API_KEY' && !value.startsWith('sk-ant-')) throw new EnvError('ANTHROPIC_API_KEY: refused (not an Anthropic key)');
  if (/_(?:TOKEN|SECRET|PASSCODE)$/.test(name) && value.length < 24) throw new EnvError(`${name}: refused (at least 24 characters)`);
}

export function fail(error) {
  console.log(error instanceof EnvError ? error.message : 'refused (unexpected error)');
  process.exitCode = 1;
}
