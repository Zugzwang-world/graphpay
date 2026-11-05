# T2 Identity

Activity `identity`; your own worktree; branches `ens/*`. Read `CLAUDE.md` and `planning/README.md`, then each prompt and its inputs.

## Goal and milestones, in order

The ENS namespace under `graphpay.eth` on real Sepolia, then the payment gate, the kill switch and the policy-mirror watcher.

| step | prompt (`planning/PROMPTS/`) | also apply |
|---|---|---|
| M5 namespace | `05-ens-namespace.md` | `docs/plan/amendments/M5-ens.md`, which wins where they differ: ENSIP-26 records, the Whitechain address record, two key-limited setter grants per agent that holds its own wallet, `x-graphpay-accepts` instead of ENSIP-31, `resolvePayee` and `readAccepts`; ADR-0036, ADR-0037, ADR-0038, ADR-0046 |
| M6 gate, kill, watcher | `06-ens-gate-kill-watcher.md` | `M5-ens.md` §3; E-9, E-11 |
| Friday | `docs/plan/MASTER_PLAN.md` §4 | item 6: the demo cast's names through the M5 script, after the story lock; item 17 (ERC-8004, ENSIP-25; ADR-0044) only if time |

## Gates

- M5 needs only M0: OPERATOR and the owner wallets are funded.
- M6 needs M5. Its policy writes need T1's M2 (the real checkout); "the facilitator runs with the real gate" needs T1's M3.
- B8's MCP call waits for T3's M7b; B9 (a)'s payee comparison waits for T1's first settled payment.
- The watcher runs inside Join's workers process (M11), never on Vercel cron: ship it as a library Join hosts.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`, so end yours the same way. Meanwhile build what the gate does not block.

## Owns

`packages/ens`, `scripts/ens`, `docs/sessions/identity/`, including `namespace.md`: the hand-off table (node, epoch, wallet, expiry per agent) that T1's policies and Join's mirror read. In the Coordinator's `packages/config/`, only the `ens` texts, by a PR that says so.

## Acceptance checks

`planning/ACCEPTANCE_TESTS.md` B1–B7, with B1–B4 as amended in `docs/plan/ACCEPTANCE_ADDITIONS.md`; from the additions, B8 (the record reads; its MCP call after M7b), B9 (a) (the address reads), A7, A8. With Join, E7 (the kill). M5 is done when row 9 of `M5-ens.md` §1 holds.

## The specific rules for this session

- Every name comes from `packages/config/story.json` (the test story tonight; ADR-0047), and every address and URL from `packages/config/graphpay.config.json` (ADR-0030).
- The site and MCP URLs use https://graphpay-event.vercel.app (`site.url`, `site.mcpPath`), never `VERCEL_URL`.
- Sepolia gas is about 23 wei, so the real run is clear; still run the prompt's gas check first.
- `provisionDisposable()` makes each new key with `pnpm -s wallet:gen --only DISPOSABLE_<n>` (one role per run). A killed label is never provisioned again.
- The watcher never copies an ENS cap or address into a policy.
- Never cut the live kill switch or the refused cap change (ADR-0053).

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: your next milestone, then your Friday items (before CP4, additive with no-op defaults). Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`identity`**, in each step's PR (skill `relay`): your `identity` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/identity.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Sonnet 5.5 at **high**: well-specified provisioning, mostly real-chain waiting.
