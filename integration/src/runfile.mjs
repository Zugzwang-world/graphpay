// The outputs of `pnpm e2e:food` (planning/SPEC/INTEGRATION_AND_MIRROR.md §5): the machine
// run file (`graphpay.integration-run/v1`), which the website's replay and
// ACCEPTANCE_REPORT.md read, and the readable transcript. Only live-model runs write them
// to docs/sessions/integration/runs/; mock runs write elsewhere.

import { config } from '@graphpay/config';

export const RUN_SCHEMA = 'graphpay.integration-run/v1';

const txUrl = (net, hash) => `${config.networks[net].explorer}/tx/${hash}`;
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)));

// network: 'fork' | 'real'. events: decoded checkout events. writes: the mirror's Rabdi
// transactions ({ ref, txHash }). answers: GraphQL answers ({ what, explainId, data }).
export function buildRunFile({ network, model, startedAt, endedAt, runLog, events = [], writes = [], answers = [], kill = null, assertions = [], cost = null }) {
  const onChain = network === 'real';
  return plain({
    schema: RUN_SCHEMA,
    label: `${runLog.label}${onChain ? '' : ' (fork)'}`,
    network,
    receipts: onChain ? 'WHITECHAIN' : 'FORK',
    synthetic: true,
    model,
    startedAt,
    endedAt,
    seconds: Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 100) / 10,
    cost,
    agents: runLog,
    chain: events.map((e) => ({ id: e.id, name: e.name, block: e.block, tx: e.txHash, explorer: onChain ? txUrl('whitechain', e.txHash) : null })),
    mirror: writes.map((w) => ({ ref: w.ref, tx: w.txHash, explorer: onChain ? txUrl('rabdi', w.txHash) : null })),
    graphql: answers,
    kill,
    assertions: assertions.map((a) => ({ id: a.id, pass: a.pass, failed: a.failed, measured: a.measured, expected: a.expected })),
    pass: assertions.length > 0 && assertions.every((a) => a.pass),
  });
}

export function transcript(run) {
  const lines = [
    `# e2e:food transcript (${run.label})`,
    '',
    `${run.startedAt} → ${run.endedAt} (${run.seconds} s), ${run.network} network, receipts ${run.receipts}, model ${run.model}.${run.cost ? ` API cost ${run.cost.apiCostUsd} USD.` : ''} The story and its history are synthetic.`,
    '',
    '## Assertions',
    '',
    '| id | result | measured | expected |',
    '|---|---|---|---|',
    ...run.assertions.map((a) => `| ${a.id} | ${a.pass ? 'pass' : `FAIL (${a.failed.join('; ')})`} | ${JSON.stringify(a.measured ?? null).replace(/\|/g, '\\|').slice(0, 300)} | ${String(a.expected ?? '').replace(/\|/g, '\\|')} |`),
    '',
    '## The errand',
    '',
    ...(run.agents.events ?? [])
      .filter((e) => e.type === 'message' || e.type === 'guard')
      .map((e) => (e.type === 'message' ? `- **${e.from} → ${e.to}:** ${String(e.text).slice(0, 400)}` : `- guard ${e.guard} ${e.ok ? 'ok' : 'refused'}: ${e.detail}`)),
    '',
    '## On-chain',
    '',
    ...run.chain.map((e) => `- ${e.name} \`${e.id}\`${e.explorer ? ` [tx](${e.explorer})` : ''}`),
    '',
    '## Mirrored to Arkiv',
    '',
    ...run.mirror.map((w) => `- \`${w.ref}\`${w.explorer ? ` [Rabdi tx](${w.explorer})` : ''}`),
    '',
    '## GraphQL answers',
    '',
    ...run.graphql.map((g) => `- ${g.what}: explain \`${g.explainId}\``),
    '',
  ];
  if (run.kill) lines.push('## The kill', '', `\`${JSON.stringify(run.kill)}\``, '');
  return `${lines.join('\n')}\n`;
}
