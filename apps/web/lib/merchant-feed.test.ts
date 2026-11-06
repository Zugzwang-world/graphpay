import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { config } from '@graphpay/config';
import { connectArkiv, createGraphEngine, createLedger, newSim, runGraphql, writerAddresses } from '@graphpay/money-graph';
import type { ExplorerBases } from './explorer.ts';
import { CSV_COLUMNS, buildCsv, edgeKey, fetchShopEdges, fetchShopEdgesFitting, LIST_CAP, freshEdges, localTime, settlementTxOf, toEvent, type EdgeRow, type GraphqlRunner } from './merchant-feed.ts';

// Test names only: the web code never holds story names.
const SHOP = 'alpha-sweets.sim.example.eth';
const AGENT = 'payer.person.sim.example.eth';
const PERSON = 'person.sim.example.eth';
const NOW = 1_760_000_000;
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const ref = (n: number) => `1874:${tx(n)}:0`;
const explorers: ExplorerBases = { whitechain: config.networks.whitechain.explorer, sepolia: config.networks.sepolia.explorer, rabdi: config.networks.rabdi.explorer };

let run: GraphqlRunner;

before(async () => {
  const sim = newSim();
  const conn = (role: 'W_LEDGER') => connectArkiv({ backend: 'sim', sim, role, privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  const writer = await conn('W_LEDGER');
  const ledger = createLedger({ arkiv: writer, stream: 'whitechain' });
  await ledger.load();
  const buyer = { ens: AGENT, epoch: 0, kind: 'agent', columns: { owner_node: undefined } };
  const shop = { ens: SHOP, epoch: 0, kind: 'shop' };
  const events = [
    { ref: ref(1), kind: 'order', from: buyer, to: shop, amountMicro: 4_800_000n, ts: NOW - 300, orderId: '0xaa' },
    { ref: ref(2), kind: 'pay', from: buyer, to: shop, amountMicro: 4_800_000n, ts: NOW - 290, orderId: '0xaa' },
    { ref: ref(3), kind: 'deliver', from: shop, to: buyer, amountMicro: 0n, ts: NOW - 100, orderId: '0xaa' },
    { ref: ref(4), kind: 'refund', from: shop, to: buyer, amountMicro: 800_000n, ts: NOW - 50, orderId: '0xaa' },
  ];
  for (const [i, e] of events.entries()) await ledger.apply({ ...e, day: Math.floor(e.ts / 86400), position: { block: BigInt(100 + i), logIndex: 0 } });
  const reader = await connectArkiv({ backend: 'sim', sim });
  const engine = createGraphEngine(reader);
  const writers = { ...writerAddresses(), W_LEDGER: writer.owner as `0x${string}` };
  run = (query, variables) => runGraphql({ engine, query, variables, dataset: 'live', writers });
});

test('the shop query reads both directions from the real graph engine, oldest first', async () => {
  const { edges } = await fetchShopEdges(run, SHOP, { nowS: NOW });
  assert.deepEqual(edges.map((e) => e.kind), ['order', 'pay', 'deliver', 'refund']);
  assert.deepEqual(edges.map((e) => e.ref), [ref(1), ref(2), ref(3), ref(4)]);
});

test('a shop with no node on Arkiv yet has an empty feed, not an error', async () => {
  const { edges } = await fetchShopEdges(run, 'nobody.sim.example.eth', { nowS: NOW });
  assert.deepEqual(edges, []);
});

test('a refused or failed query is an error, never an empty answer', async () => {
  await assert.rejects(fetchShopEdges(async () => ({ errors: [{ message: 'boom' }] }), SHOP), /boom/);
});

test('an edge becomes a stream event with its settlement transaction taken from the ref', async () => {
  const { edges } = await fetchShopEdges(run, SHOP, { nowS: NOW });
  const pay = toEvent(edges[1] as EdgeRow);
  assert.equal(pay?.kind, 'pay');
  assert.equal(pay?.from, AGENT);
  assert.equal(pay?.to, SHOP);
  assert.equal(pay?.amountMicro, '4800000');
  assert.equal(pay?.settlementTx, tx(2));
  assert.equal(pay?.arkivTx, null);
  assert.equal(toEvent({ ...(edges[1] as EdgeRow), kind: 'unheard-of' }), null);
  assert.equal(settlementTxOf('hist:abc:1'), null);
});

test('a stream sends only edges at or after its cursor and never one twice', async () => {
  const { edges } = await fetchShopEdges(run, SHOP, { nowS: NOW });
  const sent = new Set<string>();
  const first = freshEdges(edges, NOW - 120, sent);
  assert.deepEqual(first.map((e) => e.kind), ['deliver', 'refund']);
  for (const e of first) sent.add(edgeKey(e));
  assert.deepEqual(freshEdges(edges, NOW - 120, sent), []);
  assert.equal(freshEdges(edges, 0, new Set()).length, 4);
});

test('the accountant export: fixed columns, signed net effect, links that open the explorer, rows that match the graph', async () => {
  const { edges } = await fetchShopEdges(run, SHOP, { nowS: NOW });
  const csv = buildCsv(edges, { shopEns: SHOP, timeZone: 'Asia/Kolkata', tokenSymbol: 'USDT', explorers });
  const [head, ...rows] = csv.trim().split('\r\n') as string[];
  assert.equal(head, CSV_COLUMNS.join(','));
  assert.equal(rows.length, 4);
  const col = (row: string, name: (typeof CSV_COLUMNS)[number]) => row.split(',')[CSV_COLUMNS.indexOf(name)];
  const byKind = Object.fromEntries(rows.map((r) => [col(r, 'kind'), r]));
  assert.equal(col(byKind.pay as string, 'amount_usdt'), '4.80');
  assert.equal(col(byKind.pay as string, 'net_effect_usdt'), '4.80');
  assert.equal(col(byKind.refund as string, 'net_effect_usdt'), '-0.80');
  assert.equal(col(byKind.deliver as string, 'net_effect_usdt'), '0.00');
  assert.equal(col(byKind.pay as string, 'payer_ens'), AGENT);
  assert.equal(col(byKind.refund as string, 'payer_ens'), AGENT);
  assert.equal(col(byKind.pay as string, 'tx_hash'), tx(2));
  assert.equal(col(byKind.pay as string, 'explorer_link'), `${explorers.whitechain}/tx/${tx(2)}`);
  assert.equal(col(byKind.pay as string, 'order_id'), '0xaa');
  // The net of the order is what the shop kept: 4.80 paid less 0.80 refunded.
  const net = rows.reduce((sum, r) => sum + Math.round(Number(col(r, 'net_effect_usdt')) * 100), 0);
  assert.equal(net, 400);
});

test('names and refs from chain data cannot run as spreadsheet formulas', () => {
  const row: EdgeRow = { kind: 'pay', from: { ens: '=HYPERLINK("x")', owner: null }, to: { ens: SHOP, owner: null }, amountMicro: '1000000', day: 1, ts: String(NOW), ref: '@evil,ref', orderId: null };
  const csv = buildCsv([row], { shopEns: SHOP, timeZone: 'Asia/Kolkata', tokenSymbol: 'USDT', explorers });
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"'@evil,ref"/);
});

test('the local time column uses the story time zone, not the server zone', () => {
  assert.equal(localTime(1_760_000_000, 'Asia/Kolkata'), '2025-10-09 14:23:20');
  assert.equal(localTime(1_760_000_000, 'UTC'), '2025-10-09 08:53:20');
  assert.ok(PERSON);
});

// The engine returns a node's oldest edges first and cuts the rest at the list cap without a flag
// (what hid every payment after 24 Oct from the live merchant feed). This double does the same.
function cutting(total: number, perDay = 20): GraphqlRunner {
  return async (_query, variables) => {
    const since = Number(variables.sinceDay);
    const limit = Number(variables.limit);
    const today = 20_000;
    const rows: EdgeRow[] = [];
    for (let n = 0; n < total; n++) {
      const day = today - Math.floor((total - 1 - n) / perDay);
      if (day < since) continue;
      rows.push({ kind: 'pay', from: { ens: AGENT, owner: null }, to: { ens: SHOP, owner: null }, amountMicro: '1', day, ts: String(day * 86400 + n), ref: ref(n), orderId: null });
    }
    return { data: { node: { in: rows.slice(0, limit), out: [] }, today } };
  };
}

test('the list cap is the engine\'s row cap, so a window of 208 rows is returned whole and not flagged', async () => {
  assert.equal(LIST_CAP, 500);
  const { edges, truncated } = await fetchShopEdges(cutting(208), SHOP, { daysBack: 31, nowS: 20_000 * 86400 });
  assert.equal(edges.length, 208);
  assert.equal(truncated, false);
  assert.equal(edges.at(-1)?.ref, ref(207));
});

test('a window the cap cuts is flagged truncated, never silently short', async () => {
  const { edges, truncated } = await fetchShopEdges(cutting(900), SHOP, { daysBack: 31, nowS: 20_000 * 86400 });
  assert.equal(edges.length, LIST_CAP);
  assert.equal(truncated, true);
});

test('the fitting fetch shrinks the window until the answer is whole, and says how far back it reaches', async () => {
  // 900 rows, 20 a day: 31 days is 620 (cut), 15 days is 300 (whole).
  const out = await fetchShopEdgesFitting(cutting(900), SHOP, { daysBack: 31, nowS: 20_000 * 86400 });
  assert.equal(out.truncated, false);
  assert.equal(out.daysBack, 15);
  assert.equal(out.edges.length, 320);
  // The newest edge is always in it.
  assert.equal(out.edges.at(-1)?.ref, ref(899));
});

test('a whole window is taken at once; a day too full for any window comes back flagged', async () => {
  const whole = await fetchShopEdgesFitting(cutting(100), SHOP, { daysBack: 1, nowS: 20_000 * 86400 });
  assert.equal(whole.daysBack, 1);
  assert.equal(whole.truncated, false);
  const full = await fetchShopEdgesFitting(cutting(2000, 2000), SHOP, { daysBack: 31, nowS: 20_000 * 86400 });
  assert.equal(full.truncated, true);
  assert.equal(full.daysBack, 0);
});
