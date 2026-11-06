# Relay: w2-city (W2 City)

Updated 01:15 IST, Sat 7 Nov (W2 City, session `local_da212093-3d02-4768-9314-ab7be179eb86`). Brief: [`briefs/2300-w2-city.md`](../briefs/2300-w2-city.md).

## In plain words

**1. The new shops' rows ([#167](https://github.com/Zugzwang-world/graphpay/pull/167)): done and live.**
- Filter & Fold, Idli Index and Tawa Tangle are on Arkiv under their own names, at epoch 0, in the category `south-indian`, at their Grok places. Each has 90 days of labelled synthetic history.
- The analyst's own query, scored by the agents' own code: Filter & Fold 241 orders, 1.2% refunds, 97.1% on time (chosen); Idli Index 60, 3.3%, 93.3%; Tawa Tangle 110, 18.2%, 70.9% (excluded).
- Orders are at 5% of the story's (W_LEDGER's funds); rates are the story's.
- W1's flip (#189) then moved the story to these names.

**2. The menus ([#181](https://github.com/Zugzwang-world/graphpay/pull/181) and this PR): done and live.**
- All three menus are on Swarm. Each carries its shop's storefront photo and its four dish photos, the same files the phones show (15 images in all).
- Each menu has its pointer row on Arkiv. Every file was checked by its hash when read back.

**3. The big city M: trimmed by the founder to what was seeded (ADR-0080).**
- The graph store holds the first 3,175 events of the generated city (9 Jul to 14 Aug): all 606 actors, the 3 cast shops and the 120 synthetic places from Grok, and 1,387 payment rows. Labelled synthetic.
- It cost 1.65 tGLM. Rabdi refused part of batch 127; that part was undone, so the store is exactly batches 0 to 126.
- The plain store (what plain Arkiv code reads) and the directory rows were not written.

**4. Race mode stays at S.**
- Measured at S: the top 10 takes Graph Arkiv 2 reads against 5 for plain code.
- The race at M needs M's plain store, which is the founder's call (OPEN). With it, the generator's count for Q2 is 2 against 14.
- The "48 reads" is the lab's 10,000-event city, and stays labelled "lab".

## Technical

- **Live rows:**
  - `docs/sessions/arkiv/city/cast-final.json`: the directory [0x5878…dcb0](https://rabdi.explorer.arkiv.network/tx/0x5878324627c9f5fa6344c8e680af438335f16c2e6cc407c58048b2dd0bf2dcb0), 12 nodes, and the history stream `history:test:v1:x0.05:d20763:99fe16f5` at 1,258 of 1,258.
  - `docs/sessions/arkiv/swarm-menus.json`: every menu, image, reference and hash.
  - `docs/sessions/arkiv/city/seed-M-graph.json` and `undo-M-batch-127.json`.
- **Each seeded city keeps its own cast** (`syntheticCity.casts`, ADR-0077). Tests hold S and M equal to their seeded truth and digests. This fixed race Q2 at S and acceptance D4, broken since the renewal changed (#140).
- **Fixes found on the way:**
  - W_DIRECTORY writes now take a transaction found by nonce only if it holds their own row. Two of the live site's rows had been taken for menu rows.
  - The history writer resumes only its own stream.
  - The seeder undoes a batch the node refuses part-way, and a stopped run resumes at its batch (#186).
- **The Arkiv read window** (`docs/technical/FACTS.md`):
  - The keyless endpoint meters queries on a window of about 10,000 rows that every process on this Mac shares.
  - Full reloads of W_LEDGER (mine on retries, the mirror's on restart) spent it, and the mirror waited.
  - My scripts now pause, space heavy reads, and write between the mirror's heartbeats. W5's watchdog now waits 30 minutes before restarting.
- **SDK finding (for W6):** when another writer takes a pinned nonce, `adopt()` throws "created N entities for M creates" before `verifyRecovered` can call the transaction someone else's.
- **Reviewer:** #167 and #181 were reviewed and every blocking item fixed. #186 is in review.

## Next

- Merge #186 after its review. Race mode stays at S.
- If the founder asks for M's plain store: write it, run `bench/d7.mjs --size M`, publish `bench/results/questions-M.csv`, and set `raceSize: "M"`.
- Delist the old shops' directory rows once acceptance's D8 moves off S.
