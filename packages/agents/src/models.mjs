// Which model each role runs on. AGENT_MODE=mock|anthropic|auto picks the kind
// (auto = live only when the key exists); an unknown value is an error, so a typo
// never starts a paid run. Live models and their effort come from the story
// config's presets through agentPreset(role) (ADR-0048); AGENT_PRESET overrides
// the active preset for one run. Nothing here names a model.

import { createAnthropic } from '@ai-sdk/anthropic';
import { agentPreset, apiCostUsd, config } from '@graphpay/config';
import { wrapLanguageModel } from 'ai';

export const AGENT_MODES = Object.freeze(['mock', 'anthropic', 'auto']);

// Unset means mock: no key is read and nothing is paid for.
export function resolveAgentMode(env = process.env) {
  const raw = env.AGENT_MODE;
  if (raw === undefined || raw === '') return 'mock';
  if (!AGENT_MODES.includes(raw)) {
    const shown = /^[a-z][a-z0-9-]{0,15}$/i.test(raw) ? `"${raw}"` : 'that value';
    throw new Error(`AGENT_MODE ${shown} is not one of ${AGENT_MODES.join(', ')}; refusing to start`);
  }
  if (raw === 'auto') return env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock';
  return raw;
}

// ADR-0048: read only the final text block of a reply. A model can answer in two
// text blocks (the M0 probe saw it once); joined, two JSON answers would not parse.
export const finalTextBlockOnly = Object.freeze({
  specificationVersion: 'v4',
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    const texts = result.content.filter((part) => part.type === 'text');
    if (texts.length <= 1) return result;
    const keep = texts.findLast((part) => part.text.trim() !== '') ?? texts.at(-1);
    return { ...result, content: result.content.filter((part) => part.type !== 'text' || part === keep) };
  },
});

function anthropicBaseUrl() {
  const origin = config.models?.apiBaseUrl;
  if (typeof origin !== 'string' || !/^https:\/\/[^/?#\s]+$/.test(origin)) {
    throw new Error('models.apiBaseUrl in packages/config/graphpay.config.json must be an https origin');
  }
  return `${origin}/v1`;
}

// role → { model, settings, callSettings }. In mock mode `mocks(role)` supplies the
// scripted model. The key and base URL are passed explicitly, so a shell
// ANTHROPIC_BASE_URL is never read and the key only goes to the config's API host.
export function createModelFactory({ mode, env = process.env, mocks } = {}) {
  if (mode === 'mock') {
    return (role) => {
      const model = mocks?.(role);
      if (!model) throw new Error(`no mock model for role "${role}"`);
      return {
        model: wrapLanguageModel({ model, middleware: finalTextBlockOnly }),
        settings: { preset: 'mock', role, provider: 'mock', model: 'mock', effort: null, maxTokens: null },
        callSettings: {},
      };
    };
  }
  if (mode !== 'anthropic') throw new Error(`unknown agent mode "${String(mode)}"`);
  const apiKey = env.ANTHROPIC_API_KEY;
  if (typeof apiKey !== 'string' || apiKey === '') throw new Error('ANTHROPIC_API_KEY is not set (AGENT_MODE=anthropic)');
  const provider = createAnthropic({ apiKey, baseURL: anthropicBaseUrl() });
  return (role) => {
    const settings = agentPreset(role, { env });
    if (settings.provider !== 'anthropic') throw new Error(`agent preset "${settings.preset}" names provider "${settings.provider}", which is not installed`);
    if (!config.models.effortLevels.includes(settings.effort)) throw new Error(`agent preset "${settings.preset}" has an unknown effort for "${role}"`);
    if (!Number.isSafeInteger(settings.maxTokens) || settings.maxTokens <= 0) throw new Error(`agent preset "${settings.preset}" has no maxTokens for "${role}"`);
    return {
      model: wrapLanguageModel({ model: provider(settings.model), middleware: finalTextBlockOnly }),
      settings,
      callSettings: { maxOutputTokens: settings.maxTokens, providerOptions: { anthropic: { effort: settings.effort } } },
    };
  };
}

// The Anthropic usage of one step, in the API's own field names (for apiCostUsd).
function rawUsage(step) {
  const raw = step.providerMetadata?.anthropic?.usage ?? step.usage?.raw;
  if (raw && typeof raw === 'object' && 'input_tokens' in raw) return raw;
  const u = step.usage ?? {};
  return {
    input_tokens: u.inputTokenDetails?.noCacheTokens ?? u.inputTokens ?? 0,
    output_tokens: u.outputTokens ?? 0,
    cache_read_input_tokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
    cache_creation_input_tokens: u.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
}

// Tokens and API cost over every response of an errand (E8: cost from apiCostUsd).
export function createMeter() {
  const meter = { calls: 0, tokens: 0, costUsd: 0, byRole: {} };
  meter.step = (role, settings, step) => {
    const tokens = step.usage?.totalTokens ?? (step.usage?.inputTokens ?? 0) + (step.usage?.outputTokens ?? 0);
    const cost = settings.provider === 'anthropic' ? apiCostUsd(settings.model, rawUsage(step)) : 0;
    meter.calls += 1;
    meter.tokens += tokens;
    meter.costUsd += cost;
    const r = (meter.byRole[role] ??= { calls: 0, tokens: 0, costUsd: 0 });
    r.calls += 1;
    r.tokens += tokens;
    r.costUsd += cost;
  };
  return meter;
}
