# Relay: records (the Coordinator), 08:30 IST, Fri 6 Nov: the morning relay

## Where we are

**The core is complete on the real networks.** `ACCEPTANCE_REPORT.md` has **42 pass, 0 fail, 1 blocked, 5 not run** (of 48):
- D7, the benchmark at size M, is blocked: it waits for the locked story.
- The 5 not run wait on other tracks: B7 (T2's re-registration fork test), F3 (T1's preview with the relayer floor raised), F1, D10 and B9.

| milestone | status | PRs |
|---|---|---|
| M4 | live on https://graphpay-event.vercel.app: the hosted facilitator, shop, recorder and renewal cron | #58, #62 |
| M11–M13 | done: the mirror, the real errand, the hosted acceptance run | — |
| C4(a) | passed: the scout's policy revoked, the refusal recorded, the policy restored and read back | #67 |
| M16 | the checkout kit and demo store, proved with one real kit payment | #51, #63 |

Merged Friday items:
- 1: the open, online and handoff rows;
- 2 and 3: the agent hooks and the live hooks;
- 8: race mode;
- 9: the Open toggle;
- 10: the Mumbai map;
- 13: the explainer lanes;
- the phones' Pause/Resume and merchant actions.

Plan usage has held at **82%** since 05:31: the sessions have been idle overnight, waiting for the founder. Nothing has changed since 06:55 apart from the time.

## What the founder needs to do at 08:30

| what | where | why |
|---|---|---|
| Send the story brief | the Coordinator | Rehearsal 1 with the demo cast; the large city must start seeding by 14:00 |
| Type anything in the Coordinator session | this app | The app caps the Coordinator's messages until you type, so idle sessions (T5 first) can't be woken |
| Choose where the remaining budget goes | the Coordinator | 82% now; everything pauses at 92% (ADR-0062); the reset is at 21:30 |
| Read the stage passcode from `.env` | your Mac | It unlocks the spending buttons |

## A plan for the remaining budget (the Coordinator's recommendation)

There are about 10 points until the 92% pause. With two or three sessions working, that's roughly 3–4 hours. In order:
1. **The story swap and the demo cast** (item 6): T2 names, T1 policies, the mirror's bootstrap, T3's `shop` rows. Then the size-M seeding by 14:00, which is a script and costs little plan budget.
2. **Both phone views** (items 11–12, never cut): T5 after a fresh start.
3. **Rehearsal 1** at 12:00 with the founder.
4. **The `arkiv/` files** (item 15) and **the sponsor files** (M17 from 13:00, Submission session).
5. After the 21:30 reset: the video, rehearsal 2, the npm publish (item 18) and any polish.

Cut first if short: Swarm, the map heartbeats, then the npm publish.

## Problems

- Session clocks drift: messages said 08:50 and 06:15 at 05:15 and 04:23. The records use `date`.
- The app's message cap: after 10 automatic cross-session messages the Coordinator is paused until the founder types. Replies on a peer's own channel still work.
- A GitHub push fault (04:52–04:56) cleared by itself.
- The thinking-partner folder: now about 22,200 words after the roll-up. T5's `relays/website.md` (3,000 words against the 800 guideline) is the rest, and T5 trims it at its next relay.

## Next

The 08:30 morning relay, the story brief, and the graphpay-store Vercel project for the demo store.
