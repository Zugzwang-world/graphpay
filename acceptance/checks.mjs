// The acceptance checks this repo can run today (read-only), as functions that return
// { pass, what, measured, expected, evidence }. pass: true | false | null (null: nothing to
// test yet, reported "not run"). Committed evidence from another track is cited with its
// file and date, never re-measured by a write (the live probe and the seeding write; the
// workers process is the only W_LEDGER writer while it runs).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeCast, castEntries, config } from '../packages/config/index.mjs';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { createPayerGate } from '../integration/src/gate.mjs';
import { connectArkiv, createGraphEngine, ENTITIES, runGraphql, writerAddresses } from '../packages/money-graph/index.mjs';
import { readAll } from '../packages/arkiv-graph/index.mjs';

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

export function checks(root, env) {
  const cast = activeCast();
  const entries = castEntries(cast);
  const payers = entries.filter((e) => e.kind === 'buyer-agent' && e.pays).map((e) => e.ensName);
  let ensScript = null;
  const ens = () => (ensScript ??= sh(root, process.execPath, ['scripts/ens/acceptance.mjs']));
  const fromEns = (id, what) => () => {
    const out = ens();
    const rows = linesById(out.stdout)[id] ?? [];
    return { pass: rows.length ? rows.every((r) => r.ok) : null, what, measured: rows.map((r) => r.line), expected: 'every line of scripts/ens/acceptance.mjs for this id passes', evidence: { script: 'scripts/ens/acceptance.mjs', exit: out.status } };
  };

  return {
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
      for (const name of payers) {
        const r = await gate.ensGate(name, 1n);
        rows.push({ name, ok: r.ok, reason: r.ok ? null : r.reason, capMicro: r.capMicro ?? null });
      }
      return { pass: rows.every((r) => r.ok), what: 'the gate passes active agents', measured: rows, expected: 'every paying agent of the story passes the full gate (ENS and its checkout policy)', evidence: { checkout: config.whitechain.contracts.checkout.address } };
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
    const end = JSON.parse(readFileSync(join(root, 'docs/sessions/arkiv/city/check-S.json'), 'utf8')).end;
    const r = sh(join(root, 'packages/city'), process.execPath, ['scripts/check.mjs', '--size', 'S', '--end', end, '--backend', 'rabdi']);
    const file = join(root, 'docs/sessions/arkiv/city/check-S.json');
    city = { run: r.status, data: JSON.parse(readFileSync(file, 'utf8')), tail: lastLines(r.stdout + r.stderr, 3) };
  }
  const c = city.data.checks;
  if (id === 'D4') return { pass: city.run === 0 && c.q2_top10?.ok === true && c.q2_top10?.calls === 2, what: 'GraphQL\'s top 10 matches the ground truth (seeded S city, synthetic)', measured: c.q2_top10, expected: 'exact order and amounts against the generator\'s identity truth; 2 calls', evidence: { script: 'packages/city/scripts/check.mjs (read-only)', file: 'docs/sessions/arkiv/city/check-S.json', exit: city.run } };
  return { pass: city.run === 0 && c.d8_discovery?.ok === true, what: 'the geo query returns only shops inside the box, and only from our writers', measured: c.d8_discovery, expected: 'the cast shops only; synthetic ones only when opted in', evidence: { script: 'packages/city/scripts/check.mjs (read-only)', exit: city.run } };
}
