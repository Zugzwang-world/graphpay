import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissionedResolverAbi } from '@graphpay/ens';
import { REOPEN_AFTER_S, RENEW_BELOW_S, RESUME_AFTER_S, planAgent, planShop } from './heal.ts';
import { decodeFunctionData, encodeFunctionResult, parseAbiItem, toHex } from 'viem';
import { namehash, packetToBytes } from 'viem/ens';
import { RECENT_BLOCKS, TEXT_UPDATED, heal, inspect, statusAt, type HealActions, type HealSources } from './heal.server.ts';
import { pausableAgents } from './owner-actions.server.ts';
import { siteModel } from './site.server.ts';

const T = 1_800_000_000;

test('a paused agent resumes RESUME_AFTER_S after its pause, and an active one is left alone', () => {
  assert.deepEqual(planAgent('active', null, T), { status: 'active', pausedAt: null, resumesAt: null, action: 'none' });
  const paused = { value: 'paused', at: T };
  assert.deepEqual(planAgent('paused', paused, T + RESUME_AFTER_S - 1), { status: 'paused', pausedAt: T, resumesAt: T + RESUME_AFTER_S, action: 'wait' });
  assert.equal(planAgent('paused', paused, T + RESUME_AFTER_S).action, 'resume');
  // Paused with no change inside the lookback: an old pause only when the record already read
  // paused RESUME_AFTER_S ago; a brand-new pause on a node a block behind never resumes at once.
  assert.deepEqual(planAgent('paused', null, T, true), { status: 'paused', pausedAt: null, resumesAt: T, action: 'resume' });
  assert.equal(planAgent('paused', null, T, false).action, 'unsure');
  assert.equal(planAgent('paused', null, T).action, 'unsure', 'not read: no action');
  // The record says paused but the newest log says active: a lagging log query; never resume on it.
  assert.equal(planAgent('paused', { value: 'active', at: T }, T + 10 * RESUME_AFTER_S).action, 'unsure');
});

test('the shop: renewed before it lapses, reopened REOPEN_AFTER_S after a close, at once when no listing is left', () => {
  assert.equal(planShop([T + RENEW_BELOW_S + 60], T).action, 'none');
  assert.deepEqual(planShop([T + RENEW_BELOW_S - 1, T - 50], T), { open: true, openUntil: T + RENEW_BELOW_S - 1, closedAt: null, reopensAt: null, action: 'renew' });
  // A close writes open_until = now on the row; the newest row decides.
  assert.deepEqual(planShop([T - 60, T - 900], T), { open: false, openUntil: null, closedAt: T - 60, reopensAt: T - 60 + REOPEN_AFTER_S, action: 'wait' });
  assert.equal(planShop([T - REOPEN_AFTER_S], T).action, 'reopen');
  assert.deepEqual(planShop([], T), { open: false, openUntil: null, closedAt: null, reopensAt: T, action: 'reopen' });
  // A row whose open_until is exactly now is closed (the open-now query reads open_until > now).
  assert.equal(planShop([T], T).open, false);
  // A value that is not a number never decides (it would keep the shop waiting forever).
  assert.equal(planShop([Number.NaN, T - REOPEN_AFTER_S], T).action, 'reopen');
  assert.equal(planShop([Number.NaN], T).action, 'reopen');
});

test("the event filter matches @graphpay/ens's generated resolver ABI", () => {
  const generated = permissionedResolverAbi.find((x) => x.type === 'event' && x.name === 'TextUpdated');
  assert.ok(generated, 'the generated ABI has TextUpdated');
  const shape = (inputs: readonly { name: string; type: string; indexed?: boolean }[] | undefined) => (inputs ?? []).map((i) => `${i.type}${i.indexed ? ' indexed' : ''} ${i.name}`);
  assert.deepEqual(shape(TEXT_UPDATED.inputs), shape(generated.inputs));
});

