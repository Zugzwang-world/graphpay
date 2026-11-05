# Relay: records (the Coordinator), 05:15 IST, Fri 6 Nov: CP4

## Where we are

**CP4 is met. The core works end to end on the real testnets.** `ACCEPTANCE_REPORT.md` has **31 pass, 0 fail, 1 blocked, 16 not run** (of 48):
- D7, the benchmark at size M, is blocked on purpose: it waits for the founder's locked story.
- Most of the 16 not run need T1's hosted endpoints (M4), plus a few runner scripts that are still being wired.

Done on the real networks:
- **Payments:** the qualifying USDT payment, ENS-gated and gas-free for the payer (C7); the full lifecycle (refund, re-order, over-cap refusal, a revoked agent, the human payer); a subscription that is renewed and cancelled (T1, M3).
- **The real errand** (`e2e:food`), A–E, as the payer agent: 4.80 paid, delivered, 0.80 refunded (Join, M12).
- **The live kill switch** on disposable-1 (F, E7, B6): a 402 9.3 s after the kill, the watcher revoked the policy at 11 s, and the refusal was folded into the graph.
- **The mirror** (M11): 47 events since the deploy, each edge exactly once, through raced replays, a killed send and a hard restart.

## What the founder needs to do

| what | where | why |
|---|---|---|
| Keep the charger in and the lid open | the Mac | Every session and the mirror run on it |
| Send the story brief by 08:30 | the Coordinator | Rehearsal 1 with the demo cast; the large city starts seeding by 14:00 |
| Read the stage passcode from `.env` | your Mac | It unlocks the spending buttons on the site |

## Usage

81% at 05:12 IST. Every session pauses gracefully at 92% (ADR-0062), and Join is already paused until M4 is hosted.

## Next

M4 hosted (T1). Then M13's C and F rows (Join, after the 05:30 IST UTC date change). Then the Friday programme. Records again about 06:45.
