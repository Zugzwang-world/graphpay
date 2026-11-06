# ADR-0081: The big city M is what was seeded; race mode stays at S
Status: accepted · Date: 2026-11-07 01:24 IST · Decided by: founder · Source: the founder's messages to the night Coordinator (00:52 IST, "the big city is trimmed: W2 stops seeding now and finishes race mode on what's seeded") and to W2 (01:24 IST, race mode stays at S); W2's final report

## Decision
The size M city is trimmed to what was seeded when seeding stopped at 00:58 IST, and it is not raced. Race mode stays at size S, and the site shows only S's measured numbers.

## Why
The M seed shared this Mac's Arkiv read budget with the mirror, which records every live payment. The access key's quota was spent, and the mirror stalled three times while the seed ran. A two-hour seed would have left the live graph lagging into the presentation.

## Consequences
- M on Arkiv: the first 3,175 of its 9,996 events (batches 0 to 126, 9 Jul to 14 Aug): 606 actors, 123 shops (the final cast and 120 synthetic places) and 1,387 payment rows. Graph store only, under W_SEED_M_EVENT, labelled synthetic. It has no plain store and no directory rows. Main's `story.json` does not record the trim.
- PR #186 (race mode for any seeded size, the seeder's recovery, M as seeded) was closed unmerged at the close: its reviewer found a blocking flaw in the seeder's recovery. The work stays on branch `arkiv/w2-race-m` (2bad364).
- No M race number exists. "2 against 14" is the generator's count. The deck's "48 reads" is the pre-event lab's 10,000-event city and stays labelled "lab". The measured numbers are S's (`bench/results/questions-S.csv`).
- D7 stays blocked in the acceptance report (#215).
