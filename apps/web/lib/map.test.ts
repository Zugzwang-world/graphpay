import assert from 'node:assert/strict';
import { test } from 'node:test';
import { story } from '@graphpay/config';
import { boxAround, kmToUnits, presenceQuery, projector, shopLabel, shopQuery, toDegrees, toMicro } from './map.ts';
import { MAP_QUERY, mapBox, readMap, type Runner } from './map.server.ts';

test('the search box covers every point with a margin, in micro-degrees', () => {
  const box = boxAround([{ lat: 19.06, lng: 72.85 }, { lat: 19.08, lng: 72.89 }], 0.03);
  assert.deepEqual(box, { latMin: 19_030_000, latMax: 19_110_000, lngMin: 72_820_000, lngMax: 72_920_000 });
  assert.equal(toDegrees(toMicro(19.076)), 19.076);
  assert.throws(() => boxAround([], 1), /at least one point/);
});

test('the projection keeps north up and a kilometre the same length in both directions', () => {
  const pts = [{ lat: 19.06, lng: 72.85 }, { lat: 19.08, lng: 72.89 }];
  const at = projector(pts, 900, 600, 40);
  const nw = at({ lat: 19.08, lng: 72.85 });
  const se = at({ lat: 19.06, lng: 72.89 });
  assert.ok(nw.y < se.y, 'north is up');
  assert.ok(nw.x < se.x, 'east is right');
  for (const p of [nw, se]) assert.ok(p.x >= 0 && p.x <= 900 && p.y >= 0 && p.y <= 600, 'inside the drawing');
  // 0.01 degrees north and 0.01 degrees east differ by cos(latitude) in length.
  const o = at({ lat: 19.07, lng: 72.87 });
  const north = at({ lat: 19.08, lng: 72.87 });
  const east = at({ lat: 19.07, lng: 72.88 });
  const dy = o.y - north.y;
  const dx = east.x - o.x;
  assert.ok(Math.abs(dx / dy - Math.cos((19.07 * Math.PI) / 180)) < 0.01);
  const km = kmToUnits(pts, 900, 600, 40);
  assert.ok(Math.abs(km(1) - dy * (1 / 111.32 / 0.01)) < 0.5);
  // A single point does not divide by zero.
  assert.ok(Number.isFinite(projector([pts[0]!], 900, 600)(pts[0]!).x));
});

test('labels and explorer queries come from the shop, never from the page', () => {
  assert.equal(shopLabel({ name: 'A Shop', area: 'Kurla', ens: 'a.sim.example.eth' }), 'A Shop');
  assert.equal(shopLabel({ name: null, area: 'Kurla', ens: 'a.sim.example.eth' }), 'Kurla');
  assert.equal(shopLabel({ name: null, area: null, ens: 'a.sim.example.eth' }), 'a');
  assert.equal(shopQuery(`0x${'AB'.repeat(32)}`), `project = str('graphpay') AND type = str('shop') AND shop_key = key(0x${'ab'.repeat(32)})`);
  assert.match(presenceQuery('run-1'), /type = str\('agent_presence'\) AND session = str\('run-1'\)/);
});

const KEY = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const shop = (n: number, synthetic: boolean, over = {}) => ({ ens: `s${n}.sim.example.eth`, shopKey: KEY(n), area: 'Kurla', name: `Shop ${n}`, lat: 19_070_000 + n * 1000, lng: 72_870_000, synthetic, ...over });

test('the map joins the directory with the open rows and the agents at work; synthetic stays labelled', async () => {
  const seen: Record<string, unknown>[] = [];
  const run: Runner = async (query, variables) => {
    assert.equal(query, MAP_QUERY);
    seen.push(variables);
    return {
      data: {
        real: [shop(1, false)],
        syn: [shop(2, true), shop(3, true), shop(1, false)],
        realOpen: [{ shopKey: KEY(1).toUpperCase().replace('0X', '0x') }],
        synOpen: [{ shopKey: KEY(3) }],
        buyers: [{ key: KEY(9), role: 'payer', session: 'run-1', agent: { ens: 'payer.p.sim.example.eth' }, owner: { ens: 'p.sim.example.eth' } }],
        sellers: [],
      },
    };
  };
  const map = await readMap(run, Date.UTC(2026, 10, 6));
  assert.equal(map.shops.length, 3, 'a shop listed twice is drawn once');
  assert.deepEqual(map.shops.map((s) => [s.ens, s.synthetic, s.open]), [['s1.sim.example.eth', false, true], ['s2.sim.example.eth', true, false], ['s3.sim.example.eth', true, true]]);
  assert.equal(map.shops[0]?.lat, 19.071);
  assert.deepEqual(map.agents.map((a) => [a.ens, a.role, a.session]), [['payer.p.sim.example.eth', 'payer', 'run-1']]);
  assert.equal(map.at, '2026-11-06T00:00:00.000Z');
  assert.equal(map.persona.label, (story.locations as { persona: { label: string } }).persona.label);
  assert.deepEqual(seen[0]?.box, mapBox());
});

test('a graph that does not answer is an error, never an empty map', async () => {
  await assert.rejects(readMap(async () => ({ errors: [{ message: 'boom' }] })), /did not answer/);
  await assert.rejects(readMap(async () => ({})), /did not answer/);
});

test('the search box covers every neighbourhood of the story and the arrival point', () => {
  const l = story.locations as { persona: { lat: number; lng: number }; neighbourhoods: { lat: number; lng: number }[] };
  const box = mapBox();
  for (const p of [...l.neighbourhoods, l.persona]) {
    assert.ok(toMicro(p.lat) > box.latMin && toMicro(p.lat) < box.latMax);
    assert.ok(toMicro(p.lng) > box.lngMin && toMicro(p.lng) < box.lngMax);
  }
});
