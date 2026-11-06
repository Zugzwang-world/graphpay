// The acceptance checks this repo can run today (read-only), as functions that return
// { pass, what, measured, expected, evidence }. pass: true | false | null (null: nothing to
// test yet, reported "not run"). Committed evidence from another track is cited with its
// file and date, never re-measured by a write (the live probe and the seeding write; the
// workers process is the only W_LEDGER writer while it runs).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { activeCast, castEntries, config, story } from '../packages/config/index.mjs';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { createPayerGate } from '../integration/src/gate.mjs';
import { connectArkiv, createGraphEngine, ENTITIES, runGraphql, writerAddresses } from '../packages/money-graph/index.mjs';
import { compileFilter, findOne, readAll } from '../packages/arkiv-graph/index.mjs';
import { trackChecks } from './tracks.mjs';

const usd = (micro) => (Number(micro) / 1e6).toFixed(2);
const sh = (root, cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 10 * 60_000, ...opts });
const lastLines = (s, n = 4) => String(s ?? '').trim().split('\n').slice(-n);

// Lines `pass <ID> …` / `FAIL <ID> …` from a track's own acceptance script.
export function linesById(out) {
  const by = {};
  for (const l of String(out).split('\n')) {
    const m = l.match(/^(pass|FAIL) ([A-F]\d+)\b(.*)$/);
    if (m) (by[m[2]] ??= []).push({ ok: m[1] === 'pass', line: `${m[1]} ${m[2]}${m[3]}`.slice(0, 300) });
  }
  return by;
}

// The latest real e2e:food run file that passed (docs/sessions/integration/runs/<id>/run.json).
export function latestRun(root) {
  const dir = join(root, 'docs/sessions/integration/runs');
  if (!existsSync(dir)) return null;
  const runs = readdirSync(dir)
    .map((id) => join(dir, id, 'run.json'))
    .filter((f) => existsSync(f))
    .map((f) => ({ f, run: JSON.parse(readFileSync(f, 'utf8')) }))
    .filter(({ run }) => run.network === 'real' && run.pass)
    .sort((a, b) => (a.run.startedAt < b.run.startedAt ? 1 : -1));
  return runs[0] ?? null;
}

