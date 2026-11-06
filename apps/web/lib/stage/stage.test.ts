import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEATS, BROWSE_BEATS, ERRAND_STEPS, beatOf, isBeatKey } from './scenes.ts';
import { foldAll, parseAsk } from './errand.ts';
import { advance, caughtUp, restPace } from './pace.ts';
import { customerErrandLines, endSentence, merchantErrandLines, refundLines, type LineCast } from './lines.ts';
import { ago, orderNumber, percent } from './format.ts';

// A made-up cast: role words are structure, the names here are not the story's.
const SHOP = 'one.example.eth';
const TRAP = 'two.example.eth';
const PAYER = 'payer.person.example.eth';
const cast: LineCast = {
  timeZone: 'Asia/Kolkata',
  persona: { name: 'Person', ens: 'person.example.eth' },
  agents: {
    concierge: { label: 'Concierge', ens: 'concierge.person.example.eth' },
    scout: { label: 'Scout', ens: 'scout.person.example.eth' },
    analyst: { label: 'Analyst', ens: 'analyst.person.example.eth' },
    payer: { label: 'Payer', ens: PAYER },
    storefront: { label: 'Storefront', ens: `storefront.${SHOP}` },
    risk: { label: 'Risk', ens: `risk.${SHOP}` },
    dispatch: { label: 'Dispatch', ens: `dispatch.${SHOP}` },
  },
  shops: [
    { ens: SHOP, name: 'One', storyRole: 'good' },
    { ens: TRAP, name: 'Two', storyRole: 'trap' },
  ],
  merchant: { ens: SHOP, name: 'One' },
  order: { item: 'a thing', area: 'the corner', budgetMicro: '6000000', refundMicro: '800000', refundReason: 'it was cold', reorderItem: 'another thing' },
};

const TX = `0x${'ab'.repeat(32)}`;
const ORDER = `0x4b28${'0'.repeat(60)}`;
const msg = (from: string, to: string, text: string) => ({ event: 'trace', data: JSON.stringify({ type: 'message', from, to, text }) });
const result = (tool: string, output: unknown) => ({ event: 'trace', data: JSON.stringify({ type: 'tool.result', agent: 'x', tool, output }) });
const guard = (g: string, ok: boolean, detail: string) => ({ event: 'trace', data: JSON.stringify({ type: 'guard', guard: g, ok, detail }) });

