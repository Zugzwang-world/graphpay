# M17 — Sponsor files, README, AI usage, video and submission

**Goal:** everything a judge or sponsor reads is in the repo, true and linked; the video is recorded from the website; the submission is in before the deadline.
**Depends on:** M13, M15, M16. **Session:** main. **Model:** Sonnet High. **Time:** Friday daytime.

## Inputs
`SPONSOR_CHECKLIST.md` (all), `DISCLOSURE.md`, `ACCEPTANCE_REPORT.md` (event repo), `SPEC/BENCHMARK.md` §5, `WEBSITE_SPEC.md` §11.

## Prompt
> Using `planning/SPONSOR_CHECKLIST.md`, write every required sponsor file with content from this repo's own measurements only (no lab numbers): the Arkiv files, `WHITECHAIN_FEEDBACK.md`, the ENS section of the README, `AI_USAGE.md` (outline in `planning/DISCLOSURE.md`), and the README: one-line pitch, the disclosure line, architecture, the live URLs, the contract addresses with explorer links, the qualifying USDT payment link, the writer wallets with one runnable Arkiv query, the benchmark headline with "synthetic data" and the city size, how to run it, and the ~20-line checkout integration. Check every link. Then produce the shot list and narration for the 2–4 minute video from `WEBSITE_SPEC.md` §11, and the submission-day checklist table from `SPONSOR_CHECKLIST.md`, marked done or not with evidence.

## Done when
- Every row of the submission checklist is done with a link, or listed as a founder action.
- The founder has recorded the video and submitted.

## Pitfalls
Never claim a win at small sizes or fewer reads on traversals; label synthetic data; say "known by name, not by data" (pseudonymous, never "private" or "anonymous"); the stand-in is never called USDT.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`submission`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `submission` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/submission.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `submission` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `submission` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