export function checks(root, env) {
  const cast = activeCast();
  const entries = castEntries(cast);
  const paying = entries.filter((e) => e.kind === 'buyer-agent' && e.pays);
  const payers = paying.map((e) => e.ensName);
  let ensScript = null;
  const ens = () => (ensScript ??= sh(root, process.execPath, ['scripts/ens/acceptance.mjs']));
  const fromEns = (id, what) => () => {
    const out = ens();
    const rows = linesById(out.stdout)[id] ?? [];
    return { pass: rows.length ? rows.every((r) => r.ok) : null, what, measured: rows.map((r) => r.line), expected: 'every line of scripts/ens/acceptance.mjs for this id passes', evidence: { script: 'scripts/ens/acceptance.mjs', exit: out.status } };
  };

  const e2e = () => latestRun(root);
  const fromRun = (id, what, assertion, expected) => async () => {
    const r = e2e();
    if (!r) return { pass: null, why: 'no passing real e2e:food run yet', what, measured: null, expected, evidence: {} };
    const a = r.run.assertions.find((x) => x.id === assertion);
    return { pass: a ? a.pass : null, what, measured: a?.measured ?? null, expected, evidence: { runFile: r.f.slice(root.length + 1), startedAt: r.run.startedAt, assertion, ...(a?.note ? { note: a.note } : {}) } };
  };
  return {
    // The other tracks' checks (A3, A4, A9, A10, B3, B7, D10), read-only.
    ...trackChecks(root, env),
    E1: async () => {
      const r = e2e();
      if (!r) return { pass: null, why: 'no passing real e2e:food run yet', what: "the human's request", measured: null, expected: '', evidence: {} };
      const ev = r.run.agents.events;
      const idx = (type, role) => ev.findIndex((e) => e.type === type && e.role === role);
      const firstEnd = Math.min(...['scout', 'analyst'].map((role) => idx('agent.end', role)).filter((i) => i >= 0));
      const m = r.run.agents.result.mandate;
      const request = ev.find((e) => e.type === 'message')?.text;
      // The deadline the words give at the run's time (#153): a clock time is today's, a span
      // ("within an hour") counts from the request, to the minute. So it lies between the one
      // read at the run's start and the one read at its end, and the mandate's hash covers it.
      const { mandateHash, parseMandate, teamCast } = await import('../packages/agents/index.mjs');
      const team = teamCast();
      const words = { timeZone: team.city.timeZone, currency: team.city.currency, buyer: team.persona.ens };
      const [lo, end] = [r.run.startedAt, r.run.endedAt].map((t) => parseMandate(request ?? '', { now: Date.parse(t), ...words }));
      // A clock deadline that passed while the run was going reads the same instant at its start.
      const hi = !end.ok && end.reason === 'MANDATE_DEADLINE_PASSED' ? lo : end;
      const deadlineMs = Date.parse(m?.deadlineIso ?? '');
      const deadlineOk = lo.ok && hi.ok && deadlineMs >= lo.mandate.deadlineMs && deadlineMs <= hi.mandate.deadlineMs;
      const hashOk = lo.ok && deadlineOk && mandateHash({ ...words, budgetMicro: lo.mandate.budgetMicro, deadlineMs, request }) === m?.hash;
      const pass = request === story.order.request && m?.budgetUsdt === (story.order.budgetMicro / 1e6).toFixed(6) && deadlineOk && hashOk && idx('agent.start', 'scout') < firstEnd && idx('agent.start', 'analyst') < firstEnd;
      return { pass, what: "the human's request", measured: { request, mandate: m, deadlineWindow: lo.ok && hi.ok ? [lo.mandate.deadlineIso, hi.mandate.deadlineIso] : [lo.reason ?? null, hi.reason ?? null], hashOk, scoutStart: idx('agent.start', 'scout'), analystStart: idx('agent.start', 'analyst'), firstEnd }, expected: `the story's request exactly; budget ${(story.order.budgetMicro / 1e6).toFixed(6)}; the deadline the words give at the run's time (a span counts from the request), with the mandate's hash; scout and analyst both start before either ends`, evidence: { runFile: r.f.slice(root.length + 1), startedAt: r.run.startedAt } };
    },
    E2: fromRun('E2', 'the agents choose the good shop, never the trap', 'A', 'explainId; good > runner-up, trap excluded; no trap order or payment; trap balance unchanged'),
    E4: fromRun('E4', 'the mirror writes it to Arkiv', 'C', 'cursor past the settle block; trail order → pay → deliver; refs 1874:<tx>:<logIndex>'),
    E5: fromRun('E5', 'GraphQL shows the new edge and the updated tallies', 'D', 'TODAY +1 order, +4.80, +1 delivered, +1 on time; all-time +1; payer TODAY +4.80'),
    E6: fromRun('E6', 'a refund updates the tallies', 'E', 'refunds +1, refunded +0.80, trail ends in refund'),
    E7: async () => killCheck(root, env, 'E7'),
    B6: async () => killCheck(root, env, 'B6'),
    A5: async () => {
      const r = sh(root, 'pnpm', ['-s', 'wallets:addresses']);
      const rows = String(r.stdout).split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => /^[A-Z][A-Z0-9_]+$/.test(p[0] ?? '') && /^0x[0-9a-fA-F]{40}$/.test(p[1] ?? ''));
      const carried = rows.filter((p) => p[2] !== 'fresh').map((p) => p[0]);
      const addrs = rows.map((p) => p[1].toLowerCase());
      const shared = addrs.filter((a, i) => addrs.indexOf(a) !== i);
      return { pass: rows.length > 0 && carried.every((c) => c === 'FUNDER' || c === 'OPERATOR') && shared.length === 0, what: 'the event wallets are fresh, except FUNDER and OPERATOR', measured: { roles: rows.length, carried, sharedAddresses: shared.length }, expected: 'only FUNDER and OPERATOR carried; no two roles share an address', evidence: { cmd: 'pnpm -s wallets:addresses (addresses only)' } };
    },
    F1: async () => noSecrets(root),
    // D11 (Friday): the presence half from integration/d11.mjs (an e2e:food errand watched on
    // Arkiv); the Open toggle's shop_open half has no runner here yet.
    D11: async () => {
      const dir = join(root, 'docs/sessions/integration/hosted');
      const f = existsSync(dir) ? readdirSync(dir).filter((x) => x.startsWith('d11-')).sort().at(-1) : null;
      const what = 'heartbeats lapse';
      if (!f) return { pass: null, why: 'no d11 run yet', what, measured: null, expected: '', evidence: {} };
      const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const presence = typeof d.secondsToPresence === 'number' && d.secondsToPresence <= 30 && typeof d.minutesToGone === 'number' && d.minutesToGone <= 15 && (d.firstRows ?? []).length > 0 && d.firstRows.every((r) => String(r.owner).toLowerCase() === writerAddresses().W_DIRECTORY.toLowerCase());
      const parts = { presence, shopOpen: null };
      const pass = parts.presence === false ? false : null;
      return { pass, why: pass === null ? 'the presence half passes; the shop_open half (the Open toggle) is not run here' : undefined, what, measured: { secondsToPresence: d.secondsToPresence, minutesToGone: d.minutesToGone, rows: d.firstRows?.length ?? 0, handoffs: d.handoffs, owner: d.owner, errand: d.errandLine ?? null }, expected: 'agent_presence within 30 s of the start and gone within 15 min of the stop; both owned by W_DIRECTORY; shop_open present while on and gone within 15 min of off', evidence: { file: `docs/sessions/integration/hosted/${f}`, parts } };
    },
    // F3: T1's record (docs/sessions/payments/f3.json): the production build run locally with the
    // hosted env and the floor raised above the relayer's balance (a preview would need the
    // relayer key in the preview env, and its shop would call the production facilitator).
    F3: async () => {
      const f = join(root, 'docs/sessions/payments/f3.json');
      const what = "the relayer's safety floor is enforced";
      if (!existsSync(f)) return { pass: null, why: "no F3 record from T1 yet", what, measured: null, expected: '', evidence: {} };
      const r = JSON.parse(readFileSync(f, 'utf8'));
      const below = BigInt(r.balanceWei) < BigInt(Math.round(Number(r.floorWbt) * 1e6)) * 10n ** 12n;
      const pass = r.settle?.success === false && /floor/.test(r.settle?.errorReason ?? '') && r.settle?.transaction === '' && r.relayerNonce?.before === r.relayerNonce?.after && below && r.checks.every((c) => c.ok);
      return { pass, what, measured: { reason: r.settle?.errorReason, transaction: r.settle?.transaction, relayerNonce: r.relayerNonce, floorWbt: r.floorWbt, balanceWei: r.balanceWei, checks: r.checks.map((c) => `${c.ok ? 'ok' : 'FAIL'} ${c.name}`) }, expected: 'the payment refused before sending, naming the floor; no transaction (relayer nonce unchanged); health shows the floor and the balance', evidence: { file: 'docs/sessions/payments/f3.json', by: "T1, a local production build with the hosted env (not a preview; the record says why)", at: r.at } };
    },
    C2: async () => hosted(root, 'C2'),
    C3: async () => hosted(root, 'C3', env),
    C4: async () => hosted(root, 'C4', env),
    C5: async () => hosted(root, 'C5'),
    C6: async () => hosted(root, 'C6'),
    F2: async () => hosted(root, 'F2'),
    C7: async () => qualifying(env, 'C7', root),
    E3: async () => qualifying(env, 'E3', root),
    E8: async () => {
      const r = e2e();
      const open = readFileSync(join(root, 'docs/thinking-partner/OPEN.md'), 'utf8');
      const row = r ? open.split('\n').find((l) => l.includes('e2e:food real') && l.includes(String(r.run.cost?.seconds))) : null;
      return { pass: r ? Boolean(row) : null, what: 'every counting errand records its time and cost', measured: { row: row ?? null, cost: r?.run.cost ?? null }, expected: "a row in OPEN.md's preset calibration table with the preset, seconds and apiCostUsd", evidence: { file: 'docs/thinking-partner/OPEN.md' } };
    },
    A1: async () => {
      const r = sh(root, 'gh', ['run', 'list', '--branch', 'main', '--workflow', 'ci', '--limit', '1', '--json', 'conclusion,headSha,url']);
      const run = JSON.parse(r.stdout || '[]')[0];
      return { pass: run?.conclusion === 'success', what: 'CI is green on main', measured: run ?? null, expected: 'the latest ci run on main: success', evidence: { url: run?.url } };
    },
    A2: async () => {
      const r = sh(root, 'pnpm', ['-s', 'check']);
      return { pass: r.status === 0, what: 'the secret scan is clean (pnpm check)', measured: lastLines(r.stdout + r.stderr, 2), expected: 'check: clean', evidence: { cmd: 'pnpm -s check' } };
    },
    A6: async () => {
      const need = ['planning/README.md', 'planning/ACCEPTANCE_TESTS.md', 'docs/thinking-partner/NOW.md', 'docs/thinking-partner/OPEN.md', 'docs/thinking-partner/LOG.md'];
      const missing = need.filter((p) => !existsSync(join(root, p)));
      return { pass: missing.length === 0, what: '`planning/` and the thinking-partner folder are in place', measured: { missing }, expected: 'all present', evidence: { files: need } };
    },
    A7: async () => {
      const r = sh(root, 'pnpm', ['-s', 'check']);
      return { pass: r.status === 0 && !/address-literal/.test(r.stdout), what: 'no known address literal outside the config (pnpm check)', measured: lastLines(r.stdout, 2), expected: 'no address-literal finding', evidence: { cmd: 'pnpm -s check' } };
    },
    A8: async () => {
      const r = sh(root, 'pnpm', ['-s', 'check']);
      return { pass: r.status === 0 && !/story-/.test(r.stdout), what: 'no story name or value outside the story file (pnpm check)', measured: lastLines(r.stdout, 2), expected: 'no story finding', evidence: { cmd: 'pnpm -s check' } };
    },
    B1: fromEns('B1', 'the graphpay.eth namespace resolves; all owners and agents exist'),
    B4: fromEns('B4', 'the payment preference parses'),
    B5: fromEns('B5', 'a synthetic wildcard name resolves'),
    B8: fromEns('B8', 'ENSIP-26 records exist and the MCP endpoint answers'),
    B9: fromEns('B9', 'the payee is the shop\'s ENS address'),
    B2: async () => {
      const sep = await clientsFor('sepolia', env);
      const wc = await clientsFor('whitechain', env);
      const gate = createPayerGate({ ens: sep.publicClient, whitechain: wc.publicClient });
      const rows = [];
      for (const { ensName: name, capMicro: castCap } of paying) {
        const r = await gate.ensGate(name, 1n);
        // CAP_EXCEEDED is the gate's last step: the name, its epoch, its status and its policy all
        // passed. It counts only for a pass really used up today: the gate's cap is the cast's (above
        // 0; a cap of 0 means "may not spend") and today's spend has reached it. Anyone can spend the
        // payer's under public access (ADR-0069); e2e:hosted's C2 and C3 spend the acceptance agent's.
        // It resets at 00:00 UTC.
        const m = !r.ok && r.reason === 'CAP_EXCEEDED' ? String(r.detail ?? '').match(/^cap (\d+), spent (\d+)$/) : null;
        const usedUp = Boolean(m) && BigInt(m[1]) > 0n && castCap !== undefined && BigInt(m[1]) === BigInt(castCap) && BigInt(m[2]) >= BigInt(m[1]);
        rows.push({ name, ok: r.ok || usedUp, reason: r.ok ? null : r.reason, capMicro: r.capMicro ?? null, ...(m ? { detail: r.detail, passUsedUpToday: usedUp } : {}) });
      }
      return { pass: rows.every((r) => r.ok), what: 'the gate passes active agents', measured: rows, expected: "every paying agent of the story passes the full gate (ENS and its checkout policy); a pass used up today (CAP_EXCEEDED at the cast's own cap, above 0, spend at the cap) still counts, and is named", evidence: { checkout: config.whitechain.contracts.checkout.address } };
    },
    C1: async () => {
      const a = config.whitechain.contracts.checkout.address;
      const res = await fetch(`${config.networks.whitechain.explorerApi}v2/smart-contracts/${a}`, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      const body = res?.ok ? await res.json() : null;
      return { pass: body ? Boolean(body.is_verified) : false, what: 'the checkout is verified on the explorer', measured: body ? { is_verified: body.is_verified, is_fully_verified: body.is_fully_verified, name: body.name } : { status: res?.status ?? 'no answer' }, expected: 'is_verified true', evidence: { url: `${config.networks.whitechain.explorer}/address/${a}?tab=contract` } };
    },
    D4: async () => cityCheck(root, 'D4'),
    D5: async () => {
      const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
      const engine = createGraphEngine(arkiv);
      const q = '{ top(kind: "shop", by: "paid_micro", limit: 10) { node { ens } value } }';
      const a = await runGraphql({ engine, query: q, dataset: 'S' });
      const b = await runGraphql({ engine, query: q, dataset: 'S' });
      const t = engine.explainStore.get(a.extensions.arkiv.explainId);
      const owned = (t?.queries ?? []).every((x) => /owner|\$owner/i.test(String(x)));
      return {
        pass: a.extensions.arkiv.calls === 2 && Boolean(t) && owned && (t?.entityKeys?.length ?? 0) > 0 && a.extensions.arkiv.explainId === b.extensions.arkiv.explainId,
        what: 'the explain trace lists the reads behind each answer',
        measured: { calls: a.extensions.arkiv.calls, explainId: a.extensions.arkiv.explainId, secondRun: b.extensions.arkiv.explainId, queries: t?.queries?.length ?? 0, ownerFilterInEvery: owned, entityKeys: t?.entityKeys?.length ?? 0 },
        expected: 'calls 2; every query carries the owner filter; entity keys non-empty; explain returns the trace; the second run has the same explainId',
        evidence: { dataset: 'S (synthetic)', explainId: a.extensions.arkiv.explainId },
      };
    },
    D6: async () => {
      const md = readFileSync(join(root, 'bench/BENCHMARK-LIVE.md'), 'utf8');
      const pass = /\*\*D6: pass\.\*\*/.test(md);
      const run = md.match(/run (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/)?.[1];
      return { pass, what: 'benchmark at size S (calls exact; times recorded, not scored)', measured: md.match(/\| Graph Arkiv Q2 reads[\s\S]*?\n\n/)?.[0]?.trim().split('\n') ?? [], expected: 'Graph Arkiv 2; plain ceil(R/100) sequential, +1 parallel', evidence: { file: 'bench/BENCHMARK-LIVE.md', run, by: 'T3, M9 (PR 31)' } };
    },
    D8: async () => cityCheck(root, 'D8'),
    D9: async () => {
      const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
      const owner = writerAddresses().W_LEDGER;
      const rows = await readAll(arkiv.publicClient, ENTITIES.edge, { owner, cap: 5, truncate: true });
      const flags = [];
      for (const r of rows.slice(0, 5)) flags.push({ key: r.$key, readonly: Boolean((await arkiv.publicClient.getEntity(r.$key)).$creationFlags?.readonly) });
      return {
        pass: flags.length > 0 && flags.every((f) => f.readonly),
        what: 'a receipt cannot be edited',
        measured: { edgesRead: flags.length, allReadonly: flags.every((f) => f.readonly), sample: flags.slice(0, 2) },
        expected: 'every W_LEDGER edge is created readonly; a patch of one reverts',
        evidence: { readonlyFlags: 'read live now', patchReverts: 'docs/technical/FACTS.md "Readonly edge" (M7a live probe, 01:29 IST: a simulated patch of a probe edge reverts, a tally patch passes)' },
      };
    },
  };
}

// The seeded S city's check (T3's packages/city/scripts/check.mjs, read-only): D4 is its Q2
// top 10 against the generator's truth, D8 its discovery box.
let city = null;
function cityCheck(root, id) {
  if (!city) {
    const file = join(root, 'docs/sessions/arkiv/city/check-S.json');
    const end = JSON.parse(readFileSync(file, 'utf8')).end;
    const before = statSync(file).mtimeMs;
    // Up to 25 minutes: tonight's Arkiv reads go keyless and slow (#148), past the 10-minute default.
    const r = sh(join(root, 'packages/city'), process.execPath, ['scripts/check.mjs', '--size', 'S', '--end', end, '--backend', 'rabdi'], { timeout: 25 * 60_000 });
    // The script exits 1 when any one of its checks fails, so each id reads its own sub-check,
    // and only from a file this run wrote (a crash also exits 1, and leaves the old file).
    city = { run: r.status, fresh: statSync(file).mtimeMs > before, data: JSON.parse(readFileSync(file, 'utf8')), tail: lastLines(r.stdout + r.stderr, 3) };
  }
  const c = city.data.checks;
  const evidence = { script: 'packages/city/scripts/check.mjs (read-only)', file: 'docs/sessions/arkiv/city/check-S.json', exit: city.run, fresh: city.fresh };
  if (id === 'D4') return { pass: city.fresh && c.q2_top10?.ok === true && c.q2_top10?.calls === 2, what: 'GraphQL\'s top 10 matches the ground truth (seeded S city, synthetic)', measured: c.q2_top10, expected: 'exact order and amounts against the generator\'s identity truth; 2 calls', evidence };
  return { pass: city.fresh && c.d8_discovery?.ok === true, what: 'the geo query returns only shops inside the box, and only from our writers', measured: c.d8_discovery, expected: 'the cast shops only; synthetic ones only when opted in', evidence };
}

// E7 and B6 from the one kill (docs/sessions/integration/runs/kill-<label>/kill.json), plus the
// mirror's fold of the recorder's fail edge into the agent's `fails` (read live).
async function killCheck(root, env, id) {
  const dir = join(root, 'docs/sessions/integration/runs');
  const name = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith('kill-')) : null;
  if (!name) return { pass: null, why: 'no kill run yet', what: id === 'E7' ? 'a killed agent is refused' : 'killing a disposable agent makes the gate deny it', measured: null, expected: '', evidence: {} };
  const k = JSON.parse(readFileSync(join(dir, name, 'kill.json'), 'utf8'));
  const evidence = { file: `docs/sessions/integration/runs/${name}/kill.json`, kill: k.kill?.output, alive: k.alive?.transaction ?? null };
  if (id === 'B6') {
    const r = k.refused;
    return { pass: r?.reason === 'ENS_EXPIRED_OR_REVOKED', what: 'killing a disposable agent makes the gate deny it', measured: { reason: r?.reason ?? null, secondsAfterKill: r ? Math.round((r.ms - Date.parse(k.kill.receiptAt)) / 100) / 10 : null }, expected: 'the gate denies ENS_EXPIRED_OR_REVOKED after the owner unregisters', evidence };
  }
  const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
  const node = (await import('../packages/money-graph/index.mjs')).nodeOf(k.agent);
  const tally = (await import('../packages/mirror/src/checks.mjs')).storedTally;
  const t = await tally(arkiv.publicClient, { owner: writerAddresses().W_LEDGER, node });
  const a = k.assertion ?? {};
  const pass = a.pass === true && Number(t?.fails ?? 0) >= 1;
  return { pass, what: 'a killed agent is refused', measured: { assertion: a.measured ?? null, failed: a.failed ?? [], foldedFails: t?.fails ?? null }, expected: "HTTP 402 ENS_EXPIRED_OR_REVOKED within 25 s of the kill's receipt; the recorder's fail edge on Arkiv; folded into fails by the mirror", evidence: { ...evidence, failEdge: k.failEdge?.entityKey ?? null } };
}

