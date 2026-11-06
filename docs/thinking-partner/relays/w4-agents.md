# Relay: w4-agents (W4 Agents, the night’s agents session), 00:27 IST, Sat 7 Nov

## In plain words

- **Item 1, done ([#153](https://github.com/Zugzwang-world/graphpay/pull/153)): the deadline is relative.** Vitalik's request says "delivered within an hour". Code reads the hour from the moment of the request, so an errand can buy at any time of day or night. The guard checks each shop's delivery time against that hour when the concierge picks, when the shop quotes, and just before the payer signs.
- **Item 2, done ([#157](https://github.com/Zugzwang-world/graphpay/pull/157)): measuring.** Every agent reports each model call (tokens read and cached, written and reasoning, cost, tools, seconds); `node scripts/agents/site-errand.mjs` runs one live errand on the site and prints the table.
- **Item 3, done: an errand is about 40% faster and about 80% cheaper.** On the site at 00:24 IST it paid in 55.5 s for $0.0269, against 91.4 s and $0.1455 at 23:30. The first cut ([#162](https://github.com/Zugzwang-world/graphpay/pull/162): lower effort, shorter tool replies) saved only 4%, because every model call costs 1.5 to 4 seconds and an errand made 19 of them in a row. The second cut ([#182](https://github.com/Zugzwang-world/graphpay/pull/182), live since 00:22 IST) does the routine steps in code: listing shops, reading catalogs and the graph, quoting, paying and confirming delivery, under the same agents' names, with the same messages and data on the screens. Each model keeps one call for its judgment: the concierge chooses (high effort), the analyst ranks and the risk agent vets the buyer (low). The trap is still vetoed; a lying analyst can no longer steer the choice.
- **Item 4, reliability:** if the concierge's model names no shop, code buys the best eligible one that fits, so an errand never stops after planning while a shop can deliver; a stopped run pays nothing; a read that drops is tried once more. Tonight errands also stopped outside the agents: the payer paused by a visitor, and the shop closed (W5's self-healing now fixes both).

## Technical

| run | where | seconds | model calls | tokens (cached) | USD |
|---|---|---|---|---|---|
| baseline, all models, all high | live site, paid, 23:30 | 91.4 | 19 | 33,287 (14,592) | 0.1455 |
| first cut (#162) | live site, paid, 23:49 | 87.6 | 19 | 33,346 (14,592) | 0.1435 |
| second cut, before merging | local runner, production services, paid, 00:15 | 55.2 | 3 | 2,886 (768) | 0.0247 |
| **second cut (#182)** | **live site, paid, 00:24** | **55.5** | **3** | **2,852 (0)** | **0.0269** |
| second cut | Kimi on mock services, 00:11 | 15.6, 11.7 | 3 | 2,887, 2,839 | 0.027, 0.023 |

Per agent and per call: `docs/sessions/w4-agents/runs/` and OPEN's calibration table. Where the 55.5 s of the 00:24 run went (stream timestamps): the runner's start-up 5 s; the scout and the analyst's reads 2 s; the analyst's call 5.3 s; the concierge's choice 4.4 s; the quote with the risk check 6.5 s (its call 3.3 s); **from "pay order" to the 402, 13.6 s** (the hosted shop writes the quote to Arkiv, and the runner holds its own Arkiv batches around it); the pre-sign checks 1.9 s; **from the signature to "settled", 13.3 s** (our facilitator and the chain); the runner's last Arkiv flush 2.8 s. The two long waits are outside the agents (W3, W5; the Coordinator knows).

- Code mode (`runErrand({ steps: 'code' })`, the default; `'model'` keeps the original flow for the bad-play tests; ADR-0078): `callTool` runs an agent's own traced tool, so `tool.call` and `tool.result` are the same events; code-run agents end with `model: 'code'`. The messages equal the all-model flow's (a test), and the phones' mapper draws the same events. One number changes for the better: the analyst's visible `graphql` call is code's fixed query, so the phones count its real reads (5), where the model's own query asked for "Mumbai" (the graph stores "mumbai") and read nothing.
- The concierge chooses on the offers and code's ranking; a ranked shop the guard refuses (the trap) ends the errand; no choice or an unknown one falls to `bestFit`; an eligible pick that misses the limits too. A no-fit carries its reason, so the phones show the budget card.
- Presets (`story.json` `agentModels`): the concierge at high, every other role at low (ADR-0067 amended).
- The reviewer: ship, no blocking issues; its should-fix items are in #182.
- Tests: 95 pass in `packages/agents`; the workspace suite passes; `pnpm check` is clean.
- Open (OPEN): acceptance E1's old 23:59 deadline; frontend: /customer's "By 23:59" chip and the deck's old request text.

## State

- Holding live errands at W1's request (the shop names flip; W5 restarts the workers), then three live errands in a row on the new names (item 4).
