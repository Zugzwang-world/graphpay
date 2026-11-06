import { describe, expect, it } from 'vitest';
import type { AgentState } from '@/demo/contract';
import { usdt } from '@/lib/money';
import { agentCardStatus, permissionChangeForAction } from './CustomerAgents';

const agent: AgentState = {
  ref: { ens: 'payer.example.eth', role: 'payer', owner: 'customer.example.eth' },
  label: 'Payer',
  main: false,
  pays: true,
  does: 'Pays within your pass',
  status: 'active',
  pass: { cap: usdt('6.00'), used: usdt('2.00'), period: 'day', expiresAt: 1_800_000_000_000, state: 'active' },
  refusedAttempts: [],
};

describe('Agents page state mapping', () => {
  it('uses the worst visible status for a spending agent', () => {
    expect(agentCardStatus(agent)).toBe('active');
    expect(agentCardStatus({ ...agent, pass: { ...agent.pass!, state: 'used_up' } })).toBe('usedUp');
    expect(agentCardStatus({ ...agent, pass: { ...agent.pass!, state: 'expired' } })).toBe('expired');
    expect(agentCardStatus({ ...agent, status: 'paused', pass: { ...agent.pass!, state: 'expired' } })).toBe('paused');
    expect(agentCardStatus({ ...agent, status: 'revoked', pass: { ...agent.pass!, state: 'active' } })).toBe('revokedFinal');
  });

  it('matches pending permission controls to adapter event names', () => {
    expect(permissionChangeForAction('pause')).toBe('paused');
    expect(permissionChangeForAction('resume')).toBe('resumed');
    expect(permissionChangeForAction('revoke')).toBe('revoked');
    expect(permissionChangeForAction('selfRaise')).toBeNull();
    expect(permissionChangeForAction('setCap')).toBeNull();
  });
});
