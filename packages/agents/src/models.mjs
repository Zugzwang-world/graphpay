// Which model each role runs on. AGENT_MODE=mock|live|auto picks the kind (auto =
// live only when the keys of the active preset's providers exist; `anthropic` is
// the old name of live); an unknown value is an error, so a typo never starts a
// paid run. Live models, providers and their effort come from the story config's
// presets through agentPreset(role) (ADR-0048); AGENT_PRESET overrides the active
// preset for one run. Providers: anthropic and moonshot (Kimi). Nothing here names
// a model.

import { createAnthropic } from '@ai-sdk/anthropic';
import { createMoonshotAI } from '@ai-sdk/moonshotai';
import { agentPreset, apiCostUsd, config, story } from '@graphpay/config';
import { wrapLanguageModel } from 'ai';

export const AGENT_MODES = Object.freeze(['mock', 'live', 'anthropic', 'auto']);

// Where each provider's key lives. Names only: a key is read from the env passed in.
const KEY_ENV = Object.freeze({
  anthropic: 'ANTHROPIC_API_KEY',
  get moonshot() {
    return config.models.moonshot.keyEnv;
  },
});

// The providers the preset in force uses, over all its roles.
function presetProviders(env) {
  const name = env.AGENT_PRESET || story.agentModels.active;
  agentPreset('concierge', { env }); // an unknown preset throws here
  const roles = Object.keys(story.agentModels.presets[name].roles);
  return [...new Set(roles.map((role) => agentPreset(role, { env }).provider))];
}