function run(): { event: string; data: string; at: number }[] {
  const c = cast.agents;
  const frames = [
    { event: 'started', data: JSON.stringify({ runId: 'r1' }) },
    msg(cast.persona.ens, c.concierge!.ens, 'the request'),
    guard('G1', true, 'mandate from the human’s words: at most 6.000000 USDT, by 2026-11-07T03:40:00+05:30 (hash 0x1)'),
    msg(c.concierge!.ens, c.scout!.ens, 'find'),
    msg(c.concierge!.ens, c.analyst!.ens, 'rank'),
    result('directory_list', { shops: [TRAP, SHOP] }),
    result('catalog_read', { offers: [{ shop: TRAP, sku: 's2', priceUsdt: '3.300000', etaMinutes: 25, distanceKm: 0.9 }] }),
    { event: 'trace', data: JSON.stringify({ type: 'tool.call', agent: c.analyst!.ens, tool: 'graphql', input: { query: 'query Q { nodes { ens } }' } }) },
    result('graphql', { content: [{ type: 'text', text: JSON.stringify({ data: { nodes: [{ ens: SHOP, reputation: { orders: '245', refundRate: '0.0122', onTimeRate: '0.9714', synthetic: true } }, { ens: TRAP, reputation: { orders: '110', refundRate: '0.1818', onTimeRate: '0.7090' } }] }, extensions: { arkiv: { calls: 5, explainId: '22dbaf8fd1fd', entityKeys: [TX] } } }) }] }),
    result('catalog_read', { offers: [{ shop: SHOP, sku: 's1', priceUsdt: '4.800000', etaMinutes: 45, distanceKm: 2.1 }] }),
    msg(c.analyst!.ens, c.concierge!.ens, `best eligible: ${SHOP}`),
    result('analyst', { ranking: [{ ens: SHOP, score: 0.9, eligible: true }, { ens: TRAP, score: 0.7, eligible: false }] }),
    { event: 'trace', data: JSON.stringify({ type: 'tool.call', agent: c.concierge!.ens, tool: 'pay_shop', input: { shopEns: SHOP } }) },
    msg(c.concierge!.ens, c.payer!.ens, 'pay'),
    msg(c.storefront!.ens, c.risk!.ens, `vet ${PAYER}`),
    result('ens_check', { name: PAYER, status: 'ACTIVE', records: { 'graphpay.status': 'active', 'graphpay.principal': cast.persona.ens } }),
    result('ask', { content: [{ type: 'text', text: `ens\tstatus\torders\tcancellations\tdisputes\n${PAYER}\tactive\t33\t0\t0\nexplain=d17a3c35770e calls=4` }] }),
    guard('G9', true, `approved ${PAYER} (code and the risk agent)`),
    msg(c.risk!.ens, c.storefront!.ens, 'approve'),
    result('get_quote', { ok: true, shop: SHOP, priceUsdt: '4.80', etaMinutes: 45, quantity: 1, orderId: ORDER }),
    msg(c.storefront!.ens, c.payer!.ens, '402 payment required'),
    guard('G5', true, 'every check passed before signing'),
    msg(c.payer!.ens, c.storefront!.ens, 'payment signature'),
    msg(c.dispatch!.ens, c.payer!.ens, `dispatched ${ORDER}, arrives 2026-11-06T21:56:06.103Z`),
    msg(c.storefront!.ens, c.payer!.ens, `settled ${TX}`),
    result('pay_order', { status: 'paid', amountUsdt: '4.80', transaction: TX, orderId: ORDER, arrivesAt: '2026-11-06T21:56:06.103Z' }),
    { event: 'result', data: JSON.stringify({ status: 'paid', orderId: ORDER, receipt: { transaction: TX, amountUsdt: '4.80' }, ranking: [], refusals: [] }) },
  ];
  return frames.map((f, i) => ({ ...f, at: i * 1000 }));
}

test('the scene table has scenes 0 to 10 in order, each beat once', () => {
  assert.deepEqual([...new Set(BEATS.map((b) => b.scene))], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(BEATS.map((b) => b.key)).size, BEATS.length);
  for (const b of BEATS) assert.ok(b.title && b.firedBy && b.panes.customer && b.panes.middle && b.panes.merchant, b.key);
  assert.deepEqual(BROWSE_BEATS, BEATS.filter((b) => b.trigger === 'key').map((b) => b.key));
  assert.equal(isBeatKey('graph'), true);
  assert.equal(isBeatKey('__proto__'), false);
});

test('the errand steps run in beat order and stay inside scenes 1 to 4', () => {
  const order = ERRAND_STEPS.map((s) => BEATS.findIndex((b) => b.key === s.beat));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const s of ERRAND_STEPS) assert.ok([1, 2, 3, 4].includes(beatOf(s.beat).scene), s.key);
});

test('the pitch fits four minutes at the least dwell', () => {
  const total = BEATS.reduce((sum, b) => sum + b.minDwellMs, 0) + 25_000;
  assert.ok(total <= 240_000, `${total} ms`);
  const errand = ['teams', 'plain', 'queries', 'graph', 'check-back', 'x402'].reduce((s, k) => s + beatOf(k as never).minDwellMs, 0);
  assert.ok(errand >= 60_000 && errand <= 90_000, `scenes 1 to 4 take ${errand} ms`);
});