// C7 and E3: the one qualifying payment in test USDT as the acceptance payer (made once by T1's
// usdt-ready; its record is docs/sessions/payments/c7.json). Its transaction is taken from that
// record, never from whichever pay edge comes first (the agent also paid C3's re-order), found
// again as the mirror's pay edge from that agent, then read from its receipt.
// C7 and E3 are one payment: measured once per run.
let qualified = null;
async function qualifying(env, id, root = process.cwd()) {
  const what = id === 'C7' ? 'the qualifying payment in test USDT' : 'the payment is made in USDT on Whitechain';
  qualified ??= measureQualifying(env, root).catch((error) => {
    qualified = null;
    throw error;
  });
  return { ...(await qualified), what };
}

// An Arkiv read refused for the shared anonymous budget (HTTP 429) is tried again after a pause.
async function patient(read, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await read();
    } catch (error) {
      const limited = error?.status === 429 || error?.cause?.status === 429 || /ANON_COST_LIMITED|429/.test(String(error?.details ?? error?.cause?.details ?? ''));
      if (!limited || i >= tries) throw error;
      await new Promise((r) => setTimeout(r, 20_000));
    }
  }
}

async function measureQualifying(env, root) {
  const { decodeEventLog, erc20Abi } = await import('viem');
  const { checkoutAbi } = await import('../packages/contracts/index.mjs');
  const entries = castEntries(activeCast());
  const payer = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'acceptance');
  const { nodeOf } = await import('../packages/money-graph/index.mjs');
  const node = nodeOf(payer.ensName).toLowerCase();
  const recordFile = join(root, 'docs/sessions/payments/c7.json');
  const record = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) : null;
  if (!record?.tx) return { pass: null, why: 'no qualifying payment recorded yet (docs/sessions/payments/c7.json)', measured: null, expected: '', evidence: {} };
  const hash = String(record.tx).toLowerCase();
  const wc = await clientsFor('whitechain', env);
  const receipt = await wc.publicClient.getTransactionReceipt({ hash });
  const tx = await wc.publicClient.getTransaction({ hash });
  const checkout = config.whitechain.contracts.checkout.address.toLowerCase();
  const usdt = config.whitechain.tokens.usdt.address.toLowerCase();
  let settled = null;
  let settledIndex = null;
  let transfer = null;
  for (const l of receipt.logs) {
    try {
      if (l.address.toLowerCase() === checkout) {
        const d = decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics });
        if (d.eventName === 'PaymentSettled') [settled, settledIndex] = [d.args, l.logIndex];
      } else if (l.address.toLowerCase() === usdt) {
        const d = decodeEventLog({ abi: erc20Abi, data: l.data, topics: l.topics });
        if (d.eventName === 'Transfer') (transfer ??= []).push(d.args);
      }
    } catch {
      // another event
    }
  }
  // The recorded amount (4.80 when it was paid), not today's story price: the founder's final
  // story may price the order differently.
  const amount = BigInt(record.tokenTransferMicro ?? 0);
  const fromPayer = String(settled?.payerNode ?? '').toLowerCase() === node;
  const paidOut = (transfer ?? []).find((t) => String(t.from).toLowerCase() === String(settled?.payer ?? '').toLowerCase() && BigInt(t.value) === amount);
  // Gasless: a relayer of the checkout sent it, never the payer's wallet (read from the event).
  const byRelayer = await wc.publicClient.readContract({ address: config.whitechain.contracts.checkout.address, abi: checkoutAbi, functionName: 'isRelayer', args: [tx.from] });
  const gasless = Boolean(settled) && tx.from.toLowerCase() !== String(settled.payer).toLowerCase() && byRelayer === true;
  // The mirror's pay edge for that PaymentSettled log: exactly one by its ref (one indexed count),
  // and that one read for its kind, its payer and its amount (not a scan of every edge: tonight's
  // keyless Arkiv endpoint refuses the large reads).
  const ref = settledIndex === null ? null : `${config.networks.whitechain.chainId}:${hash}:${settledIndex}`;
  const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
  const { refCounts } = await import('../packages/mirror/src/checks.mjs');
  const counted = ref ? await patient(() => refCounts(arkiv.publicClient, { owner: writerAddresses().W_LEDGER, events: [{ id: ref, name: 'PaymentSettled' }] })) : null;
  const edge = ref ? await patient(() => findOne(arkiv.publicClient, ENTITIES.edge, { owner: writerAddresses().W_LEDGER, where: compileFilter(ENTITIES.edge, { ref: { eq: ref } }) ?? [] })) : null;
  const edgeOk = counted?.pass === true && edge?.kind === 'pay' && String(edge.from_node).toLowerCase() === node && BigInt(edge.amount_micro ?? -1) === amount;
  const pass = receipt.status === 'success' && Boolean(settled) && BigInt(settled?.amountMicro ?? -1) === amount && amount > 0n && fromPayer && Boolean(paidOut) && gasless && edgeOk;
  return {
    pass,
    measured: { status: receipt.status, paymentSettled: Boolean(settled), settledMicro: settled ? String(settled.amountMicro) : null, fromAcceptancePayer: fromPayer, usdtTransferMicro: paidOut ? String(paidOut.value) : null, txFrom: tx.from, byRelayer, payerSentIt: !gasless, gasUsed: String(receipt.gasUsed), block: Number(receipt.blockNumber), payEdge: edge ? { ref, kind: edge.kind, fromAcceptancePayer: String(edge.from_node).toLowerCase() === node, amountMicro: String(edge.amount_micro) } : { ref, found: false }, payEdges: counted?.pass ? 1 : counted?.wrong?.[0]?.edges ?? null },
    expected: `PaymentSettled on the USDT checkout from the acceptance payer for the recorded ${(Number(amount) / 1e6).toFixed(2)}; the same amount of the configured test USDT transferred from the payer; sent by a relayer (payer gas 0); exactly one pay edge on Arkiv for it, from the acceptance payer, for that amount`,
    evidence: { tx: `${config.networks.whitechain.explorer}/tx/${hash}`, record: 'docs/sessions/payments/c7.json', payer: payer.ensName, by: "T1's usdt-ready (M3 part B)" },
  };
}

