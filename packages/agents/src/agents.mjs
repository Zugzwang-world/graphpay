// One agent run: an AI SDK 7 ToolLoopAgent with structured output and
// stopWhen isStepCount(8) (the SDK default is 20), traced as agent.start and
// agent.end. A missing, empty, cut-off (max_tokens) or invalid answer is
// recorded as `agent.end { error }` and treated as no answer (planning/SPEC/AGENTS.md §2).

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
export async function runAgent({ role, ens, task, tools, models, log, meter, sdl, executed = new Set(), signal }) {
  const { model, settings, callSettings } = models(role);
  log.agentStart(ens, role, task);
  const prompted = PROMPTED_JSON.has(settings.provider);
  let steps = 0;
  let usageTokens = 0;
  const agent = new ToolLoopAgent({
    model,
    instructions: prompted
      ? `${promptFor(role, { sdl })}\nYour final reply is exactly one JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(z.toJSONSchema(WIRE_OUTPUTS[role]))}`
      : promptFor(role, { sdl }),
    tools,
    ...(prompted ? {} : { output: Output.object({ schema: WIRE_OUTPUTS[role] }) }),
    stopWhen: isStepCount(MAX_STEPS),
    ...callSettings,
    onStepFinish: (step) => {
      steps += 1;
      usageTokens += step.usage?.totalTokens ?? 0;
      meter?.step(role, settings, step);
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
  const extra = { usageTokens, model: settings.model };
  if (error) log.agentEnd(ens, role, null, { ...extra, error: log.scrub(error) });
  else log.agentEnd(ens, role, output, extra);
  return { output, error, usageTokens };
}
