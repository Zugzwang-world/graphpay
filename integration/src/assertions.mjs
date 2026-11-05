// The assertions of `pnpm e2e:food` (planning/SPEC/INTEGRATION_AND_MIRROR.md §5; E1–E7 in
// planning/ACCEPTANCE_TESTS.md), as verdicts over what the run collected:
//   runLog    the agents' graphpay.agent-run/v1 log
//   events    the checkout's decoded events in the run's block window ({ id, name, block, args })
//   balances  USDT micro before and after, by role key: { before: { payer, good, trap }, after: … }
//   graph     GraphQL tallies before and after ({ good: { today, all }, payer: { today } })
//   trail     order(id) edges after the run ([{ kind, ref }]) and the mirror's cursor block
//   kill      { receiptMs, refusedMs, status, reason, failEdge }
// Each returns { id, pass, measured, expected }. Names come from the story's roles.

import { config } from '@graphpay/config';

const micro = (v) => BigInt(v ?? 0);
const usdt = (m) => (Number(micro(m)) / 1e6).toFixed(2);
const REF = new RegExp(`^${config.networks.whitechain.chainId}:0x[0-9a-f]{64}:\\d+$`);

function verdict(id, checks, measured, expected) {
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { id, pass: failed.length === 0, failed, measured, expected };
}

// A: the shop comes from live GraphQL reputation; the trap is never paid.
export function assertChoice({ runLog, events, balances, shops }) {
  const r = runLog.result;
  const rank = new Map((r.ranking ?? []).map((x) => [x.ens, x]));
  const good = rank.get(shops.good);
  const runnerUp = rank.get(shops.runnerUp);
  const trap = rank.get(shops.trap);
  const trapNode = shops.trapNode?.toLowerCase();
  const trapEvents = events.filter((e) => ['OrderCreated', 'PaymentSettled'].includes(e.name) && String(e.args?.shopNode ?? '').toLowerCase() === trapNode);
  return verdict(
    'A',
    {
      'the answer carries an explain id': typeof r.explainId === 'string' && r.explainId.length > 0,
      'the good shop chosen': r.chosenShop === shops.good,
      'good ranks above the runner-up': Boolean(good && runnerUp && good.score > runnerUp.score),
      'the trap excluded': Boolean(trap && trap.eligible === false),
      'no trap order or payment on-chain': trapEvents.length === 0,
      'the trap balance unchanged': micro(balances.before.trap) === micro(balances.after.trap),
    },
    { explainId: r.explainId, chosen: r.chosenShop, scores: [...rank.values()].map((x) => ({ ens: x.ens, score: x.score, eligible: x.eligible })), trapEvents: trapEvents.length },
    'good > runner-up, trap excluded, no trap order or payment, trap balance unchanged',
  );
}

// B: the payment settles; payer −price, good shop +price; the receipt says where.
export function assertSettled({ runLog, events, balances, priceMicro, network, explorer = null }) {
  const r = runLog.result;
  const settled = events.find((e) => e.name === 'PaymentSettled' && String(e.args?.orderId ?? '').toLowerCase() === String(r.orderId ?? '').toLowerCase());
  const paid = micro(balances.before.payer) - micro(balances.after.payer);
  const got = micro(balances.after.good) - micro(balances.before.good);
  return verdict(
    'B',
    {
      'status paid': r.status === 'paid',
      'PaymentSettled for the order': Boolean(settled),
      'payer paid the price': paid === micro(priceMicro),
      'the good shop received it': got === micro(priceMicro),
      // The receipt names the chain (CAIP-2) and links the configured explorer; the run file
      // carries the WHITECHAIN or FORK label.
      'the receipt is on the chain': r.receipt?.network === network && (!explorer || String(r.receipt?.explorerUrl ?? '').startsWith(explorer)),
    },
    { status: r.status, orderId: r.orderId, settle: settled?.id ?? null, payerDelta: `-${usdt(paid)}`, shopDelta: `+${usdt(got)}`, receipt: r.receipt?.explorerUrl ?? null },
    `PaymentSettled; payer −${usdt(priceMicro)}, shop +${usdt(priceMicro)}; receipt on ${network}`,
  );
}

