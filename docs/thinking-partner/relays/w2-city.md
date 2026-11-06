# Relay: w2-city (W2 City)

Updated 01:45 IST, Sat 7 Nov (W2 City, session `local_da212093-3d02-4768-9314-ab7be179eb86`). Brief: [`briefs/2300-w2-city.md`](../briefs/2300-w2-city.md).

## In plain words

**W2 City is done.** All four items of the brief are closed. The last PR, [#186](https://github.com/Zugzwang-world/graphpay/pull/186), carries this update.

**1. The new shops' rows ([#167](https://github.com/Zugzwang-world/graphpay/pull/167)): done and live.**
- Filter & Fold, Idli Index and Tawa Tangle are on Arkiv under their own names, at epoch 0, in the category `south-indian`, at their Grok places. Each has 90 days of labelled synthetic history.
- The analyst's own query, scored by the agents' own code: Filter & Fold 241 orders, 1.2% refunds, 97.1% on time (chosen); Idli Index 60, 3.3%, 93.3%; Tawa Tangle 110, 18.2%, 70.9% (excluded).

**2. The menus ([#181](https://github.com/Zugzwang-world/graphpay/pull/181), [#201](https://github.com/Zugzwang-world/graphpay/pull/201)): done and live.**
- All three menus are on Swarm. Each carries its shop's storefront photo and its four dish photos, the same files the phones show (15 images in all).
- Each menu has its pointer row on Arkiv. Every file was checked by its hash when read back.

**3. The big city M: trimmed by the founder to what was seeded (ADR-0080).**
- Final size: the first 3,175 events of the generated city (9 Jul to 14 Aug), 606 actors, 123 shops (the 3 cast shops and Grok's 120 synthetic places), 1,387 payment rows. Graph store only, labelled synthetic.
- It cost 1.65 tGLM. Rabdi refused part of batch 127, which was undone: the store is exactly batches 0 to 126.

**4. Race mode stays at S (the founder's decision, 01:24).**
- S is 1,003 events, 12 shops and 490 payment rows.
- Measured on Rabdi (5 Nov, five runs each): the top 10 (Q2) takes Graph Arkiv 2 reads and 35 KB, against plain code's 5 reads and 135 KB (6 reads with its pages in parallel). Median 0.69 s against 2.17 s.
- The "48 reads" is the lab's 10,000-event city, and stays labelled "lab". For M's Q2 the generator counts 2 reads against 14; that is a count, not a measurement.

**For the founder:** nothing is needed. OPEN has two optional items: delist the old shops' rows once D8 leaves S, and write M's plain store only if you want the race at M.

## Technical

- **Live rows:**
  - `docs/sessions/arkiv/city/cast-final.json`: the directory [0x5878…dcb0](https://rabdi.explorer.arkiv.network/tx/0x5878324627c9f5fa6344c8e680af438335f16c2e6cc407c58048b2dd0bf2dcb0), 12 nodes, and the history stream `history:test:v1:x0.05:d20763:99fe16f5` at 1,258 of 1,258.
  - `docs/sessions/arkiv/swarm-menus.json`: every menu, image, reference and hash.
  - `docs/sessions/arkiv/city/seed-M-graph.json` and `undo-M-batch-127.json`. The cost is 1.6482 tGLM in all: 333 seeding transactions and one undo.
- **Each seeded city keeps its own cast** (`syntheticCity.casts`, ADR-0077). Tests hold S and M equal to their seeded truth and digests. This fixed race Q2 at S and acceptance D4, which had been broken since the renewal changed (#140).
- **The trimmed M's answers:** its events end on 14 Aug, while its 90-day windows end on 6 Nov. Q1 counts 46 of 297 orders, Q3 and Q4 come back empty, and Q5 finds no path.
- **The seeder recovers (#186):**
  - a batch the node refuses part-way is undone (its creates deleted, its patches set back) and sent again;
  - a run that stops undoes its partial batch first, so Arkiv is left at the batch before;
  - a resumed run starts only where the store ends.
  - Six ArkivSim tests in `packages/city/test/seed.test.mjs`.
- **Race mode** reads any seeded size. On a city of more than 1,000 payment rows, a plain race starts at most once every 10 minutes per server; at S (490 rows) that guard never applies.
- **The live race, 01:55 IST:** Q2 answered correctly with the measured numbers. The site's keyed Arkiv endpoint answered QUOTA_EXCEEDED, and its fallback event had been counted as a read, so the counter showed one too many before the answer. Fixed in #186 (`callTap`).
- **Fixes found on the way:** W_DIRECTORY writes take a transaction found by nonce only if it holds their own row (two of the live site's rows had been taken for menu rows), and the history writer resumes only its own stream.
- **The Arkiv read window** (`docs/technical/FACTS.md`): the keyless endpoint meters queries on a window of about 10,000 rows, shared by every process on this Mac. Full reloads of W_LEDGER spent it, so my scripts pause, space their heavy reads, and write between the mirror's heartbeats.
- **SDK finding (for W6):** when another writer takes a pinned nonce, `adopt()` throws "created N entities for M creates" before `verifyRecovered` runs.
- **Reviewer:** #167, #181 and #186 were reviewed, and every blocking item was fixed.

## Next

- Nothing is running.
- If the founder asks for M's plain store: write it, run `bench/d7.mjs --size M`, publish `bench/results/questions-M.csv`, and set `raceSize: "M"`.
- Delist the old shops' directory rows once acceptance D8 moves off S.