// C2–C6 and F2: pnpm e2e:hosted's files (docs/sessions/integration/hosted/), the latest paid run
// for the paying rows and the latest of any run for the 401 rows. C3's renewal is the hosted
// cron's (T1's M4 evidence, docs/sessions/payments/m4-hosted.md), read again from its receipt.
const HOSTED_WHAT = {
  C2: 'a payment through the facilitator costs the payer no gas',
  C3: 'partial refund, re-order and renewal work',
  C4: 'revoked-agent and over-cap failures are recorded',
  C5: 'a repeat request returns "already paid"',
  C6: 'hosted endpoints return 401 without the passcode or token (the server-to-server keys, public access)',
  F2: 'spending endpoints: visitors open (ADR-0069), the keys between our servers enforced',
};
function latestHosted(root, paidOnly) {
  const dir = join(root, 'docs/sessions/integration/hosted');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && (paidOnly ? f.startsWith('paid-') : /^(paid|read)-/.test(f)))
    .map((f) => ({ f: `docs/sessions/integration/hosted/${f}`, run: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
    .sort((a, b) => (a.run.startedAt < b.run.startedAt ? 1 : -1));
  return files[0] ?? null;
}
async function hosted(root, id, env = {}) {
  const what = HOSTED_WHAT[id];
  const h = latestHosted(root, !['C6', 'F2'].includes(id));
  const row = h?.run.rows?.[id];
  if (!row) return { pass: null, why: 'no pnpm e2e:hosted run for this row yet', what, measured: null, expected: '', evidence: {} };
  const evidence = { file: h.f, startedAt: h.run.startedAt, site: h.run.site };
  if (id === 'C3') {
    const renewal = await hostedRenewal(root, env);
    // The recorded re-order counts only when it is the story's re-order now: its amount and,
    // when the story names one, its sku. A run from before ADR-0073's coffee is not run here.
    const r = row.reorder;
    const current = r && String(r.amountMicro) === String(story.order.reorder.priceMicro) && (!story.order.reorder.sku || r.item === story.order.reorder.sku);
    const reorder = r?.pass === false ? false : current ? (r.pass ?? null) : null;
    const parts = { refund: row.refund?.pass ?? null, reorder, renewal: renewal.pass };
    const pass = Object.values(parts).includes(false) ? false : Object.values(parts).every((v) => v === true) ? true : null;
    return { pass, ...(pass === null ? { why: `not run yet: ${Object.keys(parts).filter((k) => parts[k] === null).join(', ')}${parts.reorder === null && r ? ' (the latest paid run re-ordered before the story\'s current re-order; run e2e:hosted --yes on a fresh UTC day)' : ''}` } : {}), what, measured: { ...parts, refundTx: row.refund ?? null, reorderTx: row.reorder ?? null, renewalTx: renewal.measured }, expected: `Refunded(${story.order.refundMicro}, full false), payer +${usd(story.order.refundMicro)}, gas 75,344 ±15%; the story's re-order: OrderCreated(kind 1, parent) + PaymentSettled ${usd(story.order.reorder.priceMicro)}, gas 252,082 ±15%; SubscriptionRenewed(cycle 2) + PaymentSettled of a kind-2 order for the subscription's own amount, gas 201,555 ±15%`, evidence: { ...evidence, renewal: renewal.evidence } };
  }
  if (id === 'C4') {
    // (a) from integration/c4a.mjs (the revoke, the refused payment, the restore), and the
    // mirror's on-chain fail edge for its PaymentFailed log, exactly once.
    const dir = join(root, 'docs/sessions/integration/hosted');
    const c4a = existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith('c4a-')).sort().at(-1) : null;
    if (c4a) {
      const k = JSON.parse(readFileSync(join(dir, c4a), 'utf8'));
      const ref = k.attempt?.paymentFailed?.ref;
      const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
      // Counted by ref (no capped read), and the edge's key from the mirror's own write.
      const { refCounts, mirrorTxOf } = await import('../packages/mirror/src/checks.mjs');
      const counted = ref ? await refCounts(arkiv.publicClient, { owner: writerAddresses().W_LEDGER, events: [{ id: ref, name: 'PaymentFailed' }] }) : null;
      const written = ref ? await mirrorTxOf(arkiv.publicClient, { ref, owner: writerAddresses().W_LEDGER }) : null;
      const edges = counted ? Array.from({ length: counted.wrong.length ? counted.wrong[0].edges : 1 }, () => ({ $key: written?.edgeKey ?? null, kind: 'fail', ref })) : [];
      // The chain again: the PaymentFailed log (reason 1, AGENT_REVOKED) for that order, and the
      // revoke and restore receipts; the scout's policy is not revoked now.
      const { decodeEventLog } = await import('viem');
      const { checkoutAbi } = await import('../packages/contracts/index.mjs');
      const wc = await clientsFor('whitechain', env);
      const checkout = config.whitechain.contracts.checkout.address;
      const ok = async (h) => h && (await wc.publicClient.getTransactionReceipt({ hash: h })).status === 'success';
      const rc = k.attempt?.tx ? await wc.publicClient.getTransactionReceipt({ hash: k.attempt.tx }) : null;
      const log = rc?.logs.find((l) => l.logIndex === k.attempt.paymentFailed?.logIndex && l.address.toLowerCase() === checkout.toLowerCase());
      const ev = log ? decodeEventLog({ abi: checkoutAbi, data: log.data, topics: log.topics }) : null;
      const node = (await import('../packages/money-graph/index.mjs')).nodeOf(k.agent);
      const now = await wc.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] });
      const chain = ev?.eventName === 'PaymentFailed' && Number(ev.args.reason) === 1 && ev.args.orderId.toLowerCase() === String(k.attempt.orderId).toLowerCase() && (await ok(k.revoke?.tx)) && (await ok(k.restore?.tx)) && !now.revoked;
      row.a = { pass: k.pass === true && chain && edges.length === 1 && edges[0].kind === 'fail', chainChecked: chain, file: `docs/sessions/integration/hosted/${c4a}`, attempt: k.attempt, revoke: k.revoke?.explorer, restore: k.restore?.explorer, restoredExactly: k.restoredExactly, failEdges: edges.map((e) => ({ entityKey: e.$key, kind: e.kind, ref: e.ref })) };
    }
    const pass = row.a?.pass === false || row.b?.pass === false ? false : row.a?.pass === true && row.b?.pass === true ? true : null;
    return { pass, ...(pass === null ? { why: `(a) ${row.a?.why ?? 'not run'}; (b) ${row.b?.pass ? 'passes' : 'not run'}` } : {}), what, measured: row, expected: '(a) PaymentFailed(AGENT_REVOKED), gas 160,525 ±15%, an on-chain fail edge; (b) 402 CAP_EXCEEDED, no transaction, an off-chain fail edge', evidence };
  }
  const expected = {
    C2: 'payer WBT identical; PaymentSettled; tx.from = the relayer; gas 312,024 or 234,292–252,082, ±15%; the quote key and the ENS payee read',
    C5: 'HTTP 200 alreadyPaid; relayer nonce and payer balance unchanged',
    C6: "the shop's pay step and the facilitator's verify and settle: every one the app's 401 without and with a wrong key; relayer nonce unchanged",
    F2: "public access on (config site.publicAccess, ADR-0069): the run route takes a visitor without a passcode (an empty request is a 400, nothing starts); every server-to-server route (shop pay and re-order, facilitator, recorder, cron) the app's 401 without and with a wrong key; relayer and merchant nonces unchanged",
  }[id];
  return { pass: row.pass, what, measured: row, expected, evidence };
}
async function hostedRenewal(root, env) {
  const f = join(root, 'docs/sessions/payments/m4-hosted.md');
  const line = existsSync(f) ? readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith('| cron |')) : null;
  const hash = line?.match(/renewed by the hosted cron[^[]*\[[^\]]*\]\([^)]*\/tx\/(0x[0-9a-f]{64})\)/)?.[1];
  if (!hash) return { pass: null, measured: null, evidence: { file: 'docs/sessions/payments/m4-hosted.md' } };
  const { decodeEventLog } = await import('viem');
  const { checkoutAbi } = await import('../packages/contracts/index.mjs');
  const wc = await clientsFor('whitechain', env);
  const receipt = await wc.publicClient.getTransactionReceipt({ hash });
  const checkout = config.whitechain.contracts.checkout.address.toLowerCase();
  const evs = receipt.logs.filter((l) => l.address.toLowerCase() === checkout).flatMap((l) => {
    try {
      return [decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics })];
    } catch {
      return [];
    }
  });
  const renewed = evs.find((e) => e.eventName === 'SubscriptionRenewed');
  const created = evs.find((e) => e.eventName === 'OrderCreated');
  const settled = evs.find((e) => e.eventName === 'PaymentSettled');
  const gas = Number(receipt.gasUsed);
  const byRelayer = await wc.publicClient.readContract({ address: config.whitechain.contracts.checkout.address, abi: checkoutAbi, functionName: 'isRelayer', args: [receipt.from] });
  // The subscription's own amount (SubscriptionRenewed), not today's story price: the recorded
  // renewal ran at the price of its day (the story's renewal moved from 0.40 to 2.40 in #140).
  const pass = receipt.status === 'success' && byRelayer && Boolean(renewed) && settled?.args.amountMicro === renewed.args.amountMicro && Number(renewed.args.cycle) === 2 && Number(created?.args.kind) === 2 && gas >= Math.floor(201_555 * 0.85) && gas <= Math.ceil(201_555 * 1.15);
  return { pass, measured: { cycle: renewed ? Number(renewed.args.cycle) : null, orderKind: created ? Number(created.args.kind) : null, renewedMicro: renewed ? String(renewed.args.amountMicro) : null, settledMicro: settled ? String(settled.args.amountMicro) : null, storyPriceMicro: String(story.renewal.priceMicro), gasUsed: gas, from: receipt.from, fromIsRelayer: byRelayer }, evidence: { tx: `${config.networks.whitechain.explorer}/tx/${hash}`, by: "the hosted cron as RENEWER (T1's M4)", subscription: "the rehearsal agent's 120 s demo subscription (C3 asks only for cycle 2 and a kind-2 PaymentSettled)" } };
}

