# ADR-0080: The big city M is what was seeded: its first 3,175 events
Status: accepted · Date: 2026-11-07 01:05 IST · Decided by: founder (relayed by W2's session and the night Coordinator) · Source: the founder's message to W2, Sat 7 Nov about 00:57 IST; the Coordinator's "stop seeding the big city now"

## Decision
- **The founder trimmed the big city M to what was already seeded.** The graph store holds the first 3,175 of its 9,996 events in time order: 127 batches of 25, from 9 Jul to 14 Aug. That is all 606 actors and 123 shops (the final cast and the Grok pack's 120 places), and 1,387 payment and renewal rows.
- **The story records it as `syntheticCity.sizes.M.seededEvents: 3175`.** The generator cuts M there, so its truth and digest are those of the seeded city.
- **No more M seeding writes.** The plain store, which race mode's plain side reads, was never written for M. Race mode stays at S unless the founder asks for the plain store.

## Why
- One M seeding takes about two hours and most of W_SEED_M_EVENT's 8.5 tGLM (ADR-0049).
- Its reads and writes share Arkiv's keyless query window with the live mirror on the same Mac. The mirror stalled twice tonight while M ran.
- Rabdi refused a part of batch 127 (`Store(Entity(Store(HandleInvalid)))`). The 32 rows that had landed were deleted (`docs/sessions/arkiv/city/undo-M-batch-127.json`), so the store is exactly batches 0 to 126.

## Consequences
- **M as seeded:** 3,175 events, graph store only. It cost 1.65 tGLM in 333 transactions (`docs/sessions/arkiv/city/seed-M-graph.json`), plus one transaction to undo the partial batch.
- **The lab's figures stay labelled "lab":** the lab's 10,000-event M had 4,604 payment rows, so 47 or 48 reads. The seeded M's Q2 would need 14 plain reads (15 with every page at once) against Graph Arkiv's 2. That is a count from the generator, not a measurement, until a plain store is written and D7 is run.
- **The seeder now recovers:** it undoes a batch the node refuses part-way and sends it again, and a stopped run resumes at its batch (`packages/city/test/seed.test.mjs`).
- **Acceptance:** D4 and D8 stay at S. D7 stays blocked: there is no plain store at M.
