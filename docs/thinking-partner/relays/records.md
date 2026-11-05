# Relay: records (the Coordinator), 03:10 IST, Fri 6 Nov

## Where we are

Four milestones are on `main`:

| milestone | PR |
|---|---|
| M7a, the Arkiv writer: the generic `@graphpay/arkiv-graph` SDK plus GraphPay's `money-graph` layer | #14, 01:51 IST |
| M1, the checkout contract | #12, 01:51 IST |
| M10, the agents | #11 |
| M2, the USDT checkout deployed, verified and set up on Whitechain Sepolia | #15 |

Also on `main`: Join's mirror core (#8) and T5's website shell and phone views (#10, #13).

In progress:
- M5 ENS (T2), which gates T1's M3 part B and Join's real mirror runs;
- M3 part A (T1);
- the small-city seeding and M7b (T3);
- M11 (Join);
- the website (T5);
- the agent hooks (T4, #16).

**The Mac slept from 02:14 to 03:01 IST** because the lid was closed, and it was on battery. Every session lost about 47 minutes, so CP4 (acceptance) moves to about 06:15 IST.

## What the founder needs to do

| what | where | why |
|---|---|---|
| Plug in the charger and keep the lid open | the Mac | A closed lid always sleeps, and an empty battery stops everything |
| Decide on extra usage with a cap; set the Coordinator to Opus 5.5 at high | Claude account settings; the Coordinator's model menu | The weekly limit is 74% used (03:04) and climbs about 3 points an hour, but resets only at Fri 21:30 IST |
| Send the disclosure if not sent yet; the story brief by 08:30 | Hacker Dashboard; the Coordinator | The rules require the disclosure; rehearsal 1 and the large city need the story |

## Done since 01:20

- PR #9 merged: ADR-0057 (the graph SDK, npm on Friday as item 18), the master plan, the run files and the first relay.
- At 01:22 the six track sessions were switched to the planned models: Sonnet 5.5 at high for T2, T4 and T5; Opus 5.5 at xhigh for T1, T3 and Join.
- Gate messages: M7a to T1, Join and T3; M1 to Join. Join's three writer asks were forwarded to T3 and are all in M7a; its contract asks went to T1 (the ABI export is in M1, the deploy block in M2).
- T3's #14 conflicted with `main` twice. The second time, the cause was everyone appending at the end of `FACTS.md`. Track rows now go under activity headings, in activity order.
- **Fresh starts.** The biggest cost is context size, because each tool call re-reads the whole conversation (T1 and T3 were near 500K tokens). At milestone boundaries each session pushes, writes `docs/sessions/<activity>/resume.md`, clears its conversation and restarts from its run file. T4 went from hundreds of thousands of tokens to 94K. T1, T3, T5 and Join are asked to do the same.

## Usage (from the app's usage card)

| time | percent |
|---|---|
| 01:08 | 70% |
| 01:16 | 71% |
| 01:43 | 72% |
| 01:58 | 73% |
| 03:04 | 74% |

The 03:04 point includes the 47 minutes of sleep. While awake the burn is about 3 points an hour, and the limit resets Fri 21:30 IST. If fresh starts don't bring it down, the next step is one effort level lower on every track session.

## Problems

- **P-records-3:** the sessions started on the wrong model and effort; fixed at 01:22.
- **P-records-4:** the Mac slept with the lid closed; the founder was notified at 03:04.
- **P-records-1:** prompt logs land in the main checkout; the fix is planned.
- **P-records-2:** the venue network to GitHub is slow; retries work.

## Questions for the thinking partner

| question | recommendation |
|---|---|
| Is turning on extra usage with a cap worth the cost? | Yes. A stop before the 18:00 freeze would cost the Friday programme |

## Next

On every tick: start lines after fresh starts, gate messages when M5 merges, stalled auto-merges, and power and usage checks. Records again about 04:45 IST.
