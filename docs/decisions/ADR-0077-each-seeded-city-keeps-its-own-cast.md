# ADR-0077: Each seeded city keeps its own cast; the big city M is seeded with the final cast
Status: accepted · Date: 2026-11-06 23:55 IST · Decided by: W2 City under the founder's authority · Source: the founder's W2 brief (`docs/thinking-partner/briefs/2300-w2-city.md`), ADR-0073, the S seeding manifests in `docs/sessions/arkiv/city/`

## Decision
- **A seeded city is generated again from its own cast.** `story.json` → `syntheticCity.casts` holds each cast's shop labels, category, places and renewal price, by story role; `syntheticCity.sizes.<size>.cast` names the one a size was seeded with. The generator reads only that, never `shops[]` or `renewal`.
- **The casts:**
  - `test` is size S as seeded on 5 Nov: kesar-kingdom, syrup-street and jamun-junction, category `sweets`, the renewal at 0.40.
  - `final` is the founder's dosa story (ADR-0073), with the Grok pack's places: filter-and-fold, idli-index and tawa-tangle, category `south-indian`, the renewal at 2.40.
- **The final cast's shops are written on Arkiv now,** at epoch 0 under their new names: their directory rows, their node rows and their agents', and their labelled synthetic history. This happens before W1's flip, so the graph already holds them when the labels change.
- **The big city M is seeded with the final cast,** on the founder's W2 brief. This replaces ADR-0049's gate (the story's `locked` flag): M's cast is pinned in `casts.final` instead.

## Why
- The story changes under a seeded city:
  - #140 moved the renewal from 0.40 to 2.40 at 19:02 IST. Since then race mode's truth for Q2 at S (the top 10 by sales) has not matched what was seeded, so Graph Arkiv's correct answer was judged wrong.
  - W1's flip will rename the shops.
- One M seeding costs most of W_SEED_M_EVENT's 8.5 tGLM (ADR-0049). Its truth must never move after it is seeded.

## Consequences
- **The order of the flip:**
  1. the final cast's history is complete on Arkiv (1,258 of 1,258 events);
  2. then the workers restart, so the mirror reads the finished tallies;
  3. then W1's flip goes live.

  A mirror that read the tallies part-way would plan the new shops' first live payment from stale counts and overwrite their totals.
- **W1's flip PR changes `shops[].label` and `shops[].category` together,** to the final cast's values. A test fails a flip of the labels without the category.
- **Exceptions to one writer per wallet (ADR-0023, ADR-0033), tonight only:**
  - `packages/city/scripts/cast.mjs` writes W_LEDGER rows beside the running mirror. Every history part carries its own checkpoint and goes out at a nonce read first. Retries re-read that checkpoint, and the last run ran with the mirror stopped.
  - The W_DIRECTORY scripts (the cast's rows, the menus) run while the site is live. Every send there checks that a transaction found by nonce holds its own row: the cast script here, `writeMenu` and `writeShop` in the menus PR. Without that check, two of the site's own rows were once taken for menu rows.
- **A story change that would change a seeded city's events, actors or truth fails CI:** two tests check its truth file and its digests (`docs/sessions/arkiv/city/digests.json`). Display names and the persona's point still follow the live story: they reach only the directory rows, which were written once.
- **ADR-0049 is superseded** for the gate. Its cost and the "one seeding" warning still hold.
- **The old shops stay on Arkiv as history.** Their directory rows stay listed until the flip, then W2 delists them.
