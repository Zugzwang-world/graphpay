// Secret shapes shared by the secret scan (pnpm check, the pre-commit hook)
// and the prompt-log hook. A finding carries a label and a position, never
// the matched text, so callers can report or mask without echoing a secret.
// Placeholders such as ${VAR}, <key> and [YOUR-PASSWORD] never match.

import { readFileSync } from 'node:fs';

const BIP39 = new Set(
  readFileSync(new URL('./bip39-english.txt', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean),
);

export const SHAPES = [
  { label: 'anthropic-api-key', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { label: 'xai-api-key', re: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{20,}/g },
  // Kimi (Moonshot AI) keys start sk- (admin keys sk-admin-); the length is undocumented (FACTS, 2026-11-06),
  // so a conservative minimum. It also catches other sk- style keys; Anthropic's sk-ant- has its own rule.
  { label: 'kimi-api-key', re: /(?<![A-Za-z0-9_-])sk-(?!ant-)(?:admin-)?[A-Za-z0-9]{32,}/g },
  { label: 'jwt', re: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  // "private key", "priv key", "secret key", "signer key" as private_key, private-key or privatekey,
  // then within 16 spaces an optional ':' or '=', an optional quote and 64 hex digits.
  {
    label: 'hex-private-key',
    re: /(?<![A-Za-z])(?:private|priv|secret|signer)[ _-]?key(?![A-Za-z])["']?[ \t]{0,16}[:=]?[ \t]{0,16}["'`]?(?:0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])/gi,
  },
  { label: 'pem-private-key', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g },
  // The Arkiv access key is the last path segment of the Rabdi RPC URL.
  { label: 'arkiv-access-key-in-url', re: /rpc\.rabdi\.db-chain\.testnet\.arkiv\.network\/(?:ws\/)?[A-Za-z0-9._~-]{8,}/gi },
  // An Ankr API key follows the network segment: rpc.ankr.com/<network>/<key> (or /<network>/ws/<key>).
  { label: 'ankr-api-key-in-url', re: /rpc\.ankr\.com\/[A-Za-z0-9_]+\/(?:ws\/)?[A-Za-z0-9]{16,}/gi },
  { label: 'github-token', re: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,}/g },
  { label: 'github-fine-grained-token', re: /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{22,}/g },
  {
    label: 'database-url-password',
    re: /(?<![A-Za-z0-9+.-])(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?):\/\/[^\s:/@]+:(?!\[YOUR-PASSWORD\]|\$\{|<)[^\s@/]+@/gi,
  },
];

// Prompt logs only: a bare 64-hex value may be a key. Public transaction hashes
// in planning/ and docs/ pass the repository scan.
const HEX64 = { label: 'hex-64-possible-key', re: /(?<![0-9a-fA-F])(?:0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])/g };

const PHRASE_KEY =
  /(?:secret[ \t]+recovery[ \t]+phrase|recovery[ \t]+(?:phrase|words)|seed[ \t]+(?:phrase|words)|mnemonic(?:[ \t]+(?:phrase|words))?|backup[ \t]+phrase|secret[ \t]+phrase)/gi;
const PHRASE_WINDOW = 800;
const PHRASE_MIN_WORDS = 12;

// Longest run of lowercase BIP-39 words. Separators, quotes, commas and list
// markers ("-", "*", "1.", "2)") keep a run going; any other word ends it, so
// ordinary prose after a key word is never taken for a phrase.
function longestBip39Run(text) {
  let best = null;
  let run = null;
  for (const m of text.matchAll(/[A-Za-z]+/g)) {
    const word = m[0];
    if (BIP39.has(word)) {
      run ??= { start: m.index, count: 0 };
      run.count += 1;
      run.end = m.index + word.length;
      if (!best || run.count > best.count) best = { ...run };
    } else {
      run = null;
    }
  }
  return best;
}

function findPhrases(text) {
  const found = [];
  for (const m of text.matchAll(PHRASE_KEY)) {
    const from = m.index + m[0].length;
    const run = longestBip39Run(text.slice(from, from + PHRASE_WINDOW));
    if (run && run.count >= PHRASE_MIN_WORDS) {
      found.push({ label: 'recovery-phrase', index: from + run.start, length: run.end - run.start });
    }
  }
  return found;
}

export function findSecrets(text, { promptLog = false } = {}) {
  const found = [];
  for (const { label, re } of SHAPES) {
    for (const m of text.matchAll(re)) found.push({ label, index: m.index, length: m[0].length });
  }
  found.push(...findPhrases(text));
  if (promptLog) {
    for (const m of text.matchAll(HEX64.re)) found.push({ label: HEX64.label, index: m.index, length: m[0].length });
  }
  return found.sort((a, b) => a.index - b.index || b.length - a.length);
}

// Replaces every finding with <masked:label>, merging overlapping spans.
export function maskSecrets(text, options) {
  const spans = [];
  for (const f of findSecrets(text, options)) {
    const last = spans.at(-1);
    const end = f.index + f.length;
    if (last && f.index <= last.end) {
      last.end = Math.max(last.end, end);
      if (!last.labels.includes(f.label)) last.labels.push(f.label);
    } else {
      spans.push({ start: f.index, end, labels: [f.label] });
    }
  }
  let out = text;
  for (const s of spans.reverse()) out = `${out.slice(0, s.start)}<masked:${s.labels.join('+')}>${out.slice(s.end)}`;
  return out;
}

export function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}
