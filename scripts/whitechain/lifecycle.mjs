// ALLOW_REAL_NETWORK=1 node scripts/whitechain/lifecycle.mjs [--fork <anvil url>] [--yes]
// M3 part B, step 1: the payment lifecycle through the local facilitator and shop API
// (local-pay.mjs: the real ENS gate and payee read, the facilitator signing as FACILITATOR),
// played as the story's rehearsal agent (never its payer agent: that daily cap is kept for M12,
// E-15): pay the story's order gasless → replay alreadyPaid → partial refund → re-order → over
// the cap, refused off-chain → the scout agent revoked, refused on-chain (AGENT_REVOKED), policy
// restored → the persona as a human payer for one piece. Every name and amount is the story's.
// Without --yes: the read-only preflight. Rehearse with --fork first. The transcript goes to
// docs/sessions/payments/m3-lifecycle.json (real) or a temporary file (fork).

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatEther } from 'viem';
import { castEntries, story } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { priceOf, productOf } from '../../packages/shop/index.mjs';
import { context, sendTx } from './lib.mjs';
import { localPayment } from './local-pay.mjs';

const ctx = await context(process.argv.slice(2));
const cast = Object.fromEntries(castEntries().map((e) => [e.key, e]));
const rehearsal = cast.rehearsal;
const scout = cast.scout;
const persona = castEntries().find((e) => e.kind === 'persona');
const lp = await localPayment(ctx);
const { fmt } = lp;
const out = ctx.fork ? join(tmpdir(), 'graphpay-fork-lifecycle.json') : new URL('../../docs/sessions/payments/m3-lifecycle.json', import.meta.url);

