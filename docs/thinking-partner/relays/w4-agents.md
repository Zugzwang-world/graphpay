# Relay: w4-agents (W4 Agents, the night’s agents session), 23:52 IST, Fri 6 Nov

## In plain words

- **Item 1, done ([#153](https://github.com/Zugzwang-world/graphpay/pull/153)): the deadline is relative.** Vitalik's request says "delivered within an hour". Code reads the hour from the moment of the request, so an errand can buy at any time of day or night. The guard checks each shop's delivery time against that hour when the concierge picks, when the shop quotes, and just before the payer signs.
- **Item 2, done ([#157](https://github.com/Zugzwang-world/graphpay/pull/157)): measuring.** Every agent reports each model call: tokens read (and cached), tokens written (and reasoning), cost, tools and seconds. `node scripts/agents/site-errand.mjs` runs one live errand on the site and prints the table.
- **Item 3, first cut, done ([#162](https://github.com/Zugzwang-world/graphpay/pull/162)):** lower effort for the routine agents and shorter tool replies for the models. Live it saved only 4%: every model call costs 1.5 to 4 seconds even at low effort, and an errand made 19 of them, one after another.
- **Item 3, second cut (in its PR): the routine steps in code.** Listing shops, reading catalogs, running the graph query, quoting, paying and confirming delivery are now code, under the same agents' names, with the same messages and data on the screens. Each model keeps one call for its judgment: the concierge chooses the shop (high effort), the analyst ranks by trust and the risk agent vets the buyer (low effort). 3 calls instead of 19. The trap is still vetoed; a lying analyst can no longer steer the choice; and if the concierge's model names no shop, code buys the best eligible one that fits, so an errand never stops after planning while a shop can deliver.

## Technical

| run | where | seconds | model calls | tokens (cached) | USD |
|---|---|---|---|---|---|
| baseline, all high | live site, paid | 91.4 | 19 | 33,287 (14,592) | 0.1455 |
| first cut (#162) | live site, paid | 87.6 | 19 | 33,346 (14,592) | 0.1435 |
| code mode, analyst high | Kimi on mock services ×2 | 18.2, 27.4 | 3 | 3,352, 4,396 | 0.036, 0.053 |
| code mode, analyst low | Kimi on mock services ×2 | 13.8, 14.3 | 3 | 2,927, 3,043 | 0.027 |

Mock services pay nothing on chain and answer at once, so the live errand adds the reads, the quote write, the signature and the settlement (about 30 s in the baseline). Per agent and per call: `docs/sessions/w4-agents/runs/`.

- Baseline critical path: concierge, then the analyst (16.7 s of model time), then the payer waiting on the shop (risk 12.3 s, storefront 4.9 s), the 402, the checks, the signature and the settlement, then dispatch (5.5 s), then the payer and the concierge again.
- Code mode (`runErrand({ steps: 'code' })`, the default; `'model'` keeps the original flow for the bad-play tests): `callTool` runs an agent's own traced tool, so `tool.call` and `tool.result` are the same events; code-run agents end with `model: 'code'` and no calls. The analyst's visible `graphql` call is now code's fixed query, the one ranking read (it was read twice before). The phones' read count therefore shows the real 5 reads: the analyst model's own query asked for "Mumbai" while the graph stores "mumbai", and found nothing.
- The concierge chooses on the offers and code's ranking; a ranked shop the guard refuses (the trap) still ends the errand. `bestFit` (in `src/state.mjs`) is code's rule when the model names no shop of the ranking.
- Presets (`story.json` `agentModels`, testing, video, live): the concierge at high, every other role at low.
- Tests: 89 pass in `packages/agents`, among them that the messages equal the all-model flow's; the workspace suite passes; `pnpm check` is clean. The reviewer runs on it before it merges.
- Open (OPEN): acceptance E1 expects the old 23:59 deadline (the Coordinator); frontend: /customer's "By 23:59" chip and the deck's copy of the old request.

## State

- Second cut in review. Next: deploy, three live errands in a row that pay, then the final numbers here.