function world({ statuses, listings }: { statuses: Record<string, { status: string; last: { value: string; at: number } | null; pausedEarlier?: boolean } | Error>; listings: number[] | Error }) {
  const calls: string[] = [];
  const sources: HealSources = {
    agentStatus: async (ens) => {
      const s = statuses[ens] ?? { status: 'active', last: null };
      if (s instanceof Error) throw s;
      return s;
    },
    listings: async () => {
      if (listings instanceof Error) throw listings;
      return listings;
    },
  };
  // As the live actions do: the decision is taken again in the write's turn.
  const actions: HealActions = {
    resume: async (ens, stillDue) => {
      if (!(await stillDue())) return { changed: false, sepoliaTx: null, note: 'no longer due' };
      calls.push(`resume ${ens}`);
      return { changed: true, sepoliaTx: `0x${'cd'.repeat(32)}` };
    },
    openShop: async (ens, stillDue) => {
      if (!(await stillDue())) return { openUntil: null, skipped: true };
      calls.push(`open ${ens}`);
      return { openUntil: T + 900 };
    },
  };
  return { sources, actions, calls };
}

const env = (agents: string[]) => ({ W_DIRECTORY_PRIVATE_KEY: 'set', ...Object.fromEntries(agents.map((a) => [`${a}`, `0x${'1'.repeat(64)}`])) });

