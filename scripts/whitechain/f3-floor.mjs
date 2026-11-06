// node scripts/whitechain/f3-floor.mjs
// Acceptance F3, the relayer's safety floor: the production build of apps/web (`next build` first)
// runs locally with the hosted environment from .env and MIN_RELAYER_BALANCE_WBT raised above the
// relayer's balance. A signed 0.40 human payment is sent straight to that facilitator's /settle:
// it must be refused before sending (relayer_floor), the relayer's nonce unchanged, and /health
// must show the floor and the balance. Run locally instead of on a preview deployment: a preview
// would need the relayer key in the preview environment and would talk to the production
// facilitator (the hosted URLs are pinned to the production domain). Nothing is signed on-chain.
// Result: docs/sessions/payments/f3.json.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { formatEther, keccak256, parseEther, toHex } from 'viem';
import { castEntries, config, story } from '../../packages/config/index.mjs';
import { PASSCODE_HEADER } from '../../packages/shop/index.mjs';
import { decodePaymentRequiredHeader, graphPayOrderClient, x402Client } from '../../packages/facilitator/index.mjs';
import { configuredCheckout, context, usdt } from './lib.mjs';

const PORT = 3917;
const BASE = `http://127.0.0.1:${PORT}`;
const ctx = await context([]); // read-only on-chain
const relayer = ctx.account('FACILITATOR').address;
const balance = await ctx.publicClient.getBalance({ address: relayer });
const floorWbt = String(Math.ceil(Number(formatEther(balance))) + 1000); // well above the balance
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
}

// The hosted environment, in the child process only (never printed).
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
  cwd: new URL('../../apps/web/', import.meta.url).pathname,
  env: { ...process.env, ...ctx.env, NODE_ENV: 'production', MIN_RELAYER_BALANCE_WBT: floorWbt },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
server.stderr.on('data', (d) => (stderr += d)); // kept, never printed (it could quote env)
const stop = () => server.kill('SIGTERM');

try {
  let health;
  for (let i = 0; i < 60 && !health; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    health = await fetch(`${BASE}/api/facilitator/health`).then((r) => r.json()).catch(() => undefined);
  }
  check('the local production build answers /api/facilitator/health', Boolean(health));
  check('health shows the raised floor', health?.minRelayerBalanceWei === String(parseEther(floorWbt)), `floor ${floorWbt} WBT`);
  check('health shows the balance below it', BigInt(health?.balanceWei ?? 0) < parseEther(floorWbt), `${formatEther(BigInt(health?.balanceWei ?? 0))} WBT`);

  const persona = castEntries().find((e) => e.kind === 'persona');
  const shop = castEntries().find((e) => e.kind === 'shop' && e.key === story.order.shop);
  const human = ctx.account(persona.walletRole);
  const q = await fetch(`${BASE}/api/shop/quote?${new URLSearchParams({ shop: shop.ensName, buyer: persona.ensName, payer: '', wallet: human.address, item: story.order.sku, qty: '1' })}`).then((r) => r.json());
  const r402 = await fetch(`${BASE}${new URL(q.payUrl).pathname}`, { method: 'POST', headers: { 'content-type': 'application/json', [PASSCODE_HEADER]: ctx.env.DEMO_PASSCODE }, body: JSON.stringify(q.terms) });
  check('the local shop answers 402 (no facilitator call yet)', r402.status === 402);
  const pr = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
  const network = `eip155:${ctx.chain.id}`;
  const token = usdt();
  const scheme = graphPayOrderClient({ account: human, publicClient: ctx.publicClient, chainId: ctx.chain.id, token, permit2: config.whitechain.system.permit2, checkout: configuredCheckout().address, payerName: '', mandateHash: keccak256(toHex('F3 relayer floor')) });
  const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: q.priceMicro }] });
  const paymentPayload = await client.createPaymentPayload(pr);

  const nonceBefore = await ctx.publicClient.getTransactionCount({ address: relayer });
  const settled = await fetch(`${BASE}/api/facilitator/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.env.FACILITATOR_AUTH_TOKEN}` },
    body: JSON.stringify({ x402Version: pr.x402Version, paymentPayload, paymentRequirements: pr.accepts[0] }),
  }).then((r) => r.json());
  check('settle is refused before sending, naming the floor', settled.success === false && settled.errorReason === 'relayer_floor' && settled.transaction === '', settled.errorReason);
  const nonceAfter = await ctx.publicClient.getTransactionCount({ address: relayer });
  check('no transaction: the relayer nonce is unchanged', nonceAfter === nonceBefore, `${nonceBefore} before and after`);
  writeFileSync(
    new URL('../../docs/sessions/payments/f3.json', import.meta.url),
    `${JSON.stringify({ check: 'F3', run: 'production build of apps/web, local next start, hosted env, MIN_RELAYER_BALANCE_WBT raised', at: new Date().toISOString(), relayer, floorWbt, balanceWei: health?.balanceWei, settle: settled, relayerNonce: { before: nonceBefore, after: nonceAfter }, checks: results }, null, 2)}\n`,
  );
} finally {
  stop();
  if (process.exitCode === 1 && stderr) console.log(`  (the server wrote ${stderr.split('\n').length} stderr lines; not printed)`);
}