// Unset means mock: no key is read and nothing is paid for.
export function resolveAgentMode(env = process.env) {
  const raw = env.AGENT_MODE;
  if (raw === undefined || raw === '') return 'mock';
  if (!AGENT_MODES.includes(raw)) {
    const shown = /^[a-z][a-z0-9-]{0,15}$/i.test(raw) ? `"${raw}"` : 'that value';
    throw new Error(`AGENT_MODE ${shown} is not one of ${AGENT_MODES.join(', ')}; refusing to start`);
  }
  if (raw === 'auto') {
    const providers = presetProviders(env);
    const unknown = providers.find((p) => !Object.hasOwn(KEY_ENV, p));
    if (unknown) throw new Error(`agent preset names provider "${unknown}", which is not installed; refusing to start`);
    return providers.every((p) => env[KEY_ENV[p]]) ? 'live' : 'mock';
  }
  return raw === 'anthropic' ? 'live' : raw;
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

function httpsBase(value, what, path) {
  const ok = typeof value === 'string' && (path ? /^https:\/\/[^/?#\s]+(\/[^?#\s]*)?$/.test(value) : /^https:\/\/[^/?#\s]+$/.test(value));
  if (!ok) throw new Error(`${what} in packages/config/graphpay.config.json must be an https ${path ? 'URL' : 'origin'}`);
  return value;
}

// role → { model, settings, callSettings }. In mock mode `mocks(role)` supplies the
// scripted model. Keys and base URLs are passed explicitly, so a shell
// ANTHROPIC_BASE_URL is never read and a key only goes to its provider's configured host.
// `fetch` replaces the network for tests.
export function createModelFactory({ mode, env = process.env, mocks, fetch } = {}) {
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
  if (mode !== 'live' && mode !== 'anthropic') throw new Error(`unknown agent mode "${String(mode)}"`);
  // Every provider the preset uses needs its key before the first call, so a run never half-starts.
  const clients = {};
  for (const name of presetProviders(env)) {
    if (!Object.hasOwn(KEY_ENV, name)) throw new Error(`agent preset "${env.AGENT_PRESET || story.agentModels.active}" names provider "${name}", which is not installed`);
    const apiKey = env[KEY_ENV[name]];
    if (typeof apiKey !== 'string' || apiKey === '') throw new Error(`${KEY_ENV[name]} is not set (AGENT_MODE=live, provider ${name})`);
    clients[name] =
      name === 'anthropic'
        ? createAnthropic({ apiKey, fetch, baseURL: `${httpsBase(config.models?.apiBaseUrl, 'models.apiBaseUrl')}/v1` })
        : createMoonshotAI({ apiKey, fetch, baseURL: httpsBase(config.models.moonshot?.apiBaseUrl, 'models.moonshot.apiBaseUrl', true) });
  }
  return (role) => {
    const settings = agentPreset(role, { env });
    const client = Object.hasOwn(clients, settings.provider) ? clients[settings.provider] : null;
    if (!client) throw new Error(`agent preset "${settings.preset}" names provider "${settings.provider}", which is not installed`);
    const efforts = settings.provider === 'moonshot' ? config.models.moonshot.effortLevels : config.models.effortLevels;
    if (!efforts.includes(settings.effort)) throw new Error(`agent preset "${settings.preset}" has an unknown effort for "${role}"`);
    if (!Number.isSafeInteger(settings.maxTokens) || settings.maxTokens <= 0) throw new Error(`agent preset "${settings.preset}" has no maxTokens for "${role}"`);
    if (settings.provider === 'moonshot') {
      // A chat-completions reply is one content string, so the model is not wrapped: the history
      // sent back each turn (reasoning_content, tool_calls, one tool message per call) is exactly
      // what the API returned. maxOutputTokens is always set (rate limits count it); the effort
      // stays fixed for the whole errand; temperature is fixed by the model and never sent.
      return {
        model: client(settings.model),
        settings,
        callSettings: { maxOutputTokens: settings.maxTokens, providerOptions: { moonshotai: { reasoningEffort: settings.effort } } },
      };
    }
    return {
      model: wrapLanguageModel({ model: client(settings.model), middleware: finalTextBlockOnly }),
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

// The Moonshot usage of one step as price-card fields: cache reads at the cached rate, the
// rest of the prompt (cache-write tokens included) at the input rate, reasoning tokens inside
// the output count.
function moonshotUsage(step) {
  const u = step.usage ?? {};
  const d = u.inputTokenDetails ?? {};
  const read = d.cacheReadTokens ?? 0;
  const write = d.cacheWriteTokens ?? 0;
  const noCache = d.noCacheTokens ?? Math.max(0, (u.inputTokens ?? 0) - read - write);
  return { input_tokens: noCache + write, output_tokens: u.outputTokens ?? 0, cache_read_input_tokens: read };
}

function stepCost(settings, step) {
  if (settings.provider === 'anthropic') return apiCostUsd(settings.model, rawUsage(step));
  if (settings.provider === 'moonshot') return apiCostUsd(settings.model, moonshotUsage(step));
  if (settings.provider === 'mock') return 0;
  throw new Error(`no cost rule for provider "${settings.provider}"`);
}

const round = (value, places) => (Number.isFinite(value) ? Number(value.toFixed(places)) : null);

// Tokens and API cost over every response of an errand (E8: cost from apiCostUsd). `step`
// returns the call's own record for the run log: tokens in (of which cached), out (of which
// reasoning), its cost, the tools it asked for and, with `timing` on (live runs; a mock run
// log stays byte-identical), the seconds the model took to answer and the tools to run.
export function createMeter({ timing = false, now = () => performance.now() } = {}) {
  const meter = { calls: 0, tokens: 0, costUsd: 0, byRole: {}, timing, now };
  meter.step = (role, settings, step) => {
    const u = step.usage ?? {};
    const tokens = u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
    const cost = stepCost(settings, step);
    meter.calls += 1;
    meter.tokens += tokens;
    meter.costUsd += cost;
    const r = (meter.byRole[role] ??= { calls: 0, tokens: 0, costUsd: 0 });
    r.calls += 1;
    r.tokens += tokens;
    r.costUsd += cost;
    const call = {
      input: u.inputTokens ?? 0,
      cached: u.inputTokenDetails?.cacheReadTokens ?? 0,
      output: u.outputTokens ?? 0,
      reasoning: u.outputTokenDetails?.reasoningTokens ?? 0,
      usd: round(cost, 6),
      tools: (step.toolCalls ?? []).map((c) => c.toolName),
    };
    if (timing) {
      const tools = Object.values(step.performance?.toolExecutionMs ?? {});
      call.seconds = round((step.performance?.responseTimeMs ?? Number.NaN) / 1000, 2);
      call.toolSeconds = round(tools.length ? Math.max(...tools) / 1000 : 0, 2);
    }
    return call;
  };
  return meter;
}
