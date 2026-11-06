# Relay: w2-city (W2 City)

Updated 00:15 IST, Sat 7 Nov (W2 City, session `local_da212093-3d02-4768-9314-ab7be179eb86`). Brief: [`briefs/2300-w2-city.md`](../briefs/2300-w2-city.md).

## In plain words

**Step 1 is done: the dosa story's three shops now exist on Arkiv under their own names.** Filter & Fold, Idli Index and Tawa Tangle were written at epoch 0, before W1 flips the story's labels, so the graph already knows them when the flip lands. For each shop:
- a directory listing, at its place from the Grok pack (BKC, Bandra East, Kalina);
- its node row and its three agents' rows, in the category **south-indian** instead of "sweets";
- 90 days of labelled synthetic history, written by the mirror's own history code. Refund and on-time rates are the story's; orders are at 5%, the same scale as the old shops' history. All 1,258 events are written.

| shop | orders (story's) | refunds | on time |
|---|---|---|---|
| Filter & Fold | 241 (4,812) | 1.2% | 97.1% |
| Idli Index | 60 (1,204) | 3.3% | 93.3% |
| Tawa Tangle | 110 (2,190) | 18.2% | 70.9% |

Read back through the live site with the analyst's own query and scored by the agents' own code: Filter & Fold 0.916 (chosen), Idli Index 0.863, Tawa Tangle excluded (over 10% refunds, under 80% on time). Explain id `5a46086c6653`.

**A live bug, fixed in this step.** Since #140 moved the Sunday box from 0.40 to 2.40 (19:02 IST), the small city was rebuilt from the new price, but it had been seeded at 0.40. So race mode's top-10 question (Q2) judged Graph Arkiv's correct answer as wrong, and acceptance D4 failed (W5 found the same).

Each seeded city now keeps its own cast in `story.json` → `syntheticCity.casts` (ADR-0077): the labels, the category, the places and the renewal price. A test fails any story change that would move a seeded city.

**For W1's flip:** first the workers restart (so the mirror reads the finished tallies), then one PR changes `shops[].label` and `shops[].category`:
- good → `filter-and-fold`;
- runner-up → `idli-index`;
- trap → `tawa-tangle`;
- category → `south-indian`.

A test fails a flip of the labels alone.

## Technical

- **Code:** `packages/city/scripts/cast.mjs` writes from `syntheticCity.casts.final` through the mirror's own history code, so the rows equal the mirror's. Manifest: `docs/sessions/arkiv/city/cast-final.json`.
- **Writes on Rabdi:**
  - directory: 3 rows, [0x5878…dcb0](https://rabdi.explorer.arkiv.network/tx/0x5878324627c9f5fa6344c8e680af438335f16c2e6cc407c58048b2dd0bf2dcb0);
  - node rows: 12 (3 shops and their storefront, risk and dispatch agents);
  - history: stream `history:test:v1:x0.05:d20763:99fe16f5`, 1,258 events, checkpoint 1,258. Events 176 to 1,258 went out from 23:59 to 00:11 IST with the mirror stopped by W5, for 0.388 tGLM.
- **Shared wallet:** W_LEDGER is the running mirror's wallet. Each part goes out at the confirmed nonce. When the mirror's heartbeat or a live payment took a nonce first, the part was retried from its checkpoint, so nothing was sent twice.
- **Reviewer (agent), blocking items fixed:**
  - a resume only continues the stream the manifest names and refuses to start a second;
  - the node rows are re-read before each retry;
  - the directory write checks a transaction found by nonce;
  - the flip waits for the workers' restart after the history.
- **The guard:** a digest test (`docs/sessions/arkiv/city/digests.json`) now holds S's events and actors, equal to the seeding commit d917262.
- **The Arkiv read budget (new fact):** the keyless endpoint meters `arkiv_query` on its own window (`limit=10000`, measured 23:38 IST; `HTTP 429` with `Retry-After` when spent), shared by every process on this Mac. Ordinary calls use the 2,000-per-few-seconds window. Each retry above made the mirror's code reload all of W_LEDGER's rows (about 2,000), so the retries spent this Mac's budget. The mirror shares it and waited until the reset. The script now keeps 40% of the window free.
- **SDK finding (for W6):** when another writer of the same key takes a pinned nonce, the writer's `adopt()` throws "created 0 entities for N creates" before `verifyRecovered` can call the transaction someone else's. It should be `NONCE_TAKEN`. This script treats it as one.
- **After a workers' restart,** `history: refused: 2 history streams on Arkiv` is expected and harmless.
- **Deviation:** the history's orders are at 5% (W_LEDGER holds about 1.4 tGLM, and the full 90 days would take about 25,000 events). The rates are the story's.

## Next

- Step 2: the three menus on Swarm, with their dish images.
- Step 3: the big city M, with Grok's 120 places behind the three shops. It is generated and checked on ArkivSim (about 10,000 events; the estimate fits W_SEED_M_EVENT's 8.5 tGLM).
- Step 4: race mode at M.
- After W1's flip: delist the old shops' three directory rows, so the map stops showing each name twice.
