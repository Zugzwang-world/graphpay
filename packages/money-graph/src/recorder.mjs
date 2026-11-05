// Off-chain edges from the recorder routes (W_SYNC): a facilitator refusal (`fail`) or a
// customer's refund request (`request`), create-only and readonly, no tallies (the
// mirror folds them in). Vercel instances share W_SYNC's nonces, so a transaction found
// by nonce after an uncertain send is read back and adopted only if it carries this ref.

import { ExpirationTime } from '@arkiv-network/sdk';
import { normalizedName, nodeOf } from './identity.mjs';
import { ENTITIES, LIFETIME } from './model.mjs';
import { dayOf } from '@graphpay/arkiv-graph';

export const RECORDER_KINDS = ['fail', 'request'];

const same = (a, b) => typeof a === 'string' && a.toLowerCase() === String(b).toLowerCase();

export function recorderEdgeValues({ ref, kind, from, to, amountMicro = 0n, ts, orderId, payload }) {
  if (!RECORDER_KINDS.includes(kind)) throw new Error(`money-graph: the recorder writes ${RECORDER_KINDS.join(' and ')} edges, not "${kind}"`);
  if (typeof ref !== 'string' || ref === '') throw new Error('money-graph: a recorder edge needs a ref');
  const fromEns = normalizedName(from.ens);
  const toEns = normalizedName(to.ens);
  return {
    from_node: nodeOf(fromEns),
    to_node: nodeOf(toEns),
    kind,
    amount_micro: BigInt(amountMicro),
    day: BigInt(dayOf(ts)),
    ts: BigInt(ts),
    from_epoch: BigInt(from.epoch ?? 0),
    to_epoch: BigInt(to.epoch ?? 0),
    ref,
    synthetic: false,
    dataset: 'live',
    from_ens: fromEns,
    to_ens: toEns,
    order_id: orderId,
    payload,
  };
}

// arkiv: a connection with role W_SYNC. Returns { entityKey, txHash, recovered }.
export async function recordEdge(arkiv, edge) {
  if (!arkiv?.writer) throw new Error('money-graph: recordEdge needs a W_SYNC connection with a writer');
  const values = recorderEdgeValues(edge);
  const ours = async ([k]) => {
    const e = await arkiv.publicClient.getEntity(k);
    const a = e?.$attributes ?? e?.attributes;
    return a?.ref?.value === values.ref && a?.kind?.value === values.kind && same(a?.from_node?.value, values.from_node) && same(a?.to_node?.value, values.to_node);
  };
  const { txs, createdKeys } = await arkiv.writer.send(
    { creates: [{ def: ENTITIES.edge, values, expiration: ExpirationTime.fromDays(LIFETIME.realDays) }] },
    { verifyRecovered: ours },
  );
  return { entityKey: createdKeys[0], txHash: txs[0].hash, recovered: txs[0].recovered };
}
