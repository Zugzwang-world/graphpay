# Relay: w2-city (W2 City)

Updated 00:20 IST, Sat 7 Nov (W2 City, session `local_da212093-3d02-4768-9314-ab7be179eb86`). Brief: [`briefs/2300-w2-city.md`](../briefs/2300-w2-city.md).

## In plain words

**Step 1 is done** ([#167](https://github.com/Zugzwang-world/graphpay/pull/167)). The dosa story's three shops now exist on Arkiv under their own names, written at epoch 0 before W1 flips the story's labels. Each shop has:
- a directory listing at its Grok place (BKC, Bandra East, Kalina);
- its node row and its three agents' rows, in the category **south-indian**;
- 90 days of labelled synthetic history, written by the mirror's own code. The refund and on-time rates are the story's; the orders are at 5%, the same scale as the old shops' history.

I read the shops back through the live site with the analyst's own query, then scored them with the agents' own code:

| shop | orders (story's) | refunds | on time | score |
|---|---|---|---|---|
| Filter & Fold | 241 (4,812) | 1.2% | 97.1% | 0.916, chosen |
| Idli Index | 60 (1,204) | 3.3% | 93.3% | 0.863 |
| Tawa Tangle | 110 (2,190) | 18.2% | 70.9% | excluded |

**Step 2 is done (this PR).** All three menus are on Swarm, every item with its dish image: the same 12 photos the phones show. Each menu has its pointer row on Arkiv, and every file's hash checked out when read back. Filter & Fold's: [menu.json](https://api.gateway.ethswarm.org/bzz/1e3df1a9613b7da3250a3247f13a03b29011453368ff683b6411a33c307f389f/menu.json).

**Fixed on the way:**
- Race mode's Q2 at S and acceptance D4. Both read the small city with the new 2.40 renewal, while S had been seeded at 0.40. Each seeded city now keeps its own cast (ADR-0077), and a digest test holds S equal to its seeding commit.
- Two W_DIRECTORY writes from my script mistook the live site's own transactions for theirs. A transaction found by nonce now counts only if it holds the write's own row.

**For W1's flip:** the workers restarted after the history (W5, 00:13 IST). The flip changes `shops[].label` and `shops[].category` in one PR:
- good → `filter-and-fold`;
- runner-up → `idli-index`;
- trap → `tawa-tangle`;
- category → `south-indian`.

A test fails a flip of the labels alone.

## Technical

- **Step 1 writes** on Rabdi, recorded in `docs/sessions/arkiv/city/cast-final.json`:
  - the directory: 3 rows in one transaction, [0x5878…dcb0](https://rabdi.explorer.arkiv.network/tx/0x5878324627c9f5fa6344c8e680af438335f16c2e6cc407c58048b2dd0bf2dcb0);
  - 12 node rows;
  - the history stream `history:test:v1:x0.05:d20763:99fe16f5`, at checkpoint 1,258. Events 176 to 1,258 went out while W5 had the mirror stopped (23:59 to 00:11 IST), for 0.388 tGLM.
- **Step 2:**
  - Writes: `pnpm -s --filter @graphpay/money-graph menus --cast final --images apps/phones/static/grok/dishes --execute`.
  - The record is `docs/sessions/arkiv/swarm-menus.json`. The old shops' menus are listed there under `previous`.
  - The menu entities: Filter & Fold `0x628f…04f8`, Idli Index `0xd762…50b0`, Tawa Tangle `0xdb86…4eba`.
  - The images are 240×240 JPEG, 10.8 to 20.2 KB each.
- **The wrongly adopted rows:**
  - `writeMenu` sent without `verifyRecovered`. When a send was uncertain, the writer adopted whatever W_DIRECTORY transaction it found at that nonce (a live `handoff` row, an `agent_presence` row) and reported a menu row it never wrote.
  - Nothing of the site's was changed, and the two menu rows were written again.
  - `ownCreate` now checks the entity's type and shop key for `writeMenu`, `writeShop` and the cast script.
- **The Arkiv read window (new fact, `docs/technical/FACTS.md`):** the keyless endpoint meters `arkiv_query` on its own window (`limit=10000`), shared by every process on this Mac, the mirror included. Each retry that reloaded all of W_LEDGER's rows (about 2,000) spent it. My scripts now keep 40% free and wait out the mirror's heartbeat gap.
- **SDK finding (for W6):** when another writer takes a pinned nonce, `adopt()` throws "created N entities for M creates" before `verifyRecovered` can call the transaction someone else's.
- **Reviewer:** the blocking items in #167 are fixed:
  - the history writer resumes only the stream its manifest names;
  - the node rows are re-read before each retry;
  - the flip waits for the workers' restart.

## Next

- **Step 3, the big city M,** is seeding on Rabdi: about 10,000 events, and the estimate (about 7 tGLM) fits W_SEED_M_EVENT's 8.5. Its 120 directory rows are held back, because the stage's phones poll `/api/map` and every poll would read them; that is listed in OPEN for the frontend pass.
- **Step 4:** D7 at M, then race mode at M.
- **After the flip:** delist the old shops' three directory rows.
