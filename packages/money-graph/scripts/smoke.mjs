// Read-only smoke test on Arkiv Rabdi (planning/PROMPTS/07a step 1): the chain id, a
// count(), the typed-literal rendering (u64 against a bare bigint's u256), the 64/65
// predicate-leaf probe and, when a key is given, an attribute-schema read of that entity.
//   pnpm -s --filter @graphpay/money-graph smoke [entityKey]
// Prints labels, counts and public keys only; never a URL or a secret.

import { addr, str, u64 } from '@arkiv-network/sdk';
import { and, eq, or } from '@arkiv-network/sdk/query';
import { connectArkiv, ENTITIES, writerAddresses } from '../index.mjs';
import { scope } from '@graphpay_ethglobal/arkiv-graph';
import { loadSecrets } from './lib.mjs';

const env = loadSecrets();
const arkiv = await connectArkiv({ backend: 'rabdi', env });
const w = writerAddresses();
const out = { rpc: arkiv.label, chainId: arkiv.chainId };

out.edgesOwnedByLedger = String(await arkiv.publicClient.count().from(ENTITIES.edge.schema).where(...scope(ENTITIES.edge)).ownedBy(w.W_LEDGER).fetch());
out.renderU64 = eq('day', u64(20398n)).toString();
out.renderBareBigint = eq('day', 20398n).toString();

const terms = (n) => Array.from({ length: n }, (_, i) => eq('ref', str(`probe-${i}`)));
const leaves = async (n) => {
  // project + type + owner + (n − 3) OR terms = n leaves.
  try {
    await arkiv.publicClient.query(and(...scope(ENTITIES.edge), eq('$owner', addr(w.W_LEDGER)), or(terms(n - 3))), { limit: 1 });
    return 'accepted';
  } catch (error) {
    let code;
    for (let e = error; e && code === undefined; e = e.cause) if (typeof e.code === 'number') code = e.code;
    return `refused (${code})`;
  }
};
out.leaves64 = await leaves(64);
out.leaves65 = await leaves(65);

const entityKey = process.argv[2];
if (entityKey) {
  const res = await arkiv.publicClient.request({ method: 'arkiv_query', params: [`$key = key(${entityKey.toLowerCase()})`, { select: { key: true, owner: true, creationFlags: true, expiresAt: true, attributeSchema: true }, limit: '0x1' }] });
  const e = res.data[0];
  out.schemaRead = e ? { owner: e.owner, flags: e.creationFlags, expiresAt: String(BigInt(e.expiresAt)), attributes: (e.attributeSchema ?? []).map((s) => `${s.name}:${s.type}${s.indexed ? '*' : ''}`) } : 'not found';
}
out.calls = arkiv.stats.calls;
out.status = arkiv.stats.status;
out.lowestRateLimitRemaining = arkiv.stats.lowestRemaining;
out.rateLimit = arkiv.stats.limit;
console.log(JSON.stringify(out, null, 2));