const transcript = [];
function beat(name, detail) {
  transcript.push({ beat: name, at: new Date().toISOString(), ...detail });
  console.log(`- ${name}: ${Object.entries(detail).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
function check(ok, what) {
  if (!ok) throw new Error(`lifecycle: ${what}`);
}
const link = (hash) => (hash ? ctx.explorerTx(hash) : 'none');

// Preflight (read-only): who pays, what they hold, what the gate says.
const agent = lp.payer(rehearsal.walletRole, rehearsal.ensName);
const scoutAgent = lp.payer(scout.walletRole, scout.ensName);
const human = lp.payer(persona.walletRole, '');
const product = productOf(lp.shop, story.order.sku);
const onePiece = priceOf(product, 1);
const need = {
  [agent.address]: BigInt(story.order.priceMicro) + BigInt(story.order.reorder.priceMicro),
  [scoutAgent.address]: onePiece,
  [human.address]: onePiece,
};
for (const who of [agent, scoutAgent, human]) {
  const b = await lp.balances(who.address);
  console.log(`  ${(who.name || `${persona.ensName} (human)`).padEnd(36)} ${who.address} ${fmt(b.usdt)}, ${formatEther(b.wbt)} WBT`);
  check(b.usdt >= need[who.address], `${who.name || 'the human payer'} holds less than ${fmt(need[who.address])}`);
}
const relayerWbt = await ctx.publicClient.getBalance({ address: lp.relayer.address });
console.log(`  relayer FACILITATOR ${lp.relayer.address} ${formatEther(relayerWbt)} WBT; ENS reads via ${lp.ensRpc}`);
for (const who of [agent, scoutAgent]) {
  const g = await lp.gate.ensGate(who.name, onePiece);
  console.log(`  gate ${who.name}: ${g.ok ? `ok (epoch ${g.epoch}, cap ${fmt(g.capMicro)})` : g.reason}`);
  check(g.ok, `the gate refuses ${who.name}: ${g.reason}`);
}
if (!ctx.send) {
  console.log('preflight passed; nothing sent (add --yes to play the lifecycle)');
  lp.close();
  process.exit(0);
}

const buyer = persona.ensName;
let restoreScout;
try {
  const start = { agent: await lp.balances(agent.address), scout: await lp.balances(scoutAgent.address), human: await lp.balances(human.address) };

  // 1. Gasless payment.
  const q = await lp.quote(agent, { buyer, qty: story.order.quantity });
  check(q.priceMicro === String(story.order.priceMicro), 'the quote is the catalog price');
  const first = await lp.pay(q, agent);
  check(first.status === 200 && first.settlement?.success === true, `pay answered ${first.status} ${JSON.stringify(first.body)}`);
  const r1 = await lp.logRelayed('lifecycle pay', first.body.transaction);
  const afterPay = await lp.balances(agent.address);
  check(start.agent.usdt - afterPay.usdt === BigInt(story.order.priceMicro), 'the payer paid exactly the price');
  check(afterPay.wbt === start.agent.wbt, "the payer's WBT is unchanged");
  beat('pay', { http: 200, amount: fmt(story.order.priceMicro), approval: first.approval ? 'EIP-2612 in the same transaction' : 'none needed', gas: r1.gasUsed, from: r1.from, delivery: first.body.delivery, status: await lp.orderStatus(q.orderId), tx: link(first.body.transaction) });

  // 2. Replay: alreadyPaid, nothing sent.
  const nonce = await lp.relayerNonce();
  const replay = await lp.replay(q, first.signature);
  check(replay.status === 200 && replay.body.alreadyPaid === true, 'the replay is alreadyPaid');
  check((await lp.relayerNonce()) === nonce, 'the replay sent nothing');
  check((await lp.balances(agent.address)).usdt === afterPay.usdt, 'the replay moved no money');
  beat('replay', { http: 200, alreadyPaid: true, relayerNonce: `${nonce} before and after` });

  // 3. Partial refund from the merchant's float.
  const rr = await sendTx(ctx, { role: lp.merchantRole, label: 'lifecycle refund', request: { address: lp.checkout, abi: checkoutAbi, functionName: 'refund', args: [q.orderId, BigInt(story.order.refundMicro), 1] } });
  check((await lp.balances(agent.address)).usdt - afterPay.usdt === BigInt(story.order.refundMicro), 'the payer got the refund');
  beat('refund', { amount: fmt(story.order.refundMicro), gas: rr.gasUsed, status: await lp.orderStatus(q.orderId), tx: link(rr.transactionHash) });

  // 4. Re-order at the parent's path.
  const rq = await lp.quote(agent, { buyer, item: story.order.reorder.sku, qty: story.order.reorder.quantity, parent: q.orderId });
  check(rq.priceMicro === String(story.order.reorder.priceMicro), 'the re-order is the catalog price');
  const re = await lp.pay(rq, agent);
  check(re.status === 200 && re.settlement?.success === true, `re-order answered ${re.status} ${JSON.stringify(re.body)}`);
  const r4 = await lp.logRelayed('lifecycle re-order', re.body.transaction);
  beat('re-order', { http: 200, amount: fmt(story.order.reorder.priceMicro), approval: re.approval ? 'again' : 'none needed (allowance left)', gas: r4.gasUsed, status: await lp.orderStatus(rq.orderId), tx: link(re.body.transaction) });

  // 5. Over the cap: the gate refuses off-chain (CAP_EXCEEDED), nothing sent.
  const node = lp.nodeOf(agent.name);
  const epoch = await lp.reads.expectedEpoch(node);
  const cap = (await lp.gate.ensGate(agent.name, 1n)).capMicro;
  const left = cap - (await lp.reads.spentToday(node, epoch));
  let qty = 1;
  while (priceOf(product, qty) <= left) qty += 1;
  const big = lp.payer(rehearsal.walletRole, rehearsal.ensName, { maxMicro: priceOf(product, qty) }); // the client's own control allows it, so the gate decides
  const oq = await lp.quote(big, { buyer, qty });
  const oNonce = await lp.relayerNonce();
  const over = await lp.pay(oq, big);
  check(over.status === 402 && over.settlement?.errorReason === 'CAP_EXCEEDED' && over.settlement.transaction === '', `over-cap answered ${over.status} ${JSON.stringify(over.body)}`);
  check((await lp.relayerNonce()) === oNonce, 'the over-cap payment sent nothing');
  beat('over the cap', { http: 402, amount: fmt(oq.priceMicro), left: fmt(left), reason: 'CAP_EXCEEDED (off-chain, the ENS gate)', sent: 'nothing' });

  // 6. The scout agent revoked by the policy writer (the name stays ENS-active): recorded on-chain.
  const sNode = lp.nodeOf(scout.ensName);
  const p = await lp.reads.policy(sNode);
  check(!p.revoked, `${scout.ensName}'s policy is already revoked; restore it first`);
  const policyArgs = (revoked) => [sNode, p.epoch, p.wallet, revoked, p.dailyCapMicro, p.expiry];
  // Armed before the revoke is sent: a revoke that times out after broadcast is still undone.
  restoreScout = () => sendTx(ctx, { role: 'POLICY_WRITER', label: `lifecycle restore ${scout.key}`, request: { address: lp.checkout, abi: checkoutAbi, functionName: 'setPolicy', args: policyArgs(false) } });
  const rv = await sendTx(ctx, { role: 'POLICY_WRITER', label: `lifecycle revoke ${scout.key}`, request: { address: lp.checkout, abi: checkoutAbi, functionName: 'setPolicy', args: policyArgs(true) } });
  const vq = await lp.quote(scoutAgent, { buyer, qty: 1 });
  const revoked = await lp.pay(vq, scoutAgent);
  check(revoked.status === 402 && revoked.settlement?.errorReason === 'AGENT_REVOKED' && /^0x[0-9a-f]{64}$/.test(revoked.settlement.transaction), `revoked answered ${revoked.status} ${JSON.stringify(revoked.body)}`);
  const r6 = await lp.logRelayed('lifecycle revoked agent', revoked.settlement.transaction);
  check((await lp.balances(scoutAgent.address)).usdt === start.scout.usdt, 'the revoked agent moved no money');
  const rs = await restoreScout();
  restoreScout = undefined;
  beat('revoked agent', { http: 402, reason: 'AGENT_REVOKED (PaymentFailed on-chain)', gas: r6.gasUsed, tx: link(revoked.settlement.transaction), revoke: link(rv.transactionHash), restored: link(rs.transactionHash) });

  // 7. VITALIK as a human payer (node 0, no ENS gate).
  const hq = await lp.quote(human, { buyer, qty: 1 });
  const hp = await lp.pay(hq, human);
  check(hp.status === 200 && hp.settlement?.success === true, `human payer answered ${hp.status} ${JSON.stringify(hp.body)}`);
  const r7 = await lp.logRelayed('lifecycle human payer', hp.body.transaction);
  beat('human payer', { http: 200, payer: `${persona.ensName} (wallet ${human.address})`, amount: fmt(hq.priceMicro), gas: r7.gasUsed, tx: link(hp.body.transaction) });

  const end = { agent: await lp.balances(agent.address), scout: await lp.balances(scoutAgent.address), human: await lp.balances(human.address) };
  check(end.agent.wbt === start.agent.wbt && end.scout.wbt === start.scout.wbt && end.human.wbt === start.human.wbt, 'a payer spent WBT');
  beat('totals', {
    rehearsalPaid: fmt(start.agent.usdt - end.agent.usdt),
    humanPaid: fmt(start.human.usdt - end.human.usdt),
    payersWbt: 'unchanged',
    refusalRecords: lp.recorded.map((r) => `${r.reason}${r.payerName ? ` (${r.payerName})` : ''}`).join(', ') || 'none',
  });
} finally {
  if (restoreScout) {
    console.log(`  restoring ${scout.ensName}'s policy after a failure`);
    await restoreScout().catch((e) => console.error(`  RESTORE FAILED: ${e?.name ?? 'Error'}; restore the policy with setup.mjs`));
  }
  writeFileSync(out, `${JSON.stringify({ network: ctx.fork ? 'fork' : 'whitechain', synthetic: true, beats: transcript }, (_k, v) => (typeof v === 'bigint' ? String(v) : v), 2)}\n`);
  console.log(`transcript: ${ctx.fork ? out : 'docs/sessions/payments/m3-lifecycle.json'}`);
  lp.close();
}
