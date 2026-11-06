# T6 AgentPay

Activity `agentpay`; your own worktree; branches `agentpay/*`. Read `CLAUDE.md`, the founder's brief `docs/archive/thinking-partner-briefs/0325-agentpay-v1.md` (the source of this file), then `docs/sessions/agentpay/resume.md` for where things stand.

## Goal and milestones, in order

`@graphpay/agentpay`: a universal two-sided SDK for agentic USDT payments on Whitechain. Customer agents pay a 402 with one signature and no gas under an on-chain spending pass. Merchants price any route, settle through a facilitator and get paid. It is Whitechain's own lane: it never imports our Arkiv or ENS packages. Identity and reputation plug in through `IdentityResolver` and `ReputationProvider`.

| step | what | state (04:15 IST) |
|---|---|---|
| A1 SDK core | order model (fixed price; pre-authorisation for variable fares is V2), graphpay-order wire, buyer (pass, guards, `pay`, `requestRefund`, `subscribe`, `cancel`), merchant middleware (Fetch and Next, Express, node), events, `refund`, `exportCsv`, the facilitator interface, the reference relayer with anti-drain limits, AI SDK and MCP tools | merged, PR 38 |
| A2 proof | two examples of about 20 lines (sweet shop, fixed-fare ride) on an anvil fork; then one tiny real testnet payment per example, labelled as a test | fork: both pass. Real: sweet shop done (04:00 IST). The ride stays on the fork until a ride merchant is in the cast (the mirror parks unknown actors) |
| A3 docs | `packages/agentpay/README.md`: quickstarts, API reference, how GraphPay uses it | merged |
| A4 T1 adapter | once T1's M3 merges, one fork test of the SDK merchant through T1's facilitator (`httpFacilitator` or `inProcessFacilitator`) | waits for M3 |
| A5 checkpoint | by 08:00 IST: a clean stop with `docs/sessions/agentpay/resume.md` | ongoing |

## Gates

- A4 needs T1's M3: run `gh pr list --state merged --limit 30` and look for a title ending `(M3 done)`. The Coordinator also sends a message when it lands.
- A real ride payment needs the operator in the cast (story, ENS name, mirror actor): that is the Coordinator's call, with T2 and Join.

## Owns

`packages/agentpay`, `examples/agentpay-*`, `docs/sessions/agentpay/`. It also owns, in `packages/config/story.json`, only the `agentpayExamples` section (the Coordinator owns the file).

## Acceptance checks

- `node --test "packages/agentpay/test/*.test.mjs"` green in CI.
- `pnpm --filter @graphpay/agentpay test:fork` green (anvil, public RPC only, keys made per run).
- Each real test payment is in `docs/sessions/agentpay/txlog.jsonl`, with its explorer link, and the order is `PAID` on-chain.

## The specific rules for this session

- Never edit T1's or T4's packages or the contract. Use their public exports; record anything missing in your `OPEN.md` section for its owner.
- Names and prices come from the story config. Addresses come only from the config. Check chain id 1874 before every signature.
- Run the reviewer on any code that signs, sends or holds money. No secrets in code. Do not publish to npm (the founder logs in later).
- Real payments go only to cast actors, with operational test amounts (`agentpayExamples.testAmountMicro`), never during the hosted demo, and never with the hosted relayer key (FACILITATOR). Use RENEWER through the reference relayer.
- Usage (ADR-0062 as amended Fri 11:00 IST): at 95% weekly plan usage, start no new real payment, merge or publish, and write the resume file; at 97%, pause at a clean checkpoint (push, resume, end the turn).

## Unattended rules

1. Keep going: when a step merges, start the next unblocked one.
2. Ask the founder only for logins, funding, secrets or anything irreversible. Otherwise put the question in your `OPEN.md` section, take the safe default and go on.
3. New wallets, top-ups and secrets go through the Coordinator.
4. Small PRs with auto-merge (skill `ship`); push with `git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=60 push`, retrying.

## Thinking-partner update

Activity **`agentpay`**, in each step's PR (skill `relay`): your `agentpay` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/agentpay.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Opus 5.5; the Coordinator sets the effort (medium from 04:15 IST, for the plan budget).
