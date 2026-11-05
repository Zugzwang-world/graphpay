# M13 — `pnpm acceptance` on the real networks

**Goal:** one command runs the replication acceptance suite and writes `ACCEPTANCE_REPORT.md` with every result, transaction hash and explorer link, including the qualifying payment in test USDT.
**Depends on:** M4, M9, M12 (and, for C7 and E3, the one USDT payment made by `usdt-ready --go --yes` in M3 part B; acceptance reads it and never pays in USDT). **Worktree:** `wt-join` (`join/acceptance`). **Model:** Opus High. **Time:** 60–90 min.

## Inputs
`ACCEPTANCE_TESTS.md` (all), `SPEC/BENCHMARK.md` §4, `SPEC/INTEGRATION_AND_MIRROR.md` §5–§6, `WALLETS.md` §4.

## Prompt
> In `acceptance/`, implement every test in `planning/ACCEPTANCE_TESTS.md` (A1–F3) as a numbered check with exactly the pass criteria written there, and `pnpm acceptance` to run them in order on the real networks. Each check records: id, what it checks, pass or fail, measured values next to the expected ones with the tolerance, and evidence (tx hashes with explorer links, explain ids, CSV rows, HTTP statuses). Checks that need a one-shot resource (a disposable agent to kill, a re-registration) create it first and say so. Checks that cannot run (for example C7 without test USDT) report `blocked` with the reason, never `pass`.
>
> Pay as `acceptance.vitalik.graphpay.eth` (provisioned in M5 with its own wallet ACCEPTANCE_PAYER, policy 6.00/day in M2) wherever a check pays, so the stage payer stays fresh; budget the checks within its 6.00 (4.80 + 1.20 at most per UTC day, plus small 0.40 payments from disposable agents and the human payer). `pnpm acceptance --only C,D` runs a subset; `--dry-run` prints the plan and the expected spend (WBT, tGLM, Sepolia ETH, token) and sends nothing. Write `ACCEPTANCE_REPORT.md` (summary table first, then one section per check) and commit it. Ship.

## Done when
- `ACCEPTANCE_REPORT.md` committed with every check `pass`, or `blocked` with a named external reason. Only three checks may be blocked: C7 and E3 (no test USDT) and D7 (the M city not seeded).
- The qualifying USDT payment's explorer link is in the report and in the README (when USDT exists).

## Pitfalls
Run time is dominated by Sepolia (about 12 s per transaction) and Rabdi (5–8 s per write): about 15–25 minutes for a full run. Do not run while the website demo is live (relayer nonces). A kill is one-shot per label. Re-run D6 after a warm-up; the venue network may differ from the lab's.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`integration`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `integration` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/integration.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `integration` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `integration` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
