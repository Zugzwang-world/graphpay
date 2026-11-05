// The pure parts of `pnpm agents:probe` (scripts/agents/preset-probe.mjs), apart so
// that tests can check them without loading .env or calling the API.

import Anthropic from '@anthropic-ai/sdk';

const USAGE = 'usage: pnpm agents:probe [--preset NAME]';

// The preset to probe (null = every preset). An unknown preset or any other
// argument is refused before a call is made; only a plain name is ever echoed.
export function parseProbeArgs(argv, presets) {
  if (argv.length === 0) return null;
  if (argv.length !== 2 || argv[0] !== '--preset') throw new Error(USAGE);
  const name = argv[1];
  if (Object.hasOwn(presets, name)) return name;
  const shown = /^[a-z][a-z0-9-]{0,31}$/i.test(name) ? `"${name}"` : 'that name';
  throw new Error(`unknown preset ${shown}; the story config has ${Object.keys(presets).join(', ')}`);
}

// Client options with the base URL pinned to the config's API URL. Passing it
// explicitly means a shell ANTHROPIC_BASE_URL is never read, so the key can only go
// to that host; passing the key explicitly means no other credential is read.
export function clientOptions(apiKey, models) {
  const baseURL = models?.apiBaseUrl;
  if (typeof baseURL !== 'string' || !/^https:\/\/[^/?#\s]+$/.test(baseURL)) {
    throw new Error('models.apiBaseUrl in packages/config/graphpay.config.json must be an https origin');
  }
  if (typeof apiKey !== 'string' || apiKey === '') throw new Error('ANTHROPIC_API_KEY is not set');
  return { apiKey, baseURL };
}

// The flags cell of a rejected call: every printed part is redacted first and only
// then cut (planning/SPEC/SECURITY_AND_OPS.md §8: a secret spanning the cut must not survive).
export function rejectedFlags(error, redact) {
  const status = error instanceof Anthropic.APIError ? `${error.status ?? ''} ${error.error?.error?.type ?? ''}`.trim() : '';
  const message = error instanceof Error ? error.message : String(error);
  return `REJECTED (${redact(status || 'error').slice(0, 60)}): ${redact(message).slice(0, 160)}`;
}
