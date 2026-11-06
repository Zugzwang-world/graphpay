# Relay: w4-agents (W4 Agents, the night's agents session), 23:25 IST, Fri 6 Nov

## In plain words

- **The deadline is now relative.** Vitalik's request says "delivered within an hour" instead of "by 11:59 pm". Code reads the hour from the moment of the request, so an errand can buy at any time of day or night: the old request could not buy between about 23:14 IST and midnight, and after midnight its deadline had passed.
- The guard still checks each shop's delivery time (ETA) against the deadline, three times: when the concierge picks a shop, when the shop quotes, and just before the payer signs. The good shop needs 45 minutes, so it fits; with "within 30 minutes" no eligible shop fits and nothing is paid.
- Still to come tonight: measure every model call of a live errand, make errands cheaper and faster without changing the screens, then three live errands in a row that pay.

## Technical

- `packages/agents/src/mandate.mjs`: besides a clock time ("by 8 pm", "by 20:00"), the request may give a span: "within", "in" or "under", then "an hour", "half an hour", "45 minutes", "2 hours", "1.5 hrs" (1 minute to 24 hours). The deadline is the request instant plus the span, floored to the whole minute, so it is never later than the words allow and `deadlineIso` equals `deadlineMs` exactly. A clock time and a different span together, or two different spans, are ambiguous and refused (`MANDATE_AMBIGUOUS_DEADLINE`); no agent runs.
- `packages/config/story.json`: `order.request` only. `order.deadlineLocal` (23:59) is not mine and still feeds /customer's chip (OPEN, frontend).
- Tests on mocks: 73 pass in `packages/agents` (the story errand pays at 23:50, 23:59 and 03:00 IST; "within 30 minutes" refuses `MISSES_DEADLINE`, nothing signed); the whole workspace suite passes; `pnpm check` is clean.
- Not changed: the screens, the prompts, the guards' order, the payment path.

## State

- Item 1 in its PR. Next: item 2, per-call measurement in the run log.
- The payer's pass is 300 test USDT a day tonight (W5, #152); the contract's day turns at 05:30 IST.
