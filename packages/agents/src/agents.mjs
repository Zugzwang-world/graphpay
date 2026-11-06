// One agent run: an AI SDK 7 ToolLoopAgent with structured output and
// stopWhen isStepCount(8) (the SDK default is 20), traced as agent.start and
// agent.end. A missing, empty, cut-off (max_tokens) or invalid answer is
// recorded as `agent.end { error }` and treated as no answer (planning/SPEC/AGENTS.md §2).
// W4: `askModel` is the model part alone (an agent whose routine steps are code asks it
// once, for its judgment); `runCodeAgent` is an agent whose steps are all code, with the
// same agent.start and agent.end events (`model: 'code'`, no calls).

import { isStepCount, NoObjectGeneratedError, NoOutputGeneratedError, Output, ToolLoopAgent } from 'ai';
import { OUTPUTS, WIRE_OUTPUTS } from './contracts.mjs';
import { promptFor, task as taskMessage } from './prompts.mjs';
import { errorText } from './scrub.mjs';
import { z } from 'zod';

// Kimi answers a request that carries a response_format with the JSON at once and never calls
// its tools (seen on the first live errand). For providers that do, the schema goes into the
// instructions and the last reply is parsed here; code validates it against OUTPUTS either way.
const PROMPTED_JSON = new Set(['moonshot']);

function jsonFromReply(text) {
  const body = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(body);
}

export const MAX_STEPS = 8;

function noAnswerReason(error, steps) {
  if (NoObjectGeneratedError.isInstance(error)) {
    if (error.finishReason === 'length') return 'no answer: the reply hit max_tokens';
    if (!error.text || error.text.trim() === '') return 'no answer: empty reply';
    return 'no answer: the reply is not the JSON the output schema asks for';
  }
  if (NoOutputGeneratedError.isInstance(error)) {
    return steps >= MAX_STEPS ? `no answer: stopped after ${MAX_STEPS} steps` : 'no answer: no final reply';
  }
  return `agent error: ${errorText(error)}`;
}

// Runs `role` as `ens` on `task` with `tools`. Returns { output, error, usageTokens }.
export async function runAgent({ role, ens, task, tools, models, log, meter, sdl, executed = new Set(), signal, prompt }) {
  log.agentStart(ens, role, task);
  const startedAt = meter?.timing ? meter.now() : null;
  const asked = await askModel({ role, ens, task, tools, models, log, meter, sdl, executed, signal, prompt });
  endAgent({ ens, role, log, meter, startedAt, ...asked });
  return { output: asked.output, error: asked.error, usageTokens: asked.usageTokens };
}

// agent.end for one agent: its output (or its error) and every model call it made.
export function endAgent({ ens, role, log, meter, startedAt, output, error, usageTokens = 0, settings = null, calls = [] }) {
  const extra = { usageTokens, model: settings ? settings.model : 'code', effort: settings ? settings.effort : null, calls };
  if (startedAt !== null && startedAt !== undefined) extra.seconds = Number(((meter.now() - startedAt) / 1000).toFixed(2));
  if (error) log.agentEnd(ens, role, null, { ...extra, error: log.scrub(error) });
  else log.agentEnd(ens, role, output, extra);
}

// An agent whose steps are all code (W4: routine steps in code): `run()` does them, through the
// agent's own traced tools, and returns the output, which is checked against OUTPUTS[role].
export async function runCodeAgent({ role, ens, task, log, meter, run }) {
  log.agentStart(ens, role, task);
  const startedAt = meter?.timing ? meter.now() : null;
  let output = null;
  let error = null;
  try {
    const parsed = OUTPUTS[role].safeParse(await run());
    if (parsed.success) output = parsed.data;
    else error = `no answer: code's report does not match the output schema (${parsed.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || 'reply'}: ${i.code}`).join('; ')})`;
  } catch (e) {
    error = `agent error: ${errorText(e)}`;
  }
  endAgent({ ens, role, log, meter, startedAt, output, error });
  return { output, error, usageTokens: 0 };
}

let codeCalls = 0;
// Code calls one of an agent's traced tools itself: the same tool.call and tool.result events as
// when the model calls it.
export function callTool(tool, input) {
  codeCalls += 1;
  return tool.execute(input, { toolCallId: `code-${codeCalls}`, messages: [] });
}

// The model part of an agent: the loop, the parsed and checked answer, and its calls. No
// agent.start or agent.end (the caller writes them). `prompt` overrides the role's prompt.
export async function askModel({ role, ens, task, tools = {}, models, log, meter, sdl, executed = new Set(), signal, prompt }) {
  const { model, settings, callSettings } = models(role);
  const prompted = PROMPTED_JSON.has(settings.provider);
  const instructions = prompt ?? promptFor(role, { sdl });
  const calls = []; // one record per model call (models.mjs createMeter)
  let steps = 0;
  let usageTokens = 0;
  const agent = new ToolLoopAgent({
    model,
    instructions: prompted
      ? `${instructions}\nYour final reply is exactly one JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(z.toJSONSchema(WIRE_OUTPUTS[role]))}`
      : instructions,
    tools,
    ...(prompted ? {} : { output: Output.object({ schema: WIRE_OUTPUTS[role] }) }),
    stopWhen: isStepCount(MAX_STEPS),
    ...callSettings,
    onStepFinish: (step) => {
      steps += 1;
      usageTokens += step.usage?.totalTokens ?? 0;
      const call = meter?.step(role, settings, step);
      if (call) calls.push(call);
      // A call the SDK refused before `execute` (bad input) still belongs in the log.
      for (const part of step.content ?? []) {
        if (part.type === 'tool-error' && !executed.has(part.toolCallId)) {
          log.toolCall(ens, part.toolName, part.input ?? null);
          log.toolResult(ens, part.toolName, null, log.scrub(errorText(part.error)));
        }
      }
    },
  });
  let output = null;
  let error = null;
  try {
    const result = await agent.generate({ prompt: taskMessage(task), abortSignal: signal });
    let raw;
    if (prompted) {
      if (result.finishReason === 'length') error = 'no answer: the reply hit max_tokens';
      else if (!result.text || result.text.trim() === '') error = steps >= MAX_STEPS ? `no answer: stopped after ${MAX_STEPS} steps` : 'no answer: empty reply';
      else {
        try {
          raw = jsonFromReply(result.text);
        } catch {
          error = 'no answer: the reply is not the JSON the output schema asks for';
        }
      }
    } else {
      try {
        raw = result.output;
      } catch (e) {
        error = noAnswerReason(e, steps);
      }
    }
    if (!error) {
      const parsed = OUTPUTS[role].safeParse(raw);
      if (parsed.success) output = parsed.data;
      else {
        // Paths and codes only: a rejected value could be model prose or echoed data.
        const why = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || 'reply'}: ${i.code}`).join('; ');
        error = `no answer: the reply does not match the output schema (${why})`;
      }
    }
  } catch (e) {
    error = noAnswerReason(e, steps);
  }
  return { output, error, usageTokens, settings, calls };
}
