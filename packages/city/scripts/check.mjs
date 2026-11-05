// Read-only: the seeded city on Rabdi, asked through GraphQL, against the generator's truth.
//   node packages/city/scripts/check.mjs --size S --end <YYYY-MM-DD> [--backend rabdi]
// Writes docs/sessions/arkiv/city/check-<size>.json. Prints numbers and explain ids only.

import { writeFileSync } from 'node:fs';
import { story } from '@graphpay/config';
import { connectArkiv, createGraphEngine, runGraphql, discoverShops, boxAround } from '@graphpay/money-graph';
import { generateCity, truthOf } from '../index.mjs';

const args = process.argv.slice(2);
const opt = (n, d = null) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const size = opt('size', 'S');
const end = opt('end');
if (!end) throw new Error('check: --end YYYY-MM-DD');
const { loadSecrets } = await import('../../money-graph/scripts/lib.mjs');
const env = loadSecrets();
const arkiv = await connectArkiv({ backend: opt('backend', 'rabdi'), env });
const engine = createGraphEngine(arkiv);
const city = generateCity({ story, size, end });
const truth = truthOf(city);
const q = (query) => runGraphql({ engine, query, dataset: size });
const out = { synthetic: true, size, end, backend: arkiv.backend, checks: {} };
const record = (name, ok, r, extra = {}) => {
  out.checks[name] = { ok, calls: r?.extensions?.arkiv?.calls ?? null, explainId: r?.extensions?.arkiv?.explainId ?? null, bytes: r?.extensions?.arkiv?.bytes ?? null, ...extra };
};

// Q2 twice: the second run is warm and must give the same explain id.
const top = '{ top(kind: "shop", by: "paid_micro", limit: 10) { node { ens epoch } value } }';
await q(top);
const q2 = await q(top);
record('q2_top10', JSON.stringify(q2.data?.top.map((r) => r.value)) === JSON.stringify(truth.q2.identity.map((r) => r.paidMicro)), q2);

const q1 = await q(`{ node(ens: "${truth.q1.shop}") { reputation(window: ALL, verify: true) { orders refunds source } } }`);
record('q1_good_shop', Number(q1.data?.node.reputation.orders) === truth.q1.orders && Number(q1.data?.node.reputation.refunds) === truth.q1.refunds && q1.data?.node.reputation.source === 'RAW_VERIFIED', q1);

const since = city.lastDay - 6;
const agents = Object.values(city.personaAgents);
const q3 = await q(`{ ${agents.map((a, i) => `a${i}: node(ens: "${a}") { out(kind: "pay", sinceDay: ${since}) { to { ens } amountMicro } }`).join(' ')} }`);
const spend = {};
for (const a of Object.values(q3.data ?? {})) for (const e of a.out) spend[e.to.ens] = String(BigInt(spend[e.to.ens] ?? 0) + BigInt(e.amountMicro));
const sorted = (o) => JSON.stringify(Object.entries(o).sort());
record('q3_persona_spend', sorted(spend) === sorted(truth.q3.spendByShop), q3, { shops: Object.keys(spend).length });

const q5 = await q(`{ path(from: "${truth.q5.from}", to: "${truth.q5.to}", maxDepth: 3, kinds: ["pay"]) { found hops } }`);
record('q5_path', q5.data?.path.found === (truth.q5.hops !== null) && (truth.q5.hops === null || q5.data?.path.hops === truth.q5.hops), q5, { hops: q5.data?.path.hops ?? null });

const re = await q(`{ node(ens: "${city.reShop}") { epoch reputation(window: ALL) { orders } } }`);
const after = city.events.filter((e) => e.to.ens === city.reShop && e.ts >= city.reRegisteredAt && (e.kind === 'order' || e.kind === 'subscribe')).length;
record('re_registered_starts_empty', re.data?.node.epoch === story.syntheticCity.reRegisteredShop.epoch && Number(re.data?.node.reputation.orders) === after, re);

// D8: discovery around the persona's point, real shops only, then with the synthetic opt-in.
const box = boxAround(story.locations.persona, story.locations.searchRadiusKm);
const real = await discoverShops(arkiv.publicClient, { category: city.shops[0].category, box });
const all = await discoverShops(arkiv.publicClient, { category: city.shops[0].category, box, synthetic: true });
const castNames = city.shops.filter((s) => s.cast).map((s) => s.ens).sort();
out.checks.d8_discovery = { ok: JSON.stringify(real.shops.map((s) => s.ens).sort()) === JSON.stringify(castNames), real: real.shops.length, withSynthetic: all.shops.length, calls: real.calls };

out.allOk = Object.values(out.checks).every((c) => c.ok);
out.httpStatus = arkiv.stats.status;
out.lowestRateLimitRemaining = arkiv.stats.lowestRemaining;
writeFileSync(new URL(`../../../docs/sessions/arkiv/city/check-${size}.json`, import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
if (!out.allOk) process.exitCode = 1;
