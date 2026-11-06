# ADR-0049: The big city waits for the locked story

Status: accepted (gate superseded by ADR-0077) · Date: 2026-11-05 · Decided by: founder (chat, 22:42 IST; brief v2)

## Decision

Tonight only the small city S is seeded, with the test story, for acceptance. The large city M is seeded straight into Arkiv only after the founder locks the final story, labelled synthetic, with no real payments, and never with the test cast.

## Why

The pack's generator puts the cast shops at popularity ranks 1 to 3 and includes the persona's recent purchases, so M depends on the final cast; one M seeding costs about 6.3 to 8.5 tGLM and 100 to 130 minutes, too much to do twice.

## Consequences

W_SEED_M_EVENT already holds 8.5 tGLM for it. Latest safe start before the Friday 18:00 IST freeze: 14:00 IST (`docs/thinking-partner/NOW.md`). Acceptance D7 (benchmark at M) is `blocked: waiting for the locked story` until then; race mode runs at S. A second M seeding needs another faucet claim.
