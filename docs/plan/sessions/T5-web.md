# T5 Web

Activity `website`; your own worktree; branches `web/*`. Read `CLAUDE.md` and `planning/README.md`, then each prompt and its inputs.

## Goal and milestones, in order

The founder's website (two phones, the explainer, race mode) on real data; then the checkout kit and the separate demo store.

| step | prompt (`planning/PROMPTS/`) | also apply |
|---|---|---|
| M15 website | `15-website.md`, to `planning/WEBSITE_SPEC.md` | the shell first in `apps/web` (a placeholder page exists), then each panel wired live as its route lands; ADR-0042, ADR-0052, ADR-0055 |
| M16 checkout kit, demo store | `16-checkout-kit-store.md` | the Operate drop-in is a short code snippet in the separate `graphpay-store` app (ADR-0032; E-12) |
| Friday | `docs/plan/MASTER_PLAN.md` §4 | items 8 (race reads), 9 (the Open toggle), 10 (the Mumbai map; ADR-0050), 11 (the customer's phone), 12 (the merchant's phone), 13 (explainer lanes) |

## Gates

- The shell needs only M0. Wire each panel as its route merges: T1's M4 (shop, facilitator), T2's M6 (pause), T3's M7b (GraphQL, explain) and M9 (race), T4's M10 and Join's M11–M12 (agents, mirror). M16 needs M4.
- Friday items follow the "depends on" column of `MASTER_PLAN.md` §4: items 7–9 before rehearsal 1 (12:00), items 10–13 before the 18:00 freeze.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`, so end yours the same way. Meanwhile build what the gate does not block.

## Owns

`apps/web`: the pages and the routes of `WEBSITE_SPEC.md` §7 (agents, state, customer, merchant, race, status), but not T1's `/api/{shop,facilitator,recorder}` and `/api/cron/renew` or T3's `/api/{graphql,explain,mcp}`. Also `packages/checkout-kit`, `apps/store`, `docs/sessions/website/`.

## Acceptance checks

`WEBSITE_SPEC.md` §13 on the production URL (its stand-in line is moot: everything is test USDT, ADR-0054); `planning/ACCEPTANCE_TESTS.md` F2, amended for the Open toggle; on Friday, D11, D12 and D13 of `docs/plan/ACCEPTANCE_ADDITIONS.md`; A8; M16's done-when; CP5.

## The specific rules for this session

- Every name, product, price, location and demo step comes from `packages/config/story.json` (ADR-0047).
- The demo link, both phone views and every QR code use https://graphpay-event.vercel.app, never `VERCEL_URL`. QR codes are HTTPS links, never EIP-681.
- Live events poll over HTTPS (ADR-0055); agent events stream over SSE.
- Race mode shows reads, not speed (ADR-0042): each side's reads tick per call; no timer is the result (this replaces M15's "live timers").
- Wording per ADR-0052: "decentralized, secure and verifiable"; receipts "cannot be edited"; never "hidden" or "permanent". Synthetic data is labelled.
- Every spending or owner action is server-side behind the passcode (`WEBSITE_SPEC.md` §7); the shipped site has no fake path.
- Short of time: map heartbeats are second in ADR-0053's cut order; both phone views and the race are never cut.

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: your next milestone, then your Friday items (before CP4, additive with no-op defaults). Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`website`**, in each step's PR (skill `relay`): your `website` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/website.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Sonnet 5.5 at **high**: screens to a written spec; wiring as routes land.
