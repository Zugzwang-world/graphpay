# Relay: records (the Coordinator), 04:45 IST, Fri 6 Nov

## Where we are

**GraphPay's first real payment is on-chain (04:14 IST).** T1 sent 4.80 test USDT from `acceptance.vitalik.graphpay.eth` to `kesar-kingdom.graphpay.eth` through our own x402 facilitator on Whitechain Sepolia. T2's ENS gate checked the agent first, the payee came from ENS, and the payer paid no gas ([the transaction](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00)). T1 then ran the whole lifecycle on the real chain:
- refund, re-order, an over-cap refusal and a revoked agent;
- a payment by the human persona;
- a subscription that is renewed by RENEWER and cancelled by signature.

Merged since 03:10:

| milestone | PRs | what |
|---|---|---|
| M3 | #42, #45 | the facilitator, the shop's 402 API, the recorder |
| M5 | #18 | the ENS namespace |
| M6 | #34, #40 | the gate and the watcher |
| M7b and M8 | #21 | the engine and the small city on Rabdi |
| M9 | #31 | 2 reads against 5, every answer right |
| M11 | #20, #33, #46 | the mirror, live since 03:13 |

Also merged: T6's AgentPay SDK, with its own first real gasless payment (#38, #41), and T5's race mode, the Open toggle, and Pause/Resume with live customer state (#36, #39, #43, #44). **The first acceptance report** (#46) has 18 pass, 0 fail, 1 blocked and 29 not yet run. Join is running the real `e2e:food` now, so CP4 is expected about 06:15.

## What the founder needs to do

| what | where | why |
|---|---|---|
| Keep the charger in and the lid open | the Mac | A closed lid sleeps everything (02:14–03:01 tonight) |
| Send the story brief by 08:30 | the Coordinator | Rehearsal 1 with the demo cast; the large city must start seeding by 14:00 |
| Optional: set the Coordinator to Opus 5.5 high | its model menu | A session cannot change its own effort |
| Optional: claim the npm organisation `graphpay` | npmjs.com | For Friday's `@graphpay/arkiv-graph` publish |
| Read the stage passcode from `.env` yourself | your Mac | `DEMO_PASSCODE` unlocks the spending buttons on the site; it is never shown in chat |

## Decisions

- **ADR-0062 (the founder, 04:15):** every session pauses gracefully at 92% of the weekly limit, and extra usage stays off. At about 04:20 every track session was set to high.
- **ADR-0061:** the Swarm menu goes through the public gateway (nothing signed or spent). The refund evidence is encrypted client-side and done last.
- **The checkout kit (M16)** is a thin layer over `@graphpay/agentpay`, using public exports only.

## Usage (the app's usage card)

| time | percent |
|---|---|
| 03:04 | 74% |
| 03:36 | 76% |
| 03:56 | 78% |
| 04:12–04:33 | 79% |

The burn slowed after the step-downs and the fresh starts. At 92% the Coordinator confirms every session has paused, notifies the founder and stops ticking. The mirror keeps running.

## Problems and fixes

- **The funding run:** it topped up five roles, not just RENEWER. The dry run had been read through a filter, and the real run's output was cut short with `head`. A fresh dry run showed every role at target and nothing in flight. Lesson: read the whole dry run, and never pipe a real run.
- **Session clocks:** some sessions misreport the time in their messages (06:15 and 04:52 at 04:23 and 04:31). The records use `date`.

## Wallets and secrets

- **RENEWER's second use:** the relayer for T6's real SDK payment.
- **Top-ups:** DEPLOYER, RENEWER, POLICY_WRITER and both small shops are back at their targets (`docs/technical/WALLETS.md` §2b). FUNDER keeps 2.618 WBT, 0.275 Sepolia ETH and 15.08 tGLM.
- **Vercel Production, Sensitive:** `W_DIRECTORY_PRIVATE_KEY` (the Open toggle), `VITALIK_PRIVATE_KEY` (Pause/Resume) and `DEMO_PASSCODE`, all through `pnpm -s secrets:vercel`. They take effect with the next deployment.

## Questions for the thinking partner

| question | recommendation |
|---|---|
| Should the 8% held back at 92% go to Friday's rehearsal and the video, or to more building? | Rehearsal 1 and the story swap first: they need the founder awake, and the reset at 21:30 brings full budget for the evening |

## Next

- CP4's relay as soon as the acceptance report is complete.
- Tell T1 when Join's `e2e:food` is done, so FACILITATOR is free again.
- The founder's story brief at 08:30.
- Records again about 06:45.
