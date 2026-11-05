// The spending pass (planning/EVENT_ADDENDUM.md part D): the agent's state from the
// on-chain policy and the ENS status. The worst state wins: a stopped agent never
// reads "Active", whatever it has left to spend.

import type { AgentStatus } from './contracts.ts';

export type PassState = 'Active' | 'Used up' | 'Expired' | 'Paused' | 'Revoked' | 'Unknown';

export interface PassInput {
  status: AgentStatus;
  capMicro: string;
  spentTodayMicro: string;
  // The policy's expiry (ISO), when the route reports one.
  expiresAt?: string | null;
}

export function passState(input: PassInput, now: Date = new Date()): PassState {
  if (input.status === 'REVOKED') return 'Revoked';
  if (input.status === 'PAUSED') return 'Paused';
  if (input.status === 'EXPIRED') return 'Expired';
  if (input.status === 'UNKNOWN') return 'Unknown';
  const expires = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  if (!Number.isNaN(expires) && expires <= now.getTime()) return 'Expired';
  if (BigInt(input.spentTodayMicro) >= BigInt(input.capMicro)) return 'Used up';
  return 'Active';
}

export function remainingMicro(capMicro: string, spentTodayMicro: string): bigint {
  const left = BigInt(capMicro) - BigInt(spentTodayMicro);
  return left > 0n ? left : 0n;
}
