// G14: no secret in the log. Agent and tool errors are scrubbed before they are
// traced: the configured key values first, then key shapes (provider errors can
// echo a key; planning/SPEC/AGENTS.md §13 pitfall 7).

const SHAPES = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /(?<![A-Za-z0-9])xai-[A-Za-z0-9_-]{8,}/g,
  /(?<=x-api-key["':\s=]{1,4})[A-Za-z0-9_-]{8,}/gi,
  /(?<=bearer\s{1,4})[A-Za-z0-9._~+/-]{8,}=*/gi,
  /(?<=(?:private|secret|signer)[ _-]?key["'`]?[ \t]{0,4}[:=]?[ \t]{0,4}["'`]?)(?:0x)?[0-9a-fA-F]{64}/gi,
];

export function createScrubber(secrets = []) {
  const values = [...new Set(secrets.filter((s) => typeof s === 'string' && s.length >= 8))].sort((a, b) => b.length - a.length);
  return (text) => {
    let out = String(text);
    for (const value of values) out = out.split(value).join('<redacted>');
    for (const re of SHAPES) out = out.replace(re, '<redacted>');
    return out;
  };
}

// Every string inside a JSON-like value, scrubbed; bigints become decimal strings.
export function scrubDeep(value, scrub, depth = 0) {
  if (typeof value === 'string') return scrub(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (depth > 12) return '[deep]';
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, scrub, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || typeof v === 'function') continue;
    out[k] = scrubDeep(v, scrub, depth + 1);
  }
  return out;
}

export function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