// F1: the secret scan over the tree (pnpm check), over `git log -p` of every branch (the same
// shapes, labels only), the tracked env files, and the production env's types on Vercel (names
// and types only; the project from config site.vercel).
async function noSecrets(root) {
  const { findSecrets } = await import('../scripts/lib/secret-shapes.mjs');
  const tree = sh(root, process.execPath, ['scripts/check.mjs']);
  const log = sh(root, 'git', ['log', '-p', '--all', '--no-color', '--no-ext-diff', '--format=@@COMMIT %H'], { maxBuffer: 1 << 30 });
  const byLabel = {};
  const commits = String(log.stdout).split('@@COMMIT ').slice(1);
  const hit = new Set();
  for (const c of commits) {
    for (const f of findSecrets(c)) {
      byLabel[f.label] = (byLabel[f.label] ?? 0) + 1;
      hit.add(c.slice(0, 8));
    }
  }
  const envFiles = String(sh(root, 'git', ['ls-files']).stdout).split('\n').filter((f) => /(^|\/)\.env/.test(f));
  const { projectId, team } = config.site.vercel;
  const ls = sh(root, 'vercel', ['env', 'ls', 'production', '--project', projectId, '--scope', team]);
  const vars = String(ls.stdout).split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => /^[A-Z][A-Z0-9_]+$/.test(p[0] ?? '') && p[1]).map((p) => ({ name: p[0], type: p[1] }));
  const secretShaped = vars.filter((v) => /(KEY|TOKEN|SECRET|PASSCODE|RPC_URL)$/.test(v.name));
  const exposed = secretShaped.filter((v) => !['Hidden', 'Secret', 'Sensitive', 'Encrypted'].includes(v.type)).map((v) => v.name);
  const pass = tree.status === 0 && log.status === 0 && commits.length > 0 && hit.size === 0 && envFiles.every((f) => /(^|\/)\.env\.example$/.test(f)) && ls.status === 0 && vars.length > 0 && exposed.length === 0;
  return { pass, what: 'no secrets are in the repo', measured: { tree: lastLines(tree.stdout, 1)[0] ?? null, history: { commits: commits.length, findings: byLabel, commitsWithFindings: [...hit] }, trackedEnvFiles: envFiles, vercelProduction: { vars: vars.length, secretShaped: secretShaped.length, notHidden: exposed } }, expected: 'no secret shapes in the tree or the history of every branch; only .env.example tracked; every key and token on Vercel Hidden or Secret', evidence: { cmds: ['node scripts/check.mjs', 'git log -p --all (scanned in process, labels only)', 'git ls-files', 'vercel env ls production (names and types)'] } };
}
