// Address-only views of the role keys in .env. A key never leaves this module;
// callers get public addresses.

import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';

export const CARRIED = Object.keys(config.wallets.carried);
export const FRESH = config.wallets.fresh.map((w) => w.role);
export const DISPOSABLE_ROLE = /^DISPOSABLE_[1-9][0-9]*$/;

export function addressOfKey(key) {
  try {
    return privateKeyToAccount(key).address;
  } catch {
    return null; // not a valid key; the value is never shown
  }
}

// { ROLE: address | null } for every *_PRIVATE_KEY in the env values.
export function roleAddresses(values) {
  const out = {};
  for (const [name, value] of values) {
    const role = /^([A-Z][A-Z0-9_]*)_PRIVATE_KEY$/.exec(name)?.[1];
    if (role && value) out[role] = addressOfKey(value);
  }
  return out;
}

export function labAddresses() {
  return new Set(config.wallets.labNotUsed.map((a) => a.toLowerCase()));
}
