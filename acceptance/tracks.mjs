// The other tracks' checks that Join cites or re-runs read-only (A3, A4, A9, A10, B3, B7, D10),
// in the shape of checks.mjs: { pass, why?, what, measured, expected, evidence }. pass null: no
// evidence yet. Nothing here signs, sends, posts to a spending route or calls a model API.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveRpc, story } from '../packages/config/index.mjs';

const sh = (root, cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 10 * 60_000, ...opts });
const read = (root, p) => readFileSync(join(root, p), 'utf8');
const ticks = (s) => [...String(s).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const gh = (root, args) => {
  const r = sh(root, 'gh', args);
  return r.status === 0 ? JSON.parse(r.stdout || 'null') : null;
};
// Three-valued AND: any false is false, all true is true, otherwise null.
const all = (parts) => (Object.values(parts).includes(false) ? false : Object.values(parts).every((v) => v === true) ? true : null);
const notRun = (parts) => Object.keys(parts).filter((k) => parts[k] === null).join(', ');

export function trackChecks(root, env) {
  return {
    // Static: every rule of SECURITY_AND_OPS §2 in .claude/settings.json; live: the M0 self-check.
    A3: async () => {
      const spec = read(root, 'planning/SPEC/SECURITY_AND_OPS.md');
      const sec = spec.slice(spec.indexOf('## 2.'), spec.indexOf('## 3.'));
      const listed = sec.split('\n').filter((l) => /^\| (secrets|force|destructive)/.test(l)).flatMap((l) => ticks(cells(l)[1]));
      const deny = JSON.parse(read(root, '.claude/settings.json')).permissions?.deny ?? [];
      const missing = listed.filter((r) => !deny.includes(r));
      const relay = 'docs/thinking-partner/relays/foundation.md';
      const self = existsSync(join(root, relay)) ? read(root, relay).split('\n').find((l) => l.startsWith('**A3 self-check.**')) : null;
      const refused = Boolean(self && /Read` of `\.env` was refused with: `(File is in a directory that is denied by your permission settings\.|[^`]*covered by a Read deny rule[^`]*)`/.test(self));
      const parts = { rules: listed.length > 0 && missing.length === 0, selfCheck: self ? refused : null };
      const pass = all(parts);
      return { pass, ...(pass === null ? { why: `not found: ${notRun(parts)}` } : {}), what: 'deny rules block reads of .env', measured: { listed: listed.length, deny: deny.length, missing, extra: deny.filter((r) => !listed.includes(r)), selfCheck: self?.slice(0, 300) ?? null }, expected: 'every rule of SPEC/SECURITY_AND_OPS.md §2 present; the self-check shows the Read of .env refused (P-foundation-3: the wording changed, the block holds)', evidence: { settings: '.claude/settings.json', spec: 'planning/SPEC/SECURITY_AND_OPS.md §2', selfCheck: relay, wording: 'docs/problems/PROBLEM_LOG.md P-foundation-3' } };
    },
    // Repo settings, main's protection, and the latest docs PR merged by auto-merge after ci passed.
    A4: async () => {
      const repo = gh(root, ['api', 'repos/{owner}/{repo}', '--jq', '{full_name, allow_auto_merge, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}']);
      const prot = gh(root, ['api', 'repos/{owner}/{repo}/branches/main/protection', '--jq', '{checks: [(.required_status_checks.contexts // [])[], ((.required_status_checks.checks // [])[] | .context)] | unique, admins: .enforce_admins.enabled, linear: .required_linear_history.enabled, forcePush: .allow_force_pushes.enabled}']);
      const prs = gh(root, ['pr', 'list', '--state', 'merged', '--limit', '30', '--json', 'number,title,url,mergedAt,autoMergeRequest,statusCheckRollup']) ?? [];
      const pr = prs.find((p) => /^docs/.test(p.title) && p.autoMergeRequest);
      const ci = pr?.statusCheckRollup?.find((c) => c.name === 'ci');
      const merged = pr ? { number: pr.number, url: pr.url, autoMergeRequest: { mergeMethod: pr.autoMergeRequest.mergeMethod, enabledAt: pr.autoMergeRequest.enabledAt }, mergedAt: pr.mergedAt, ci: ci ? { conclusion: ci.conclusion, completedAt: ci.completedAt } : null } : null;
      const parts = {
        repo: repo ? repo.allow_auto_merge === true && repo.allow_squash_merge === true && repo.allow_merge_commit === false && repo.allow_rebase_merge === false && repo.delete_branch_on_merge === true : null,
        protection: prot ? prot.checks.includes('ci') && prot.admins === true && prot.linear === true && prot.forcePush === false : null,
        autoMerged: pr ? pr.autoMergeRequest.mergeMethod === 'SQUASH' && ci?.conclusion === 'SUCCESS' && pr.mergedAt >= ci.completedAt && pr.mergedAt >= pr.autoMergeRequest.enabledAt : null,
      };
      const pass = all(parts);
      return { pass, ...(pass === null ? { why: `not read: ${notRun(parts)}` } : {}), what: 'auto-merge works', measured: { repo, protection: prot, pr: merged }, expected: 'auto-merge on, squash only, delete-on-merge on; required check ci, admins enforced, linear history, no force-push; a docs PR merged by auto-merge after ci passed', evidence: { cmd: 'gh api repos/{owner}/{repo}; gh api repos/{owner}/{repo}/branches/main/protection; gh pr list --state merged (read-only)', pr: merged?.url ?? null } };
    },
    // The committed probe rows in OPEN.md's preset calibration table (no model is called here).
    A9: async () => {
      const rows = read(root, 'docs/thinking-partner/OPEN.md').split('\n').filter((l) => /^\| [\d:]+ \| [^|]*probe/.test(l)).map(cells);
      const measured = Object.entries(story.agentModels.presets).map(([name, p]) => {
        const want = [...new Set(Object.values(p.roles).map((r) => `\`${r.model}\`, ${r.effort}`))];
        const row = rows.find((c) => c[2] === name);
        const multi = name === 'live' ? /three/.test(row?.[1] ?? '') : true;
        return { preset: name, want, row: row ? { time: row[0], run: row[1], model: row[3], seconds: row[4], cost: row[5], notes: row[6] } : null, ok: Boolean(row) && want.every((w) => row[3] === w) && /^accepted/.test(row[6]) && /\d/.test(row[4]) && /\$/.test(row[5]) && multi };
      });
      const pass = measured.every((m) => m.row) ? measured.every((m) => m.ok) : null;
      return { pass, ...(pass === null ? { why: `no probe row for ${measured.filter((m) => !m.row).map((m) => m.preset).join(', ')}` } : {}), what: 'the agent presets are accepted', measured, expected: "every preset of story.json's agentModels has a probe row with its model and effort, accepted, seconds and cost recorded; the live preset over three turns", evidence: { file: 'docs/thinking-partner/OPEN.md (preset calibration)', cmd: 'pnpm agents:probe (recorded, not re-run)' } };
    },
    // Config tests (fakes), a label-only live resolveRpc, and the hook and scan on an Ankr URL built now.
    A10: async () => {
      const t = sh(root, process.execPath, ['--test', 'packages/config/test/config.test.mjs']);
      const count = (k) => Number(String(t.stdout).match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? NaN);
      const tests = { exit: t.status, pass: count('pass'), fail: count('fail') };
      const secret = env?.WHITECHAIN_RPC_URL;
      let live;
      try {
        const r = await resolveRpc('whitechain', { env: env ?? {} });
        live = { label: r.label, secret: r.secret, chainId: r.chainId, refused: r.refused };
      } catch (e) {
        live = { error: secret && String(e.message).includes(secret) ? '<withheld: carried a URL>' : String(e.message).slice(0, 300) };
      }
      const fact = read(root, 'docs/technical/FACTS.md').split('\n').find((l) => l.startsWith("| Founder's Ankr RPC (`WHITECHAIN_RPC_URL`)"));
      const recorded = Boolean(fact && /picks it first, chain 1874, nothing refused/.test(fact));
      const { SAMPLES } = await import('../scripts/test/samples.mjs');
      const { buildLine } = await import('../scripts/hooks/prompt-log.mjs');
      const { scanText } = await import('../scripts/check.mjs');
      const url = SAMPLES['ankr-api-key-in-url'];
      const line = await buildLine({ prompt: `the rpc is ${url} ok`, session_id: 'acceptance-a10' });
      const scan = scanText(`const rpc = '${url}';\n`, 'acceptance/a10-probe.mjs');
      const proof = { hookMasks: !line.includes(url) && line.includes('<masked:ankr-api-key-in-url'), scanRefuses: scan.some((f) => f.label === 'ankr-api-key-in-url') };
      const parts = {
        configTests: t.status === 0 && tests.fail === 0 && tests.pass > 0,
        secretFirst: secret ? live.secret === true && live.chainId === 1874 && live.refused.length === 0 : recorded ? true : null,
        noUrlInError: live.error ? !/https?:\/\//.test(live.error) : true,
        hook: proof.hookMasks,
        scan: proof.scanRefuses,
      };
      const pass = all(parts);
      return { pass, ...(pass === null ? { why: `not run: ${notRun(parts)}` } : {}), what: 'the Whitechain RPC rules hold', measured: { tests, live, secretFirst: secret ? 'measured now' : recorded ? 'recorded (FACTS.md, M0 22:51 IST)' : null, proof }, expected: 'config tests pass (wrong chain and plain http refused, no URL in errors); the secret URL chosen first at 1874; the hook masks a keyed Ankr URL and the scan refuses it', evidence: { cmd: 'node --test packages/config/test/config.test.mjs; resolveRpc(whitechain) label-only (eth_chainId reads); buildLine + scanText in process on scripts/test/samples.mjs', fact: "docs/technical/FACTS.md \"Founder's Ankr RPC\"", hookAndScanM0: 'docs/thinking-partner/COVERAGE.md (23:10 proof)' } };
    },
    // T2's real-Sepolia run (b3-real.mjs --send, 02:25 IST), cited from FACTS.md; its tx read again.
    B3: async () => {
      const what = 'a scoped role stops an agent raising its own cap';
      const fact = read(root, 'docs/technical/FACTS.md').split('\n').find((l) => l.startsWith('| Setter scope |'));
      const hash = fact?.match(/b3-real\.mjs --send[^|]*\/tx\/(0x[0-9a-f]{64})/)?.[1];
      if (!hash) return { pass: null, why: 'no recorded b3-real.mjs --send run', what, measured: null, expected: '', evidence: { file: 'docs/technical/FACTS.md' } };
      const refusedRecorded = /five refused writes revert in simulation and were not sent/.test(fact) && /setAddress\(60\)/.test(fact) && /graphpay\.cap_micro/.test(fact) && /EACUnauthorizedAccountRoles/.test(fact);
      const { decodeFunctionData } = await import('viem');
      const { clientsFor } = await import('../scripts/lib/chains.mjs');
      const { KEYS, namespacePlan, permissionedResolverAbi, walkName } = await import('../packages/ens/index.mjs');
      const sep = await clientsFor('sepolia', env ?? {});
      const agent = namespacePlan().agents.find((a) => a.key === 'acceptance');
      const w = await walkName(sep.publicClient, agent.name);
      const [rc, tx] = await Promise.all([sep.publicClient.getTransactionReceipt({ hash }), sep.publicClient.getTransaction({ hash })]);
      const call = decodeFunctionData({ abi: permissionedResolverAbi, data: tx.input });
      const landed = rc.status === 'success' && call.functionName === 'setText' && call.args[1] === KEYS.agentContext && w.ok && tx.from.toLowerCase() === String(w.owner).toLowerCase() && tx.to.toLowerCase() === String(w.resolver).toLowerCase();
      return { pass: landed && refusedRecorded, what, measured: { tx: { status: rc.status, fn: call.functionName, key: call.args[1], fromIsHolder: tx.from.toLowerCase() === String(w.owner).toLowerCase(), toIsResolver: tx.to.toLowerCase() === String(w.resolver).toLowerCase(), gasUsed: Number(rc.gasUsed) }, refusedRecorded }, expected: "agent-context setText lands as the agent's own key; setAddress 2147485522 simulates ok; cap_micro, status, x-graphpay-accepts, agent-endpoint[mcp] setText and setAddress(60) revert EACUnauthorizedAccountRoles in simulation, none sent", evidence: { tx: sep.explorerTx(hash), name: agent.name, file: 'docs/technical/FACTS.md "Setter scope" (T2, b3-real.mjs --send, 02:25 IST; not re-run)', receipt: 'read again now (Sepolia, read-only)' } };
    },
    // Epochs on re-registration: needs a fork test that does not exist yet (only renew-keeps-epoch does).
    B7: async () => {
      const dir = join(root, 'packages/ens/test-fork');
      const titles = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mjs')).flatMap((f) => [...read(root, `packages/ens/test-fork/${f}`).matchAll(/^(?:guard|isolated|test)\('([^']*epoch[^']*)'/gm)].map((m) => `${f}: ${m[1]}`)) : [];
      const covers = titles.some((t) => /re-?regist|e \+ 1|\+1/.test(t));
      return { pass: null, why: covers ? 'the fork test exists but has no recorded output (needs an anvil fork of Sepolia, not run here)' : 'no fork test for a new registration after a lapse or an unregister (only renew keeping the epoch); needs an anvil fork of Sepolia', what: 'the epoch changes on re-registration (fork test)', measured: { epochTests: titles }, expected: 'renew keeps e; a new registration after a lapse gets e + 1; after unregister +1 (AVAILABLE view +2)', evidence: { dir: 'packages/ens/test-fork', cmd: 'pnpm --filter @graphpay/ens test:fork (not run: needs FORK_URL)' } };
    },
    // The payer's own pre-sign check and re-quote on the mock world (fake shop, quotes and signer).
    D10: async () => {
      const { runMockErrand } = await import('../packages/agents/mocks/index.mjs');
      const { teamCast } = await import('../packages/agents/index.mjs');
      const good = teamCast().shopByRole('good').ens;
      const now = Date.parse('2026-11-06T06:30:00.000Z'); // noon IST, before the errand's deadline
      const scenario = async (mode, reason) => {
        const { runLog, world } = await runMockErrand({ now, shops: { [good]: { quoteEntity: mode } } });
        const guards = runLog.events.filter((e) => e.type === 'guard' && /QUOTE_/.test(e.detail ?? '')).map((e) => e.detail);
        const keys = world.hooks.quotes.entries.map((q) => q.key);
        return { refused: guards.some((d) => d.startsWith(`${reason}: re-quoting once`)), requotes: guards.length, status: runLog.result.status, signed: world.hooks.signed.length, quoteKeys: new Set(keys).size, guards };
      };
      const a = await scenario('skip-once', 'QUOTE_MISSING');
      const b = await scenario('expired-once', 'QUOTE_EXPIRED');
      const parts = {
        a: a.refused && a.requotes === 1 && a.status === 'paid' && a.signed === 1,
        b: b.refused && b.requotes === 1 && b.status === 'paid' && b.signed === 1 && b.quoteKeys === 2,
        c: null,
      };
      // (c) from integration/quote-d10.mjs: a live 402 with a requestId at the hosted shop, the
      // quote entity read on Arkiv (it is gone 15 minutes later, so the file keeps the reading).
      const dir = join(root, 'docs/sessions/integration/hosted');
      const qf = existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith('quote-')).sort().at(-1) : null;
      let c = null;
      try {
        c = qf ? JSON.parse(read(root, `docs/sessions/integration/hosted/${qf}`)) : null;
      } catch {
        parts.c = false;
      }
      // Re-derived from the raw reading, never the file's own verdict: the owner against the
      // config, 15 minutes as Arkiv's 2 s blocks (450 ±2), valid_until 600 s ±10 after creation.
      if (c) {
        const { writerAddresses } = await import('../packages/money-graph/index.mjs');
        parts.c = /^0x[0-9a-f]{64}$/.test(String(c.quoteKey)) && String(c.owner).toLowerCase() === writerAddresses().W_DIRECTORY.toLowerCase() && Math.abs(Number(c.lifeBlocks) - (15 * 60) / 2) <= 2 && Math.abs(Number(c.validAfterSeconds) - 600) <= 10;
      }
      const pass = all(parts);
      return { pass, ...(pass === null ? { why: `not run: (${notRun(parts)})` } : {}), what: 'an expired or missing quote is refused and the agent re-quotes', measured: { a, b, c: c ? { quoteKey: c.quoteKey, owner: c.owner, lifeBlocks: c.lifeBlocks, wantBlocks: c.wantBlocks, blockSeconds: c.blockSeconds, validAfterSeconds: c.validAfterSeconds, file: `docs/sessions/integration/hosted/${qf}` } : null }, expected: '(a) QUOTE_MISSING, one re-quote that passes; (b) QUOTE_EXPIRED, one re-quote with a new entity key that passes; no signature before the passing check; (c) owner W_DIRECTORY, expiry 15 min after creation (±2 blocks), valid_until 10 min after', evidence: { how: '(a), (b) in process on the mock world (packages/agents/mocks): createPayer → presignCheck with fake 402s, quote entities and signer; no network, no model, no real signature; the one mock signature follows the passing re-quote', tests: 'packages/agents/test/errand.test.mjs (D10 a, D10 b)' } };
    },
  };
}
