// pnpm agents:probe [--preset NAME]
// One tiny call per agent preset in the story config, plus a short multi-turn
// exchange for the live preset, to confirm each model id and effort level is
// accepted (ADR-0048). Prints seconds, tokens, API cost, stop reasons and a short
// preview of each reply; flags an empty text reply and a max_tokens stop. Never
// prints the key. Spends a few cents.

import Anthropic from '@anthropic-ai/sdk';
import { apiCostUsd, story } from '../../packages/config/index.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';

const { values } = loadEnv();
installErrorBoundary(() => values);
const apiKey = values.get('ANTHROPIC_API_KEY');
if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
const client = new Anthropic({ apiKey });

const only = process.argv.includes('--preset') ? process.argv[process.argv.indexOf('--preset') + 1] : null;
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
    reply: JSON.stringify(result.text.slice(0, 40)),
    flags: flags.join(', ') || 'ok',
  });
}

for (const [preset, definition] of Object.entries(story.agentModels.presets)) {
  if (only && preset !== only) continue;
  // Every role of a preset that shares one model and effort is probed once.
  const distinct = new Map(Object.values(definition.roles).map((s) => [`${s.model}|${s.effort}|${s.maxTokens}`, s]));
  for (const settings of distinct.values()) {
    try {
      record(preset, settings, 'tiny', await turn(settings, [{ role: 'user', content: 'Reply with exactly one word: ok' }]));
      if (preset === 'live') {
        const messages = [];
        const prompts = [
          'Add 12, 30 and 7. Reply with the number only.',
          'Multiply your last answer by 2. Reply with the number only.',
          'Name one sweet sold in Mumbai, in at most three words.',
        ];
        for (const [i, prompt] of prompts.entries()) {
          messages.push({ role: 'user', content: prompt });
          const result = await turn(settings, messages);
          messages.push({ role: 'assistant', content: result.message.content });
          record(preset, settings, `multi-turn ${i + 1}`, result);
        }
      }
    } catch (error) {
      const status = error instanceof Anthropic.APIError ? `${error.status} ${error.error?.error?.type ?? ''}`.trim() : 'error';
      rows.push({ preset, model: settings.model, effort: settings.effort, call: 'tiny', flags: `REJECTED (${status}): ${String(error.message).slice(0, 160)}` });
    }
  }
}

const columns = ['preset', 'model', 'effort', 'call', 'seconds', 'input', 'output', 'cost', 'stop', 'reply', 'flags'];
console.log(`| ${columns.join(' | ')} |`);
console.log(`|${columns.map(() => '---').join('|')}|`);
for (const row of rows) console.log(`| ${columns.map((c) => row[c] ?? '').join(' | ')} |`);
const total = rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
console.log(`\ntotal API cost: $${total.toFixed(4)} (prices: packages/config/graphpay.config.json models)`);