test('a run resumes only the agents that are due, reopens a shop closed long enough, and reports each', async () => {
  const [payer, scout] = [siteModel().payer, pausableAgents().find((a) => a.key === 'scout')!];
  const { ownerKeyName } = await import('./owner-actions.server.ts');
  const keys = env([ownerKeyName(payer.ens), ownerKeyName(scout.ens)]);
  const w = world({ statuses: { [payer.ens]: { status: 'paused', last: { value: 'paused', at: T - RESUME_AFTER_S } }, [scout.ens]: { status: 'paused', last: { value: 'paused', at: T - 30 } } }, listings: [T - REOPEN_AFTER_S - 1] });
  const lines: string[] = [];
  const report = await heal({ sources: w.sources, actions: w.actions, nowS: T, clock: () => T, env: keys, log: (l) => lines.push(l) })!;
  assert.deepEqual(w.calls.sort(), [`open ${siteModel().merchant.ens}`, `resume ${payer.ens}`]);
  const byEns = Object.fromEntries(report.agents.map((a) => [a.ens, a]));
  assert.equal(byEns[payer.ens]!.done, 'resumed');
  assert.equal(byEns[scout.ens]!.action, 'wait');
  assert.equal(byEns[scout.ens]!.resumesAt, T - 30 + RESUME_AFTER_S);
  assert.equal(report.shop?.done, 'reopened');
  assert.equal(report.shop?.open, true);
  assert.ok(lines.some((l) => l.includes(payer.ens) && l.includes('resumed')));
  assert.ok(lines.every((l) => !/https?:\/\//.test(l)), 'no URL is logged');
});

test('a failed read or a missing key acts on nothing and is reported as a kind', async () => {
  const payer = siteModel().payer;
  const w = world({ statuses: { [payer.ens]: new Error('fetch failed at https://rpc.example/secret-key') }, listings: new Error('timed out') });
  const report = await heal({ sources: w.sources, actions: w.actions, nowS: T, env: { W_DIRECTORY_PRIVATE_KEY: 'set' }, log: () => undefined })!;
  assert.deepEqual(w.calls, []);
  const p = report.agents.find((a) => a.ens === payer.ens)!;
  assert.equal(p.failed, 'error');
  assert.equal(JSON.stringify(report).includes('rpc.example'), false, 'no message reaches the report');
  assert.equal(report.shop?.failed, 'timeout');
  // Due, but this server has no owner key: nothing is sent.
  const due = world({ statuses: { [payer.ens]: { status: 'paused', last: null, pausedEarlier: true } }, listings: [T + 3600] });
  const keyless = await heal({ sources: due.sources, actions: due.actions, nowS: T, clock: () => T, env: {}, log: () => undefined })!;
  assert.deepEqual(due.calls, []);
  assert.equal(keyless.agents.find((a) => a.ens === payer.ens)!.failed, 'key');
  assert.equal(keyless.shop, null, 'no directory key: the shop is not looked at');
});

test('one run at a time on a server; inspect only reads', async () => {
  const payer = siteModel().payer;
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => (release = r));
  const w = world({ statuses: {}, listings: [T + 3600] });
  const slow: HealSources = { ...w.sources, listings: async () => (await held, [T + 3600]) };
  const keys = { W_DIRECTORY_PRIVATE_KEY: 'set' };
  const first = heal({ sources: slow, actions: w.actions, nowS: T, env: keys, log: () => undefined });
  assert.ok(first);
  assert.equal(heal({ sources: slow, actions: w.actions, nowS: T, env: keys, log: () => undefined }), null);
  release();
  await first;
  const due = world({ statuses: { [payer.ens]: { status: 'paused', last: null, pausedEarlier: true } }, listings: [] });
  const plans = await inspect({ sources: due.sources, nowS: T, env: { W_DIRECTORY_PRIVATE_KEY: 'set' } });
  assert.deepEqual(due.calls, [], 'inspect sends nothing');
  assert.equal(plans.agents.find((a) => a.ens === payer.ens)!.action, 'resume');
  assert.equal(plans.shop?.action, 'reopen');
});

test("a decision is taken again in the write's turn: a visitor's change in between wins", async () => {
  const payer = siteModel().payer;
  const { ownerKeyName } = await import('./owner-actions.server.ts');
  const keys = { W_DIRECTORY_PRIVATE_KEY: 'set', [ownerKeyName(payer.ens)]: `0x${'1'.repeat(64)}` };
  // Planned: resume the payer and renew the listing. By their turn, a visitor resumed and paused
  // again (a fresh pause) and closed the shop.
  let reads = 0;
  const statuses = [{ status: 'paused', last: { value: 'paused', at: T - RESUME_AFTER_S } }, { status: 'paused', last: { value: 'paused', at: T - 5 } }];
  const lists = [[T + RENEW_BELOW_S - 30], [T - 2]];
  let listReads = 0;
  const sources: HealSources = {
    agentStatus: async (ens) => (ens === payer.ens ? statuses[Math.min(reads++, 1)]! : { status: 'active', last: null }),
    listings: async () => lists[Math.min(listReads++, 1)]!,
  };
  const w = world({ statuses: {}, listings: [] });
  const report = await heal({ sources, actions: w.actions, nowS: T, clock: () => T, env: keys, log: () => undefined })!;
  assert.deepEqual(w.calls, [], 'nothing is sent');
  assert.equal(report.agents.find((a) => a.ens === payer.ens)!.done, 'no longer due');
  assert.equal(report.shop?.done, 'no longer due');
});

test('the pause route refuses a body that is not a JSON object, rather than pausing the payer', async () => {
  for (const path of ['../app/api/customer/pause/route.ts', '../app/api/customer/resume/route.ts']) {
    const { POST } = (await import(path)) as { POST: (r: Request) => Promise<Response> };
    for (const body of ['[1,2]', 'not json', JSON.stringify({ agent: 'x' }).repeat(400)]) {
      const res = await POST(new Request('https://example.test/api/customer/pause', { method: 'POST', headers: { 'content-type': 'application/json' }, body }));
      assert.equal(res.status, 400, `${path} ${body.slice(0, 12)}`);
    }
  }
});

test("the earlier status is read through the resolver's ENSIP-10 resolve, at the block asked", async () => {
  const name = siteModel().payer.ens;
  const resolver = `0x${'ab'.repeat(20)}` as const;
  const TEXT = parseAbiItem('function text(bytes32 node, string key) view returns (string)');
  const calls: { functionName: string; blockNumber?: bigint }[] = [];
  // The ENSv2 resolver has no direct text(): a stub that answers resolve only, as it does.
  const client = {
    readContract: async (req: { address: string; functionName: string; args: readonly unknown[]; blockNumber?: bigint }) => {
      calls.push({ functionName: req.functionName, blockNumber: req.blockNumber });
      if (req.functionName !== 'resolve') throw new Error('execution reverted');
      assert.equal(req.address, resolver);
      assert.equal(req.args[0], toHex(packetToBytes(name)));
      const inner = decodeFunctionData({ abi: [TEXT], data: req.args[1] as `0x${string}` });
      assert.deepEqual(inner.args, [namehash(name), 'graphpay.status']);
      return encodeFunctionResult({ abi: [TEXT], functionName: 'text', result: 'paused' });
    },
  };
  assert.equal(await statusAt(client as never, name, resolver, 12_000_000n - RECENT_BLOCKS), 'paused');
  assert.deepEqual(calls, [{ functionName: 'resolve', blockNumber: 12_000_000n - RECENT_BLOCKS }]);
  assert.equal(RECENT_BLOCKS, BigInt(Math.ceil(RESUME_AFTER_S / 12)));
});
