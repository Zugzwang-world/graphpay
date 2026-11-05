# T1 Payments

Activity `payments`; your own worktree; branches `pay/*`. Read `CLAUDE.md` and `planning/README.md`, then each prompt and its inputs.

## Goal and milestones, in order

The checkout contract, our own x402 facilitator and the shop's 402 API, hosted on Vercel, paying in real test USDT.

| step | prompt (`planning/PROMPTS/`) | also apply |
|---|---|---|
| M1 contract, Foundry tests | `01-contract.md` | fork tests on the real test USDT (already in the payer wallets) and Permit2; no stand-in token anywhere (ADR-0054) |
| M2 deploy, verify, set up | `02-deploy-verify.md` | the USDT checkout only |
| M3 facilitator, shop API, recorder | `03-facilitator-shop.md` | `docs/plan/amendments/M5-ens.md` §2 (the payee from ENS; ADR-0046); `docs/plan/amendments/M7-arkiv.md` §5 (quotes). Part B: the lifecycle as `rehearsal.vitalik`, then the qualifying payment once, as `acceptance.vitalik` (C7) |
| M4 hosted on Vercel | `04-hosted-vercel.md` | E-1, E-3 |
| Friday | `docs/plan/MASTER_PLAN.md` §4 item 6 | the demo cast's policies, after the story lock |

## Gates

- M1 needs only M0. Ship its ABI and events early: Join's M11 waits on them.
- M3's recorder routes need T3's M7a (answer 503 until then); its real gate needs T2's M6 (a stub on the fork only).
- M3 part B needs M2, M5 and M6; M4 needs M2, M3 and M6. Policies take node, epoch and expiry from T2's `docs/sessions/identity/namespace.md`; until then, the namehash at epoch 0.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`, so end yours the same way. Meanwhile build what the gate does not block.

## Owns

`packages/{contracts,facilitator,shop}`, `apps/web/app/api/{shop,facilitator,recorder}`, M4's `/api/cron/renew` with its cron entry in `apps/web/vercel.json`, `scripts/whitechain`, `docs/sessions/payments/`. In the Coordinator's `packages/config/`, only `whitechain.contracts`, by a PR that says so.

## Acceptance checks

`planning/ACCEPTANCE_TESTS.md` C1–C7 (C1: the USDT checkout only; C7 is also E3), F2, F3. `docs/plan/ACCEPTANCE_ADDITIONS.md`: the amended C2 (the quote key and the ENS payee read) and F2 (the quote-writing 402 step), B9 (a), D10's quote writes, A7, A8.

## The specific rules for this session

- Prices, products, the renewal plan and every name come from `packages/config/story.json` (ADR-0047). Contract addresses live only in `whitechain.contracts` of `packages/config/graphpay.config.json`, M2's deployment record included: a copy in other code fails A7.
- The lifecycle and rehearsals pay as `rehearsal.vitalik`, never `payer.vitalik` (E-15). Caps reset at 05:30 IST.
- Live events poll over HTTPS (ADR-0055).
- Server secrets go to Vercel as Sensitive values with `pnpm -s secrets:vercel NAME`, never `NEXT_PUBLIC_`. Server-side fetches use https://graphpay-event.vercel.app or relative paths, never `VERCEL_URL`.
- No local script uses the hosted relayer key during the hosted demo.
- Short of time: the renewal is third in ADR-0053's cut order; the real USDT payment is never cut.

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: your next milestone, then your Friday items (before CP4, additive with no-op defaults). Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`payments`**, in each step's PR (skill `relay`): your `payments` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/payments.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Opus 5.5 at **xhigh**: money, contracts and signatures; long unattended work.
