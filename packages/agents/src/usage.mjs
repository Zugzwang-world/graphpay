// Tokens and seconds per agent and per model call, read back from a run log's events: each
// `agent.end` carries its `calls` (models.mjs createMeter) and, on live runs, its `seconds`. For
// the preset calibration rows (docs/thinking-partner/OPEN.md) and the before-and-after of a change.

const sum = (calls, key) => calls.reduce((n, c) => n + (Number.isFinite(c?.[key]) ? c[key] : 0), 0);
const round = (value, places) => Number(value.toFixed(places));

export function usageOf(events) {
  const agents = [];
  for (const e of events ?? []) {
    if (e?.type !== 'agent.end') continue;
    const calls = Array.isArray(e.calls) ? e.calls : [];
    agents.push({
      agent: e.agent,
      role: e.role,
      model: e.model ?? null,
      effort: e.effort ?? null,
      seconds: Number.isFinite(e.seconds) ? e.seconds : null,
      calls: calls.length,
      input: sum(calls, 'input'),
      cached: sum(calls, 'cached'),
      output: sum(calls, 'output'),
      reasoning: sum(calls, 'reasoning'),
      usd: round(sum(calls, 'usd'), 6),
      modelSeconds: round(sum(calls, 'seconds'), 2),
      perCall: calls,
      ...(e.error ? { error: e.error } : {}),
    });
  }
  const total = {
    agents: agents.length,
    calls: agents.reduce((n, a) => n + a.calls, 0),
    input: agents.reduce((n, a) => n + a.input, 0),
    cached: agents.reduce((n, a) => n + a.cached, 0),
    output: agents.reduce((n, a) => n + a.output, 0),
    reasoning: agents.reduce((n, a) => n + a.reasoning, 0),
    usd: round(agents.reduce((n, a) => n + a.usd, 0), 6),
    modelSeconds: round(agents.reduce((n, a) => n + a.modelSeconds, 0), 2),
  };
  return { agents, total };
}

// The table as Markdown: one row per agent, then one per model call under it.
export function usageTable({ agents, total }) {
  const lines = ['| agent | call | effort | input | cached | output | reasoning | model s | tool s | USD | tools |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const a of agents) {
    lines.push(`| **${a.role}** | ${a.calls} calls${a.seconds !== null ? `, ${a.seconds} s` : ''} | ${a.effort ?? '-'} | ${a.input} | ${a.cached} | ${a.output} | ${a.reasoning} | ${a.modelSeconds} | | ${a.usd.toFixed(4)} |${a.error ? ` ${a.error}` : ''} |`);
    a.perCall.forEach((c, i) => {
      lines.push(`| | ${i + 1} | | ${c.input} | ${c.cached} | ${c.output} | ${c.reasoning} | ${c.seconds ?? '-'} | ${c.toolSeconds ?? '-'} | ${Number(c.usd ?? 0).toFixed(4)} | ${(c.tools ?? []).join(', ')} |`);
    });
  }
  lines.push(`| **errand** | ${total.calls} calls | | ${total.input} | ${total.cached} | ${total.output} | ${total.reasoning} | ${total.modelSeconds} | | ${total.usd.toFixed(4)} | |`);
  return lines.join('\n');
}
