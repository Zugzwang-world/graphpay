// The run log (planning/SPEC/AGENTS.md §9): schema graphpay.agent-run/v1, the
// events the website's agent feed and explainer replay. Every event carries a
// sequence number, so parallel work is testable (both starts before either end).
// Every string is scrubbed before it is stored or streamed (G14).

import { scrubDeep } from './scrub.mjs';

export const RUN_SCHEMA = 'graphpay.agent-run/v1';

export function createRunLog({ scrub, onEvent, observe } = {}) {
  const events = [];
  const edges = [];
  let seq = 0;
  const clean = scrub ?? ((t) => t);

  // `observe(entry, meta)` is the activity feed (presence, handoffs): it sees the
  // stored entry plus facts that are not part of the log (a message's lane).
  function emit(event, meta) {
    const entry = scrubDeep({ seq: ++seq, ...event }, clean);
    events.push(entry);
    if (observe) {
      try {
        observe(entry, meta);
      } catch {
        // an observer never stops an errand
      }
    }
    if (onEvent) {
      try {
        onEvent(entry);
      } catch {
        // a broken listener never stops an errand
      }
    }
    return entry;
  }

  return {
    events,
    edges,
    scrub: clean,
    message(from, to, text, step) {
      const entry = emit({ type: 'message', from, to, text }, { step });
      edges.push({ seq: entry.seq, from, to });
      return entry;
    },
    agentStart(agent, role, task) {
      return emit({ type: 'agent.start', agent, role, task });
    },
    agentEnd(agent, role, output, extra = {}) {
      return emit({ type: 'agent.end', agent, role, output, ...extra });
    },
    toolCall(agent, tool, input) {
      return emit({ type: 'tool.call', agent, tool, input });
    },
    toolResult(agent, tool, output, error) {
      return emit(error === undefined ? { type: 'tool.result', agent, tool, output } : { type: 'tool.result', agent, tool, output, error });
    },
    guard(guard, ok, detail) {
      return emit({ type: 'guard', guard, ok, detail });
    },
  };
}
