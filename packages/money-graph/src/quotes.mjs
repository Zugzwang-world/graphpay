// Quotes (M7 amendment §5; ADR-0035): a shop's offer for one errand, written by
// W_DIRECTORY when the passcode-gated 402 step carries a requestId, readonly, gone
// from Arkiv 15 minutes after creation. The shop's own validity (`valid_until`) is
// 10 minutes, so an expired quote is refused by its date before it disappears.

import { ExpirationTime, str } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { checkedOwner, readAll } from '@graphpay/arkiv-graph';
import { normalizedName } from './identity.mjs';
import { ENTITIES, LIFETIME, writerAddresses } from './model.mjs';

const REQUEST_ID = /^0x[0-9a-f]{64}$/;

export function quoteValues({ requestId, shopKey, agentEns, price, validUntil }) {
  const id = String(requestId ?? '').toLowerCase();
  if (!REQUEST_ID.test(id)) throw new Error('money-graph: a requestId is a 32-byte hex string');
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(shopKey))) throw new Error('money-graph: a shop key is 32-byte hex');
  return { request_id: id, shop_key: shopKey, agent_ens: normalizedName(agentEns), price: BigInt(price), valid_until: BigInt(validUntil) };
}

// arkiv: a connection with role W_DIRECTORY. Create-only; returns { entityKey, txHash }.
export async function createQuote(arkiv, quote) {
  if (!arkiv?.writer) throw new Error('money-graph: createQuote needs a W_DIRECTORY connection with a writer');
  const values = quoteValues(quote);
  const ours = async ([k]) => {
    const e = await arkiv.publicClient.getEntity(k);
    return e?.attributes?.request_id?.value === values.request_id && BigInt(e?.attributes?.valid_until?.value ?? -1) === values.valid_until;
  };
  const { txs, createdKeys } = await arkiv.writer.send(
    { creates: [{ def: ENTITIES.quote, values, expiration: ExpirationTime.fromMinutes(LIFETIME.quoteMinutes) }] },
    { verifyRecovered: ours },
  );
  return { entityKey: createdKeys[0], txHash: txs[0].hash, recovered: txs[0].recovered };
}

// The live quotes for one errand, from W_DIRECTORY only: { key, requestId, shopKey,
// agentEns, price, validUntil, expiresAt (block) }.
export async function findQuotes(publicClient, requestId, { owner = writerAddresses().W_DIRECTORY } = {}) {
  const id = String(requestId ?? '').toLowerCase();
  if (!REQUEST_ID.test(id)) throw new Error('money-graph: a requestId is a 32-byte hex string');
  const rows = await readAll(publicClient, ENTITIES.quote, { owner: checkedOwner(owner), where: [eq('request_id', str(id))], cap: 100, truncate: true });
  return rows.map((r) => ({
    key: r.$key,
    requestId: r.request_id,
    shopKey: r.shop_key,
    agentEns: r.agent_ens,
    price: r.price,
    validUntil: r.valid_until,
    expiresAt: r.$expiresAt,
  }));
}
