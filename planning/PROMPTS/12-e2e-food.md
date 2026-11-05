# M12 — `pnpm e2e:food`: one purchase through every layer

**Goal:** one command runs Vitalik's errand through agents → ENS gate → 402 → facilitator → checkout → mirror → Arkiv → GraphQL, first on a Whitechain fork with ArkivSim, then on the real networks, and checks it with assertions A–F.
**Depends on:** M3, M6, M7b, M10, M11. **Worktree:** `wt-join` (`join/e2e`). **Model:** Opus High. **Time:** 90–120 min (lab: about 70 min for the fork version with two reviewer passes; the real-network mode is new).

## Inputs
`SPEC/INTEGRATION_AND_MIRROR.md` (all), `SPEC/AGENTS.md` §9, §11, `ACCEPTANCE_TESTS.md` §E.

## Prompt
> In `integration/`, write the live clients the agents need behind their interfaces (`planning/SPEC/AGENTS.md` §11: MCP to Graph Arkiv, hooks for ENS, directory, catalog and x402 signing, the shop gateway with storefront, risk and dispatch in front of the real shop API) and `pnpm e2e:food` with the start order of `SPEC/INTEGRATION_AND_MIRROR.md` §4 and the assertions of §5.
>
> `E2E_NETWORK=fork` (default for CI-like rehearsal): anvil fork of Whitechain, throwaway keys passed only to child processes, deploy, policies, ArkivSim, ENS reads on real Sepolia, `E2E_KILL=skip` or real. `E2E_NETWORK=real`: no deploy; the deployed checkout, the funded role keys through the env loader, the hosted or local facilitator and shop, the mirror on Rabdi (`CONFIRMATIONS=2`, history at 0.05 scale with assertion D scaled), receipts labelled `WHITECHAIN`, stand-in labelled. Assertion F kills a fresh disposable agent (provision one first if the current label is already killed) and expects the refusal within the 20 s cache.
>
> Write the readable transcript and the `graphpay.integration-run/v1` run file (agents' run log, chain events with explorer links, mirror writes, GraphQL answers with explain ids, the kill, the assertions). Order: `E2E_MODEL=mock E2E_KILL=skip` on the fork until A–E pass; then Haiku on the fork with the kill; then real mode with `E2E_BUYER=rehearsal` until it passes; then the one counting real run. Mind the daily cap (`SPEC/INTEGRATION_AND_MIRROR.md` §6): `E2E_BUYER=rehearsal` for every rehearsal; the one real-mode run that counts for CP3 uses `E2E_BUYER=payer` (`payer.vitalik`, untouched in this UTC day because M2 and the rehearsals paid as `rehearsal.vitalik`). A second errand by one agent the same UTC day is refused. Use the running workers process (M11) as the mirror in real mode; never start a second one. Reviewer pass on the live payer path (sign exactly what you checked; an unclear settlement is not a failure). Ship.

## Done when
- Fork: A–F pass on Haiku.
- Real: A–F pass with WHITECHAIN receipts, the mirror on Rabdi, and the refusal of a freshly killed agent; transcript and run file committed.

## Pitfalls
`SPEC/INTEGRATION_AND_MIRROR.md` §8; a cached chain head and a sync race made the lab's first dry runs fail 3 of 6; read the cast 6 names at a time; never run the hosted relayer key from this process while the website demo is in use.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`integration`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `integration` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/integration.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `integration` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `integration` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
