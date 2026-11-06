# Relay: w4-agents (W4 Agents, the night’s agents session), 23:21 IST, Fri 6 Nov

## In plain words

- **Item 1, done ([#153](https://github.com/Zugzwang-world/graphpay/pull/153)): the deadline is relative.** Vitalik's request says "delivered within an hour" instead of "by 11:59 pm". Code reads the hour from the moment of the request, so an errand can buy at any time of day or night. The old request could not buy between about 23:14 IST and midnight, and after midnight its deadline had passed.
- The guard still checks each shop's delivery time (ETA) against the deadline three times: when the concierge picks a shop, when the shop quotes, and just before the payer signs. The good shop needs 45 minutes, so it fits; with "within 30 minutes" no eligible shop fits and nothing is paid.
- **Item 2, in its PR: measuring.** Each agent now reports every one of its model calls: the tokens it read (and how many came from Kimi's cache), the tokens it wrote (and how many were reasoning), what the call cost, which tools it asked for and, on live runs, how many seconds the model took. One command runs a live errand on the site and prints the table.
- **What the first look found:** on production the analyst reads two answers, the GraphQL ranking and its explain trace, that each carry about 16,800 characters of Arkiv entity keys. The model never uses them (the ranking data itself is 600 characters); the screens and the explainer do. That is the first thing to cut, for the model only.
- Still to come: a live baseline, the cuts, then three live errands in a row that pay.

## Technical

- `packages/agents/src/mandate.mjs`: a clock time ("by 8 pm") or a span ("within", "in" or "under", then "an hour", "half an hour", "45 minutes", "2 hours", "1.5 hrs"; 1 minute to 24 hours). The deadline is the request instant plus the span, floored to the whole minute, so it is never later than the words allow and `deadlineIso` equals `deadlineMs`. A clock time and a different span together, or two different spans, are refused (`MANDATE_AMBIGUOUS_DEADLINE`) before any agent runs. `story.json`: `order.request` only.
- Measuring: `createMeter({ timing })` returns one record per model call (`input`, `cached`, `output`, `reasoning`, `usd`, `tools`, and with timing `seconds` and `toolSeconds`, from AI SDK 7's step `usage` and `performance`); `agent.end` carries `effort`, `calls` and on live runs `seconds`. Timing is on for live runs only, so two mock run logs stay byte-identical. `usageOf(events)` and `usageTable()` add it up; `metrics.usage` has the same. The screens ignore the new fields.
- `scripts/agents/site-errand.mjs`: one errand through the site's POST /api/agents/run as a visitor (no passcode or key read), the stream timestamped, the summary written to `docs/sessions/w4-agents/runs/`.
- MCP reply sizes on production (read-only probe, 23:17 IST): the schema 3,209 characters (also in the analyst's and risk agent's instructions); the ranking GraphQL answer 17,834, of which `extensions.arkiv.entityKeys` 16,868; explain 19,120, of which `entityKeys` 16,800; the buyer-risk table 295.
- Tests on mocks: 75 pass in `packages/agents`, 2 for the script; the whole workspace suite passes; `pnpm check` is clean.
- Open: acceptance E1 still expects the 23:59 deadline (OPEN, the Coordinator); /customer's "By 23:59" chip and the deck's copy of the old request (OPEN, frontend).

## State

- Item 1 merged at 23:18 IST; item 2 in its PR. Next: the live baseline after item 2 deploys, then item 3.
- The payer's pass is 300 test USDT a day tonight (W5, #152); the contract's day turns at 05:30 IST.