test('the fold reads every figure from the frames', () => {
  const m = foldAll(run());
  assert.equal(m.runId, 'r1');
  assert.equal(m.budgetUsdt, '6.000000');
  assert.deepEqual(m.directory, [TRAP, SHOP]);
  assert.equal(m.offers.length, 2);
  assert.equal(m.graph?.calls, 5);
  assert.equal(m.graph?.explainId, '22dbaf8fd1fd');
  assert.equal(m.graph?.query, 'query Q { nodes { ens } }');
  assert.equal(m.best, SHOP);
  assert.equal(m.risk.paidOrders, 33);
  assert.equal(m.risk.owner, cast.persona.ens);
  assert.equal(m.risk.approved, true);
  assert.equal(m.quote?.orderId, ORDER);
  assert.equal(m.paid?.tx, TX);
  assert.equal(m.end?.status, 'paid');
  for (const s of ERRAND_STEPS) assert.notEqual(m.arrived[s.key], undefined, s.key);
});

test('the pace shows one step at a time, in order, and waits for each beat’s dwell', () => {
  const m = foldAll(run());
  let pace = restPace(0);
  const seen: number[] = [];
  for (let now = 0; now <= 200_000; now += 100) {
    const next = advance(pace, m.arrived, m.end !== null, now);
    if (next.shown !== pace.shown) {
      assert.equal(next.shown, pace.shown + 1);
      seen.push(now);
    }
    pace = next;
  }
  assert.equal(pace.shown, ERRAND_STEPS.length - 1);
  assert.ok(caughtUp(pace, m.arrived));
  const shownAt = (k: string) => seen[ERRAND_STEPS.findIndex((s) => s.key === k)]!;
  assert.ok(shownAt('shops') - shownAt('ask') >= beatOf('teams').minDwellMs);
  assert.ok(shownAt('quote') - shownAt('vet') >= beatOf('check-back').minDwellMs);
});

test('a refused run skips the steps that never came', () => {
  const frames = run().slice(0, 18);
  frames.push({ event: 'result', data: JSON.stringify({ status: 'refused', refusals: [{ reason: 'ENS_PAUSED', detail: '' }] }), at: 18_000 });
  const m = foldAll(frames);
  let pace = restPace(0);
  for (let now = 0; now <= 200_000; now += 100) pace = advance(pace, m.arrived, true, now);
  assert.ok(caughtUp(pace, m.arrived));
  assert.equal(endSentence(m), 'Refused: the payer is paused on ENS. Nothing was paid.');
});

test('the lines are the templates filled from the frames', () => {
  const m = foldAll(run());
  const lines = customerErrandLines(m, cast);
  assert.deepEqual(lines.map((l) => l.key), ['ask', 'team', 'shops', 'best', 'order', 'vet', 'quote', 'paid']);
  assert.equal(lines[1]!.text, 'On it. Scout: find a thing near the corner. Analyst: check their records. Payer: stand by.');
  assert.equal(lines[3]!.text, 'One: 245 orders, 1.2% refunds, 97% on time. Two: 18% refunds, rejected.');
  assert.equal(lines[4]!.text, 'Order 1 × a thing from One, at most 6.00 USDT, within the hour.');
  assert.equal(lines[6]!.text, 'Bill: 4.80 USDT, inside today’s pass. Signing once.');
  // No arrival time: the shop marks the order dispatched on chain right after the payment.
  assert.equal(lines[7]!.text, 'Paid 4.80.');
  const shop = merchantErrandLines(m, cast);
  assert.deepEqual(shop.map((l) => l.key), ['m-quote', 'm-vet', 'm-risk', 'm-bill', 'm-paid']);
  assert.equal(shop[2]!.text, `Graph: 33 paid orders, 0 disputes. ENS: owned by ${cast.persona.ens}, active. Approved.`);
  assert.equal(refundLines.riskAccept('800000', '4.80', true), 'Photo on Swarm. 0.80 of 4.80, on a dispatched order. Accept.');
});

test('small formats', () => {
  assert.equal(orderNumber(ORDER), '#4B28');
  assert.equal(orderNumber('nope'), '');
  assert.equal(percent(0.0122), '1.2%');
  assert.equal(percent(null), '');
  assert.equal(ago(0, 12_000), '12 s ago');
  assert.equal(ago(0, 180_000), '3 min ago');
  assert.equal(parseAsk('ens\torders\na\t7\nexplain=0123456789ab').orders, 7);
});
