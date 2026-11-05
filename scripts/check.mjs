// `pnpm check`: the secret scan and repo hygiene (SPEC/SECURITY_AND_OPS.md §4).
//   node scripts/check.mjs                 the working tree (tracked and untracked, not ignored)
//   node scripts/check.mjs --staged        the staged snapshot (the pre-commit hook)
//   node scripts/check.mjs --paths <f…>    only the given files
// Each finding prints as `path:line label`; the matched text is never printed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findSecrets, lineOf } from './lib/secret-shapes.mjs';

export const CONFIG_FILE = 'packages/config/graphpay.config.json';
// Real addresses we know of: the config file, the pack's facts and wallets, the event's wallets.
const ADDRESS_SOURCES = [CONFIG_FILE, 'planning/FACTS.md', 'planning/WALLETS.md', 'docs/technical/WALLETS.md'];
const CODE_PATH = /^(?:packages|apps|scripts|integration|acceptance|bench)\//;
const CODE_EXT = /\.(?:[cm]?[jt]sx?|sol|json|sh|ya?ml|toml)$/;
const NOT_CODE = /(?:^|\/)(?:node_modules|broadcast|\.next)\//;
const ADDRESS = /(?<![0-9a-fA-F])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;
const ZERO = `0x${'0'.repeat(40)}`;

function git(args, root, encoding = 'utf8') {
  return execFileSync('git', args, { cwd: root, encoding, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function scanText(text, path) {
  const promptLog = path.startsWith('prompts/raw/');
  return findSecrets(text, { promptLog }).map((f) => ({ path, line: lineOf(text, f.index), label: f.label }));
}

export function checkEnvExample(text, path = 'env.example') {
  const out = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    if (!/^[A-Z][A-Z0-9_]*=$/.test(line)) out.push({ path, line: i + 1, label: 'env-example-not-name-only' });
  });
  return out;
}

export function knownAddresses(root) {
  const known = new Set();
  for (const rel of ADDRESS_SOURCES) {
    const file = join(root, rel);
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(ADDRESS)) known.add(m[0].toLowerCase());
  }
  known.delete(ZERO);
  return known;
}

export function isCodePath(path) {
  return CODE_PATH.test(path) && CODE_EXT.test(path) && !NOT_CODE.test(path) && path !== CONFIG_FILE;
}

// Addendum B and acceptance A7: no ENS or Whitechain address literal outside the
// config file, in any case, with or without 0x, also inside longer hex.
export function addressFindings(path, text, known) {
  if (!isCodePath(path)) return [];
  const lower = text.toLowerCase();
  const out = [];
  for (const address of known) {
    const hex = address.slice(2);
    for (let i = lower.indexOf(hex); i !== -1; i = lower.indexOf(hex, i + hex.length)) {
      out.push({ path, line: lineOf(text, i), label: 'address-literal-outside-config' });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

export const STORY_FILE = 'packages/config/story.json';

// The design rule (ADR-0047): story names and values live only in the story file.
// Distinctive literals only, matched case-sensitively: the persona's and shops'
// labels and display names, product names and SKUs, the renewal item and plan id,
// and the order's request text. Agent role words (scout, payer, ...) are structure,
// and upper-case wallet role slots (VITALIK, SHOP_KESAR) are infrastructure names.
export function storyLiterals(root) {
  const file = join(root, STORY_FILE);
  if (!existsSync(file)) return [];
  const s = JSON.parse(readFileSync(file, 'utf8'));
  const out = [s.persona?.label, s.persona?.displayName, s.order?.request, s.order?.item, s.renewal?.item, s.renewal?.plan];
  for (const shop of s.shops ?? []) {
    out.push(shop.label, shop.displayName);
    for (const product of shop.products ?? []) out.push(product.name, product.sku);
  }
  return [...new Set(out.filter((v) => typeof v === 'string' && v.length >= 4))];
}

const escapeRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function storyFindings(path, text, literals) {
  const code = CODE_PATH.test(path) && CODE_EXT.test(path) && !NOT_CODE.test(path) && path !== STORY_FILE;
  if (!code) return [];
  const out = [];
  for (const literal of literals) {
    const re = new RegExp(`(?<![A-Za-z0-9_-])${escapeRe(literal)}(?![A-Za-z0-9_-])`, 'g');
    for (const m of text.matchAll(re)) out.push({ path, line: lineOf(text, m.index), label: 'story-literal-outside-story-config' });
  }
  return out;
}

function listFiles(mode, root, paths) {
  if (mode === 'paths') return paths;
  const args =
    mode === 'staged'
      ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']
      : ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
  return git(args, root).split('\0').filter(Boolean);
}

function readContent(mode, root, path) {
  if (mode === 'staged') return git(['show', `:${path}`], root, 'buffer').toString('utf8');
  const file = isAbsolute(path) ? path : join(root, path);
  if (!existsSync(file)) return null; // deleted in the working tree
  return readFileSync(file, 'utf8');
}

export function run(argv, root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim()) {
  const mode = argv.includes('--staged') ? 'staged' : argv.includes('--paths') ? 'paths' : 'tree';
  const paths = mode === 'paths' ? argv.slice(argv.indexOf('--paths') + 1) : [];
  const known = knownAddresses(root);
  const literals = storyLiterals(root);
  const findings = [];
  const files = listFiles(mode, root, paths);
  for (const path of files) {
    let text;
    try {
      text = readContent(mode, root, path);
    } catch {
      findings.push({ path, line: 0, label: 'unreadable' });
      continue;
    }
    if (text === null) continue;
    findings.push(...scanText(text, path));
    findings.push(...addressFindings(path, text, known));
    findings.push(...storyFindings(path, text, literals));
    if (path === 'env.example') findings.push(...checkEnvExample(text, path));
    if (mode !== 'paths' && basename(path).startsWith('.env')) {
      if (mode === 'staged' || git(['ls-files', '--', path], root).trim()) {
        findings.push({ path, line: 0, label: 'tracked-env-file' });
      }
    }
  }
  return { files: files.length, findings };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { files, findings } = run(process.argv.slice(2));
  for (const f of findings) console.log(`${f.path}:${f.line} ${f.label}`);
  if (findings.length > 0) {
    console.log(`check: ${findings.length} finding(s) in ${files} file(s)`);
    process.exitCode = 1;
  } else {
    console.log(`check: clean (${files} files)`);
  }
}
