# M14 — Records and relay

**Goal:** the event repo's records match reality, and the thinking partner gets a relay that stands on its own.
**Depends on:** M13 (run it after any milestone too, or every 2 hours). **Session:** main. **Model:** Opus High. **Time:** 20–30 min.

## Inputs
The event repo's `docs/` records; `README.md` of this pack (the relay rules); `ACCEPTANCE_REPORT.md`.

## Prompt
> Sweep the records: `docs/plan/MASTER_PLAN.md` current; the top summaries of `docs/thinking-partner/NOW.md` and `OPEN.md` rewritten from every activity's section; `LOG.md` rolled up (keep the last 60 lines, older ones in a dated summary at the top); an ADR for every decision taken tonight (including the `DECISIONS.md` E-items adopted or overturned); `PROBLEM_LOG.md` entries (date, area, exact error, root cause, fix PR, prevention); `FACTS.md` and `VERSIONS.md` rows for everything verified tonight with source and date; the founder's to-dos in `docs/thinking-partner/OPEN.md` closed or updated; `AI_USAGE.md` updated with the sessions and models used. Then write the relay to `docs/thinking-partner/relays/records.md` (the thinking partner reads this folder), and also overwrite `THINKING_PARTNER_RELAY.md` with the same text and copy it to `~/Desktop/GraphPay-Relay.md` and `~/Downloads/GraphPay-ThinkingPartner/relays/EVENT-<HHMM>.md`. Check the whole `docs/thinking-partner/` folder: `NOW.md` current, `LOG.md` rolled to 60 lines, `OPEN.md` closed or updated, under about 20,000 words, secret scan clean. Plain language first: where we are, milestone status, what was done (PR links), what was learned (facts and numbers with sources), decisions, problems and fixes, founder actions needed (table: what, where, why), questions for the thinking partner (table with your recommendation), the proposed next step. Under 2 pages; link to repo files for depth. Ship as a docs PR.

## Done when
- The relay is under 2 pages, every number has a source, and synthetic data is labelled.
- The docs PR is merged.

## Pitfalls
Names only for secrets. Say "tallies". Do not quote lab numbers as event numbers.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`records`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `records` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/records.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `records` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `records` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
