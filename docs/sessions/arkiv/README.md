# T3 Arkiv: working notes

## Packages (ADR-0057)

- `@graphpay_ethglobal/arkiv-graph` (`packages/arkiv-graph`): the generic Arkiv graph SDK. Nodes, edges and totals defined by the developer; the safe writer; owner-scoped reads; ArkivSim; the transport. No payment words in its source (a boundary test).
- `@graphpay/money-graph` (`packages/money-graph`): GraphPay's layer, through the SDK's public API only. Import everything from the package root.

## For the other sessions (M7a)

```js
import { connectArkiv, createLedger, recordEdge, createQuote, findQuotes, discoverShops, writeHeartbeat } from '@graphpay/money-graph';
const arkiv = await connectArkiv({ backend: 'rabdi', env: process.env, role: 'W_LEDGER' }); // 'sim' for tests
```

- **Mirror (Join, M11):** `createLedger({ arkiv, stream })`, `await ledger.load()`, then `ledger.apply(event, { nonce })` per event; `ledger.foldRecorder(events, { nonce })` folds W_SYNC refusal edges into the tallies without a second edge; `ledger.writeStanding({ ref, ens, epoch, status, capMicro, ts, position }, { nonce })` patches a node row with the checkpoint; `ledger.confirmedNonce()` reads the nonce before the anchors, and a send at that nonce is refused with `code: 'NONCE_TAKEN'` if it is taken; `event.counted = false` (or `reason: 'DUPLICATE'` on a `fail`) moves no tally; `writeHeartbeat(arkiv, values, { key, extend })` and `readHeartbeats(publicClient)`. On any failed write the ledger re-reads its rows from Arkiv before it throws.
- **Recorder (T1, M3):** `recordEdge(connectArkiv({ role: 'W_SYNC' }), { ref, kind: 'fail' | 'request', from: { ens, epoch }, to: { ens, epoch }, amountMicro, ts, orderId })`: create-only, readonly; a transaction found by nonce is adopted only if it carries this `ref`, kind and both ends (PR #25).
- **Quotes (T1 writes, T4 reads):** `createQuote(directoryConn, { requestId, shopKey, agentEns, price, validUntil })`; `findQuotes(publicClient, requestId)` returns only W_DIRECTORY's live quotes.
- **Discovery (M7b wires it into GraphQL):** `discoverShops(publicClient, { category, box, synthetic })`, `boxAround(point, km)`.

## Activity (Friday item 1; T5 and T4 wire it)

```js
import { activityHooks, closeShop, connectArkiv, openShop } from '@graphpay/money-graph';
const dir = await connectArkiv({ backend: 'rabdi', env: process.env, role: 'W_DIRECTORY' });
const { key } = await openShop(dir, { shopKey, shopEns, key: lastKey }); // on: every 5 min while the toggle is on
await closeShop(dir, { key });                                          // off: out of "open now" at once, gone within 15 min
await runErrand({ ...options, hooks: activityHooks(dir) });            // presence (15 min, renewed) and handoffs (30 min)
```

GraphQL: `shops(category, box, openNow: true)` (one extra read), `agentsOnline(owner: <ens>)` or `(session: <run id>)`, `handoffs(requestId: <run id>)`. Every row has a `key` for its explorer link (`/entity/<key>`).

## Race mode (T5, M15; M9)

`GET /api/race?question=Q2&size=S&mode=plain|graph&inFlight=1|8|all` (WEBSITE_SPEC §7) runs one side live and uncached. Everything is in `@graphpay/money-graph`:

```js
import { callTap, connectArkiv, raceQuestion, RACE_QUESTIONS } from '@graphpay/money-graph';
const tap = callTap();
const arkiv = await connectArkiv({ backend: 'rabdi', env: process.env, log: tap.log }); // one connection per race
const result = await raceQuestion(arkiv, { question, mode, inFlight, params, truth, size: 'S', tap, onCall: (c) => send(c) });
// each call: { call, ms, bytes, status }; result: { answer, correct, truthBasis, matchesIdentityTruth, calls, bytes, ms }
```

- `RACE_QUESTIONS` is Q1, Q2, Q5. `inFlight` (plain only) is 1, 4, 8, 16 or `'all'`; above 1, plain first makes one `count()`.
- `params` (who and which days) and `truth` come from the generated city: `benchParams(city)` and `benchTruth(city, truthOf(city), params)` in `@graphpay/city`, with `generateCity({ story, size: 'S', end: '2026-11-05' })` (the seeded end date). That takes a dependency on `@graphpay/city` (pure, no network; a few milliseconds at S on this Mac); without `truth`, `correct` is `null`.
- The result to show is `calls` (reads) and `bytes` (ADR-0042, acceptance D13); they equal the `calls` of that mode in `bench/results/questions-S.csv`. Keep one race at a time: a plain S race is 5 or 6 reads, Graph Arkiv 2.

## Live runs

- `node bench/run.mjs --size S --end 2026-11-05`: the live benchmark (read-only, about 1,000 reads); writes `bench/results/*.csv` and `bench/BENCHMARK-LIVE.md`.
- `pnpm -s --filter @graphpay/money-graph smoke [entityKey]`: read-only.
- `pnpm -s --filter @graphpay/money-graph probe`: M7a's labelled probe writes (1-day rows; done 2026-11-06 01:29 IST, results in `docs/technical/FACTS.md`). Do not re-run while the site is live (it writes a W_DIRECTORY row; ADR-0033).
