Prepared before the event: research, specs, decisions, prompts and acceptance tests. All code in this repository was written during the hackathon.

# GraphPay handover pack

Everything the pre-event lab learned, packed so that the live build of a brand-new public repo, **`graphpay` under the GitHub account `Zugzwang-world`** (Thursday 5 Nov, 21:00 IST), is fast and correct, with the presentation on Saturday 7 Nov, 09:30 IST.

**This pack hands over knowledge, never code.** It holds specs (behaviour, interface signatures, schemas, event definitions, flows), decisions, verified facts, commands, environment variable names, prompts, acceptance criteria and pitfalls. It holds no implementation code: no function bodies, no contracts, no copied source. All code in the event repo is written during the hackathon (`DISCLOSURE.md`).

GraphPay, "Ask before you pay": AI agents with ENS names pay shops over x402 on Whitechain through our own facilitator; every payment becomes part of a money graph on Arkiv that any agent can ask, with an explain trace of every read, before it pays.

## Read order

1. **This README**, then `DISCLOSURE.md` (the rules of the game) and `PREFLIGHT.md` (the machine, logins, networks and balances checked before the event).
2. `EVENT_ADDENDUM.md`: the approved additions of 5 Nov (Arkiv discovery, locked receipts and expiring activity in M7; ENS agent records, the Whitechain receiving address and key-limited permissions in M5; the Friday items, the Swarm bonus and the UI patterns). Attach it with `PROMPTS/00-foundation.md`; where it differs from a spec below, the addendum is newer.
3. `EVENT_RUNBOOK.md`: hour by hour, the founder's steps, checkpoints, fallbacks.
4. `BUILD_SEQUENCE.md`: milestones, dependencies, worktrees, time per milestone, the critical path.
5. `SPEC/ARCHITECTURE.md`, then the area spec for your track:
   - `SPEC/PAYMENTS_WHITECHAIN.md` (T1)
   - `SPEC/IDENTITY_ENS.md` (T2)
   - `SPEC/ARKIV_GRAPH.md` and `SPEC/BENCHMARK.md` (T3)
   - `SPEC/AGENTS.md` (T4)
   - `SPEC/INTEGRATION_AND_MIRROR.md` (join)
   - `SPEC/SECURITY_AND_OPS.md` (everyone, M0)
   - `WEBSITE_SPEC.md` (T5)
6. `FACTS.md` (every value with source, date, status; rows marked **9 pm** are re-verified in M0), `DECISIONS.md`, `WALLETS.md`.
7. `ACCEPTANCE_TESTS.md` (what "done" means), `PITFALLS.md` (what bit us), `SPONSOR_CHECKLIST.md` (what each prize needs).
8. `PROMPTS/NN-<slug>.md`: one per milestone, used as the session prompt.

## How the 9 pm Claude Code session uses it

1. The founder starts a Claude Code session in an empty folder (`~/graphpay`), attaches `PROMPTS/00-foundation.md` and `EVENT_ADDENDUM.md` and says "go". The rest of the pack is at `~/Downloads/GraphPay-ThinkingPartner/handover/`.
2. M0 checks the event's rules first (deadline, AI use, pre-work), creates the public repo `Zugzwang-world/graphpay`, and **its first content commit copies this whole folder into `planning/`** (reference only; this README becomes `planning/README.md` and starts with the honest line above). From then on, **every path in the prompts (`SPEC/…`, `FACTS.md`, …) resolves against `planning/`**, also inside worktrees.
3. After CP0 the main session starts the parallel sessions (T1–T5 at 21:55, Join at CP1), one worktree each, each with its milestone prompt, model and opening sentence from `EVENT_RUNBOOK.md` §1b.
4. Every session: read the prompt's inputs, build to the spec, test, run the reviewer on money, key and trust code, ship small PRs with auto-merge, keep the event repo's own records current, and say in its notes where it deviated from a spec and why. **Every step ends by updating `docs/thinking-partner/`** (`NOW.md`, `relays/<activity>.md`, `LOG.md`, `OPEN.md`, and `briefs/` for any brief received) in the same PR as its work; the convention is in `PROMPTS/00-foundation.md`.
5. Specs win over memory; verified facts win over specs; anything marked "untested" or "re-verify" is checked before it is relied on. If the lab's evidence and a spec disagree, follow the evidence and record the change as an ADR.
6. `pnpm acceptance` (M13) is the definition of done for the core; the website, the demo store and the sponsor files follow.

