# ADR-0071: The story for the founder's run: Mr. Vitalik stays, the payer's pass is 100 a day, the dosa and BKC swap comes after
Status: accepted · Date: 2026-11-06 12:40 IST · Decided by: founder · Source: the support brief `docs/archive/thinking-partner-briefs/1240-coordinator-integration-support.md`

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

## Amendment (founder, Fri 6 Nov 23:00 IST): the pass is 300 a day for tonight

- **Source:** the W5 Ops brief (`docs/thinking-partner/briefs/2300-w5-ops.md`), from the thinking partner via the founder.
- The payer agent's pass is **300 test USDT a day** for tonight (`story.json` payer `capMicro` 300,000,000), in both places the gate reads, which takes the lower of the two:
  - the on-chain policy: [0x608a…b8fd](https://explorer.testnet.whitechain.io/tx/0x608ae1b6a9e380eee452735f311eaef1ad8ac502ee9b16268bacb1eebc30b8fd) (POLICY_WRITER, Whitechain);
  - the ENS record `graphpay.cap_micro`: [0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc) (VITALIK, Sepolia).
- **Why:** public access lets anyone run an errand (ADR-0069), and the tests, the video and the rehearsal all spend 4.80 each. The old pass had 22 of 100 left at 23:00 IST.
- **Funding:** W5 keeps PAYER topped up from FUNDER and from the shop's takings (`docs/technical/WALLETS.md` §2b).
- Whether the pass returns to 100 after the pitch is the founder's call.
