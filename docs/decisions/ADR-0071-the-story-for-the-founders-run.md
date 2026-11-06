# ADR-0071: The story for the founder's run: Mr. Vitalik stays, the payer's pass is 100 a day, the dosa and BKC swap comes after
Status: accepted · Date: 2026-11-06 12:40 IST · Decided by: founder · Source: the support brief `docs/thinking-partner/briefs/1240-coordinator-integration-support.md`

## Decision
- Mr. Vitalik stays the persona.
- The payer agent's pass is 100 test USDT a day (`story.json` `buyerAgents` payer `capMicro` 100,000,000). T1 writes the on-chain policy and T2 the ENS cap record.
- The dosa and BKC story swap, with Grok's assets, comes after the founder's run. Until then the test cast stays.

## Why
- The founder's run of the integrated site needs a payer that can pay many errands in a day: each one costs 4.80, and the old cap of 6.00 allowed one.
- The swap is a config change, and it shouldn't move under the integration.

## Consequences
- PAYER was funded to 125 test USDT from the founder's 150 (`docs/technical/WALLETS.md` §2b).
- The big city (size M) still waits for the final story (ADR-0049).
- Until the founder's run these stay idle:
  - the Grok zip import and the story swap;
  - the kill (T2);
  - subscribe, cancel, caps and decline (T1);
  - Kimi tuning (T4);
  - the big city;
  - the Submission session.