## Pack contents

| file | what |
|---|---|
| `EVENT_ADDENDUM.md` | the approved additions of 5 Nov: parts A (Arkiv), B (ENS), C (Swarm bonus), D (UI patterns), E (placement and records), with their acceptance checks; items marked UNVERIFIED are checked before use |
| `EVENT_RUNBOOK.md` | Thu 21:00 → Sat 09:30: Claude's work, the founder's steps (what, where), checkpoints, fallbacks |
| `BUILD_SEQUENCE.md` | milestones M0–M17, dependency graph, worktree plan, estimates from lab timings, model per milestone, the critical path |
| `PROMPTS/` | 19 milestone prompts (00 to 17, with 07a and 07b): goal, inputs, exact prompt, done-when checks, time, pitfalls |
| `SPEC/` | ARCHITECTURE, IDENTITY_ENS, PAYMENTS_WHITECHAIN, ARKIV_GRAPH, AGENTS, INTEGRATION_AND_MIRROR, SECURITY_AND_OPS, BENCHMARK |
| `FACTS.md` | every verified value with source, date, status and a re-verify flag |
| `DECISIONS.md` | ADR-0001…0023 to adopt (one line plus reason each), the event decisions E-1…E-15, and the founder's pre-event decisions F-1…F-5 |
| `WALLETS.md` | roles (FUNDER and OPERATOR carried over, every other role fresh at the event), funding plan from FUNDER, safety floors, the lab wallets not used at the event |
| `PREFLIGHT.md` | tool versions, logins, Arkiv key, RPCs and balances checked before the event, and the founder steps still open |
| `ACCEPTANCE_TESTS.md` | the replication suite A–F, with pass criteria, lab values and tolerances |
| `SPONSOR_CHECKLIST.md` | per sponsor: qualification rules, required files, demo moments |
| `WEBSITE_SPEC.md` | the founder's design, written in full |
| `DISCLOSURE.md` | the README line, the `planning/` line and the `AI_USAGE.md` outline |
| `PITFALLS.md` | the lab's top problems (40) and the pre-event final pass's (41–44), with how to avoid them |

## What the lab proved, in one table

| area | proven | on |
|---|---|---|
| payments | gasless agent payment (312k gas), replay, refunds, re-order, recorded failures, subscription create, renew and cancel, Blockscout verification, one payment through a public Vercel URL | real Whitechain Sepolia, with a labelled stand-in token |
| identity | the full namespace pattern (4 owners, 13 agents, own resolvers, scoped roles, wildcard), the gate, the kill switch and its traps | real Ethereum Sepolia (lab root) |
| memory | write cost (0.00031 tGLM per money event), idempotency (salted creates duplicate), request limits, ORDER BY at scale, two synthetic cities, a live benchmark (Q2 at M: 2 calls and 0.65 s against 48 calls and 1.17 s) | real Arkiv Rabdi |
| agents and integration | the whole errand on Claude Haiku through real x402, the real ENS gate and Graph Arkiv over MCP, 6 of 6 assertions | Whitechain fork, Arkiv emulator, real Sepolia |
| **not proven** | a payment in the real test USDT (none obtainable); the mirror writing live to Rabdi; the one-command run on real Whitechain; the website; the checkout kit and demo store | — |

## Ground rules (from the lab's `CLAUDE.md`)

Testnets only. Never read, print or commit secrets; generate keys by script and print addresses only; only FUNDER and OPERATOR come from the lab, every other wallet is new. Only operate on resources named `graphpay` or `graphpay-*` (repos `graphpay` and `graphpay-lab`; Vercel projects `graphpay-event`, `graphpay-store`, `graphpay-lab`). No off-chain database: state lives on the Whitechain contract and Arkiv; Vercel only runs code. No lab code in the event repo. Never guess versions, addresses, chain ids or API names. Synthetic data is always labelled. No invented numbers. Say "tallies", never "rollups".
