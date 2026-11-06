// AI SDK tools that trace themselves into the run log: `tool.call` before the
// code runs and `tool.result` after, with errors scrubbed (G14). The call is
// logged synchronously, so a guard at the top of `execute` still runs before
// any await. `modelView(output)` is what the model reads of a result (W4: shorter
// tool replies); the log, the screens and the explainer keep the whole result.

import { tool } from 'ai';
import { errorText } from './scrub.mjs';

export function tracedTool(log, agent, name, { description, inputSchema, execute, executed, modelView }) {
  return tool({
    description,
    inputSchema,
    ...(modelView ? { toModelOutput: ({ output }) => ({ type: 'json', value: modelView(output) ?? null }) } : {}),
    execute: async (input, options) => {
      executed?.add(options?.toolCallId);
      log.toolCall(agent, name, input);
      try {
        const output = await execute(input, options);
        log.toolResult(agent, name, output);
        return output;
      } catch (error) {
        const message = log.scrub(errorText(error));
        log.toolResult(agent, name, null, message);
        throw new Error(message);
      }
    },
  });
}
