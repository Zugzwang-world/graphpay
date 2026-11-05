import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBuyerRisk } from '@graphpay/agents';
import { askDocument, askTable } from '@graphpay/money-graph';

// The contract between T3's MCP `ask(buyer_risk)` and T4's parser: the shop's risk check
// must read the table the hosted MCP answers. Test-only names and values.
test('ask(buyer_risk) answers the columns the shop risk check parses', () => {
  const doc = askDocument({ intent: 'buyer_risk', ens: ['agent.persona.example.eth'], window: 'D90' });
  const data = { n0: { ens: 'agent.persona.example.eth', status: 'active', capMicro: '30000000', owner: { ens: 'persona.example.eth', verified: true }, reputation: { orders: '6', cancellations: '1', disputes: '0' }, today: { paidUsdt: '6.81' } } };
  const s = parseBuyerRisk(`${askTable('buyer_risk', data, doc.columns)}\nexplain=0123456789ab calls=2`, 'agent.persona.example.eth');
  assert.ok(s, 'parsed');
  assert.equal(s.orders, 6);
  assert.equal(s.cancellations, 1);
  assert.equal(s.dailyCapMicro, 30_000_000n);
  assert.equal(s.spendTodayMicro, 6_810_000n);
  assert.equal(s.status, 'ACTIVE');
});
