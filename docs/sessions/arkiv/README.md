# T3 Arkiv: working notes

## Packages (ADR-0057)

- `@graphpay/arkiv-graph` (`packages/arkiv-graph`): the generic Arkiv graph SDK. Nodes, edges and totals defined by the developer; the safe writer; owner-scoped reads; ArkivSim; the transport. No payment words in its source (a boundary test).
- `@graphpay/money-graph` (`packages/money-graph`): GraphPay's layer, through the SDK's public API only. Import everything from the package root.

## For the other sessions (M7a)

```js
import { connectArkiv, createLedger, recordEdge, createQuote, findQuotes, discoverShops, writeHeartbeat } from '@graphpay/money-graph';
const arkiv = await connectArkiv({ backend: 'rabdi', env: process.env, role: 'W_LEDGER' }); // 'sim' for tests
```

- **Mirror (Join, M11):** `createLedger({ arkiv, stream })`, `await ledger.load()`, then `ledger.apply(event, { nonce })` per event; `ledger.foldRecorder(events, { nonce })` folds W_SYNC refusal edges into the tallies without a second edge; `ledger.writeStanding({ ref, ens, epoch, status, capMicro, ts, position }, { nonce })` patches a node row with the checkpoint; `ledger.confirmedNonce()` reads the nonce before the anchors, and a send at that nonce is refused with `code: 'NONCE_TAKEN'` if it is taken; `event.counted = false` (or `reason: 'DUPLICATE'` on a `fail`) moves no tally; `writeHeartbeat(arkiv, values, { key, extend })` and `readHeartbeats(publicClient)`. On any failed write the ledger re-reads its rows from Arkiv before it throws.
- **Recorder (T1, M3):** `recordEdge(connectArkiv({ role: 'W_SYNC' }), { ref, kind: 'fail' | 'request', from: { ens, epoch }, to: { ens, epoch }, amountMicro, ts, orderId })`: create-only, readonly; a transaction found by nonce is adopted only if it carries this `ref`.
- **Quotes (T1 writes, T4 reads):** `createQuote(directoryConn, { requestId, shopKey, agentEns, price, validUntil })`; `findQuotes(publicClient, requestId)` returns only W_DIRECTORY's live quotes.
- **Discovery (M7b wires it into GraphQL):** `discoverShops(publicClient, { category, box, synthetic })`, `boxAround(point, km)`.

## Live runs

- `pnpm -s --filter @graphpay/money-graph smoke [entityKey]`: read-only.
- `pnpm -s --filter @graphpay/money-graph probe`: M7a's labelled probe writes (1-day rows; done 2026-11-06 01:29 IST, results in `docs/technical/FACTS.md`). Do not re-run while the site is live (it writes a W_DIRECTORY row; ADR-0033).
