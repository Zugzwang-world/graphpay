// The recorder's off-chain records (W_SYNC, create-only; SPEC/INTEGRATION_AND_MIRROR.md
// §2, §3): facilitator refusals (`fail` edges, payload.onchain = false) and customer
// refund requests (`request` edges, which move no tally). The mirror folds each refusal
// into the tallies (fails + 1) in its own batch, from its own `recorder` checkpoint,
// by `ts`. A refusal counts against a node only when the signing wallet is bound to
// that node on the checkout (§8 item 8): otherwise anyone could plant refusals in
// another agent's history.
//
// Ledger port, besides the mirror's: readRecorderEdges({ sinceTs, untilTs }) → W_SYNC
// edges with sinceTs < ts <= untilTs; foldRecorder(edges, { stream, checkpoint, nonce })
// → the tally patches for those edges and the checkpoint, one batch, no edge created.

import { BLOCK_DONE } from './ids.mjs';

export const RECORDER_STREAM = 'recorder';
// Only records older than this are folded: a route's write lands within it, so no
// record can appear behind the checkpoint.
export const SETTLE_S = 120;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// The signing wallet of a refusal: the payload's `payer`, else the ref's
// `att:<orderId>:<payer>:<n>` when that part is an address.
export function walletOf(edge) {
  if (ADDRESS.test(edge.payload?.payer ?? '')) return edge.payload.payer.toLowerCase();
  const parts = String(edge.ref ?? '').split(':');
  return parts[0] === 'att' && ADDRESS.test(parts[2] ?? '') ? parts[2].toLowerCase() : null;
}

export function groupsByTs(edges) {
  const groups = new Map();
  for (const e of edges) {
    const ts = Number(e.ts);
    if (!groups.has(ts)) groups.set(ts, []);
    groups.get(ts).push(e);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

// bindings.nodeOfWallet(wallet) → the node the checkout binds the wallet to, or null.
export async function foldRecorder({ ledger, bindings, nowS = Math.floor(Date.now() / 1000), settleS = SETTLE_S, since }) {
  const cp = await ledger.readCheckpoint(RECORDER_STREAM);
  let sinceTs = Math.max(cp?.block ?? 0, since ?? 0);
  const untilTs = nowS - settleS;
  const out = { folded: 0, unattributed: 0, requests: 0, sinceTs, untilTs };
  if (untilTs <= sinceTs) return out;
  for (const [ts, group] of groupsByTs(await ledger.readRecorderEdges({ sinceTs, untilTs }))) {
    const fails = [];
    for (const e of group) {
      if (e.kind === 'request') {
        out.requests += 1;
        continue;
      }
      if (e.kind !== 'fail' || e.payload?.onchain !== false) continue;
      const wallet = walletOf(e);
      const bound = wallet ? await bindings.nodeOfWallet(wallet) : null;
      if (!bound || bound.toLowerCase() !== e.fromNode.toLowerCase()) {
        out.unattributed += 1;
        continue;
      }
      fails.push({ ...e, counted: true });
    }
    sinceTs = ts;
    if (fails.length === 0) continue;
    // Same rule as the chain stream: the confirmed nonce, then the anchor, then the send.
    const nonce = await ledger.confirmedNonce();
    const anchor = await ledger.readCheckpoint(RECORDER_STREAM);
    if (anchor && anchor.block >= ts) continue;
    const checkpoint = { block: ts, logIndex: BLOCK_DONE, events: (anchor?.events ?? 0) + fails.length };
    const res = await ledger.foldRecorder(fails, { stream: RECORDER_STREAM, checkpoint, nonce });
    const noNode = res?.noNode?.length ?? 0;
    out.folded += res?.applied ? res.applied.length : fails.length - noNode;
    out.unattributed += noNode;
  }
  out.sinceTs = sinceTs;
  return out;
}
