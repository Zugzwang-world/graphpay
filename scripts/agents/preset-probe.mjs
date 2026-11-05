// pnpm agents:probe [--preset NAME]
// One tiny call per agent preset in the story config, plus a short multi-turn
// exchange for the live preset, to confirm each model id and effort level is
// accepted (ADR-0048). Prints seconds, tokens, API cost, stop reasons and a short
// preview of each reply; flags an empty text reply and a max_tokens stop. Never
// prints the key: the client talks only to the config's API URL (models.apiBaseUrl;
// a shell ANTHROPIC_BASE_URL is ignored), and every printed error is redacted
// before it is cut. An unknown preset or argument is refused before any call.
// Spends a few cents.

import Anthropic from '@anthropic-ai/sdk';
import { apiCostUsd, config, story } from '../../packages/config/index.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../lib/redact.mjs';
import { clientOptions, parseProbeArgs, rejectedFlags } from './probe-lib.mjs';

let values = new Map();
installErrorBoundary(() => values);
const only = parseProbeArgs(process.argv.slice(2), story.agentModels.presets);
({ values } = loadEnv());
const redact = redactor(values);
const client = new Anthropic(clientOptions(values.get('ANTHROPIC_API_KEY'), config.models));
const rows = [];

async function turn(settings, messages) {
  const started = performance.now();
  const message = await client.messages
    .stream({
      model: settings.model,
      max_tokens: settings.maxTokens,
      output_config: { effort: settings.effort },
      messages,
    })
    .finalMessage();
  const seconds = (performance.now() - started) / 1000;
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  return { message, seconds, text, cost: apiCostUsd(settings.model, message.usage) };
}

function record(preset, settings, call, result) {
  const flags = [];
  if (result.text === '') flags.push('EMPTY TEXT');
  if (result.message.stop_reason === 'max_tokens') flags.push('MAX_TOKENS');
  rows.push({
    preset,
    model: result.message.model,
    effort: settings.effort,
    call,
    seconds: result.seconds.toFixed(1),
    input: result.message.usage.input_tokens,
    output: result.message.usage.output_tokens,
    cost: result.cost.toFixed(5),
    stop: result.message.stop_reason,
    reply: JSON.stringify(redact(result.text).slice(0, 40)),
    flags: flags.join(', ') || 'ok',
  });
}

for (const [preset, definition] of Object.entries(story.agentModels.presets)) {
  if (only && preset !== only) continue;
  // Every role of a preset that shares one model and effort is probed once.
  const distinct = new Map(Object.values(definition.roles).map((s) => [`${s.model}|${s.effort}|${s.maxTokens}`, s]));
  for (const settings of distinct.values()) {
    let call = 'tiny';
    try {
      record(preset, settings, call, await turn(settings, [{ role: 'user', content: 'Reply with exactly one word: ok' }]));
      if (preset === 'live') {
        const messages = [];
        const prompts = [
          'Add 12, 30 and 7. Reply with the number only.',
          'Multiply your last answer by 2. Reply with the number only.',
          'Name one sweet sold in Mumbai, in at most three words.',
        ];
        for (const [i, prompt] of prompts.entries()) {
          call = `multi-turn ${i + 1}`;
          messages.push({ role: 'user', content: prompt });
          const result = await turn(settings, messages);
          messages.push({ role: 'assistant', content: result.message.content });
          record(preset, settings, call, result);
        }
      }
    } catch (error) {
      rows.push({ preset, model: settings.model, effort: settings.effort, call, flags: rejectedFlags(error, redact) });
    }
  }
}

const columns = ['preset', 'model', 'effort', 'call', 'seconds', 'input', 'output', 'cost', 'stop', 'reply', 'flags'];
console.log(`| ${columns.join(' | ')} |`);
console.log(`|${columns.map(() => '---').join('|')}|`);
for (const row of rows) console.log(`| ${columns.map((c) => row[c] ?? '').join(' | ')} |`);
const total = rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
console.log(`\ntotal API cost: $${total.toFixed(4)} (prices: packages/config/graphpay.config.json models)`);
