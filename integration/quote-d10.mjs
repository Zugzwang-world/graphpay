// node integration/quote-d10.mjs     (M13's D10 part (c))
// One passcode-gated 402 step with a requestId at the hosted shop, as the acceptance payer:
// the shop writes the errand's quote as W_DIRECTORY. Nothing is signed. Then the quote entity
// is read on Arkiv: its owner, its expiry (15 minutes after creation, ±2 blocks) and its
// valid_until (10 minutes after creation). Writes docs/sessions/integration/hosted/quote-<time>.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castEntries, config, story } from '@graphpay/config';
import { decodePaymentRequiredHeader } from '@graphpay/facilitator';
import { connectArkiv, findQuotes, writerAddresses } from '@graphpay/money-graph';
import { PASSCODE_HEADER } from '@graphpay/shop';
import { keccak256, toHex } from 'viem';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../scripts/lib/redact.mjs';
import { roleAddresses } from '../scripts/lib/wallets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = { ...Object.fromEntries(values), ...process.env };
const redact = redactor(values);
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${redact(l)}\n`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

const SITE = String(config.site.url).replace(/\/+$/, '');
const entries = castEntries();
const payer = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'acceptance');
const persona = entries.find((e) => e.kind === 'persona');
const shop = entries.find((e) => e.kind === 'shop' && e.key === story.order.shop);
const wallet = roleAddresses(values)[payer.walletRole];
if (!env.DEMO_PASSCODE) throw new Error('DEMO_PASSCODE is not in .env');
const startedAt = new Date().toISOString();
const requestId = keccak256(toHex(`M13 D10c ${startedAt}`));

const qs = new URLSearchParams({ shop: shop.ensName, item: story.order.sku, qty: '1', buyer: persona.ensName, payer: payer.ensName, wallet });
const quotedAt = Math.floor(Date.now() / 1000);
const q = await (await fetch(`${SITE}/api/shop/quote?${qs}`, { redirect: 'error', cache: 'no-store' })).json();
const r402 = await fetch(`${SITE}${new URL(q.payUrl).pathname}`, { method: 'POST', redirect: 'error', cache: 'no-store', headers: { 'content-type': 'application/json', [PASSCODE_HEADER]: env.DEMO_PASSCODE }, body: JSON.stringify({ ...q.terms, requestId }) });
if (r402.status !== 402) throw new Error(`the 402 step answered ${r402.status}`);
const quoteKey = decodePaymentRequiredHeader(r402.headers.get('payment-required')).accepts?.[0]?.extra?.quoteKey ?? null;
say(`402 with a requestId: quote entity ${quoteKey}; nothing signed`);

// The entity on Arkiv, from W_DIRECTORY only, and the blocks around it.
const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
const pub = arkiv.publicClient;
let found = null;
for (let i = 0; i < 10 && !found; i += 1) {
  found = (await findQuotes(pub, requestId)).find((x) => x.key === quoteKey) ?? null;
  if (!found) await new Promise((ok) => setTimeout(ok, 3_000));
}
if (!found) throw new Error('the quote entity is not on Arkiv under W_DIRECTORY');
const entity = await pub.getEntity(quoteKey);
const createdBlock = BigInt(entity.$createdAt);
const created = await pub.getBlock({ blockNumber: createdBlock });
const earlier = await pub.getBlock({ blockNumber: createdBlock - 100n });
const blockSeconds = Number(created.timestamp - earlier.timestamp) / 100;
const lifeBlocks = Number(BigInt(found.expiresAt) - createdBlock);
const wantBlocks = (15 * 60) / 2; // the spec's 15 minutes in Arkiv's 2 s blocks
const validAfterS = Number(BigInt(found.validUntil) - created.timestamp);
const out = {
  startedAt,
  requestId,
  quoteKey,
  explorer: `${String(config.networks.rabdi.explorer).replace(/\/+$/, '')}/entity/${quoteKey}`,
  owner: entity.$owner,
  wDirectory: writerAddresses().W_DIRECTORY,
  createdBlock,
  createdAt: new Date(Number(created.timestamp) * 1000).toISOString(),
  expiresAtBlock: found.expiresAt,
  blockSeconds,
  lifeBlocks,
  wantBlocks,
  validUntil: found.validUntil,
  validAfterSeconds: validAfterS,
  // valid_until is the quote's exp, set at the GET; the gap to the entity's creation is here.
  quotedAt,
  exp: q.terms?.exp ?? null,
};
out.pass = typeof out.owner === 'string' && out.owner.toLowerCase() === out.wDirectory.toLowerCase() && Math.abs(lifeBlocks - wantBlocks) <= 2 && Math.abs(validAfterS - 600) <= 10;
say(`owner W_DIRECTORY, lives ${lifeBlocks} blocks (want ${wantBlocks.toFixed(1)} at ${blockSeconds} s), valid_until ${validAfterS} s after creation: ${out.pass ? 'pass' : 'FAIL'}`);
const dir = join(here, '..', 'docs', 'sessions', 'integration', 'hosted');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `quote-${startedAt.replace(/[:.]/g, '-')}.json`), `${redact(json(out))}\n`);