// C: mirrored: the cursor passed the settle block; the trail is order → pay → deliver.
export function assertMirrored({ trail, events, kinds = ['order', 'pay', 'deliver'] }) {
  const settle = events.find((e) => e.name === 'PaymentSettled');
  const got = trail.edges.map((e) => e.kind);
  return verdict(
    'C',
    {
      'cursor at or past the settle block': Boolean(settle) && trail.cursorBlock >= settle.block,
      'trail kinds in order': kinds.every((k, i) => got[i] === k),
      'every ref is a chain event id': trail.edges.slice(0, kinds.length).every((e) => REF.test(e.ref)),
    },
    { cursorBlock: trail.cursorBlock, settleBlock: settle?.block ?? null, trail: trail.edges.map((e) => `${e.kind} ${e.ref}`) },
    `cursor ≥ settle block; trail ${kinds.join(' → ')}; refs 1874:<tx>:<logIndex>`,
  );
}

const delta = (a, b, k) => micro(b?.[k]) - micro(a?.[k]);

// D: GraphQL shows the edge and the tallies (TODAY +1 order, +price, +1 delivered, +1 on
// time; all-time orders = before + 1; the payer's TODAY paid +price).
export function assertTallies({ graph, priceMicro }) {
  const { before, after } = graph;
  const t = (k) => delta(before.good.today, after.good.today, k);
  return verdict(
    'D',
    {
      'good TODAY orders +1': t('orders') === 1n,
      'good TODAY paid +price': t('paidMicro') === micro(priceMicro),
      'good TODAY delivered +1': t('delivered') === 1n,
      'good TODAY on time +1': t('onTime') === 1n,
      'good all-time orders +1': delta(before.good.all, after.good.all, 'orders') === 1n,
      'payer TODAY paid +price': delta(before.payer.today, after.payer.today, 'paidMicro') === micro(priceMicro),
    },
    { goodToday: after.good.today, goodAllOrders: String(after.good.all?.orders), payerToday: after.payer.today, explainIds: graph.explainIds ?? [] },
    `TODAY +1 order, +${usdt(priceMicro)}, +1 delivered, +1 on time; all-time +1; payer TODAY +${usdt(priceMicro)}`,
  );
}

// E: a partial refund: TODAY refunds +1 and refunded +amount; all-time refunds +1; the trail ends in refund.
export function assertRefund({ graph, trail, refundMicro }) {
  const { before, after } = graph;
  return verdict(
    'E',
    {
      'good TODAY refunds +1': delta(before.good.today, after.good.today, 'refunds') === 1n,
      'good TODAY refunded +amount': delta(before.good.today, after.good.today, 'refundedMicro') === micro(refundMicro),
      'good all-time refunds +1': delta(before.good.all, after.good.all, 'refunds') === 1n,
      'the trail ends in refund': trail.edges.at(-1)?.kind === 'refund',
    },
    { goodToday: after.good.today, trailEnd: trail.edges.at(-1)?.kind ?? null },
    `refunds +1, refunded +${usdt(refundMicro)}, trail ends in refund`,
  );
}

// F: the killed agent is refused within the gate cache (20 s, 25 s allowed) and the refusal is on Arkiv.
export function assertKilled({ kill, withinMs = 25_000 }) {
  const took = kill.refusedMs - kill.receiptMs;
  return verdict(
    'F',
    {
      'HTTP 402': kill.status === 402,
      'refused ENS_EXPIRED_OR_REVOKED': kill.reason === 'ENS_EXPIRED_OR_REVOKED',
      [`within ${withinMs / 1000} s of the kill`]: Number.isFinite(took) && took >= 0 && took <= withinMs,
      'a fail edge on Arkiv': Boolean(kill.failEdge),
    },
    { status: kill.status, reason: kill.reason, secondsToBite: Number.isFinite(took) ? Math.round(took / 100) / 10 : null, failEdge: kill.failEdge ?? null },
    `402 ENS_EXPIRED_OR_REVOKED within ${withinMs / 1000} s; an off-chain fail edge`,
  );
}
