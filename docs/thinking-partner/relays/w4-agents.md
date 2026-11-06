# Relay: w4-agents (W4 Agents, the night’s agents session), 01:20 IST, Sat 7 Nov

## In plain words

- **The brief is done.** Errands work at any hour, cost about a fifth of what they did, finish in about half the time, and three live errands in a row paid. The screens show the same data.
- **The deadline is relative ([#153](https://github.com/Zugzwang-world/graphpay/pull/153)).** Vitalik's request says "delivered within an hour". Code reads the hour from the moment of the request, so an errand can buy at any time of day or night. The guard checks each shop's delivery time against that hour when the concierge picks, when the shop quotes, and just before the payer signs.
- **Measured ([#157](https://github.com/Zugzwang-world/graphpay/pull/157)).** Every agent reports each model call: tokens read and cached, written and reasoning, cost, tools and seconds. `node scripts/agents/site-errand.mjs` runs one live errand on the site and prints the table.
- **Faster and cheaper ([#162](https://github.com/Zugzwang-world/graphpay/pull/162), [#182](https://github.com/Zugzwang-world/graphpay/pull/182)).** Lower effort and shorter tool replies alone saved 4%: each model call costs 1.5 to 4 seconds, and an errand made 19 of them in a row. So the routine steps now run in code under the same agents' names: listing shops, reading catalogs and the graph, quoting, paying and confirming delivery. Each model keeps one call for its judgment: the concierge chooses the shop (high effort), the analyst ranks by trust and the risk agent vets the buyer (low). The trap is still vetoed, and a lying analyst can no longer steer the choice.
- **Reliable.** If the concierge's model names no shop, code buys the best eligible one that fits, so an errand never stops after planning while a shop can deliver. A dropped read is tried once more, and a stopped run pays nothing. Tonight's other stops came from outside the agents: the payer paused by visitors and the shop's listing lapsing. W5's self-healing now handles both.

## Technical

| run | where | seconds | model calls | tokens | USD |
|---|---|---|---|---|---|
| baseline, every role a model at high | site, paid, 23:30 | 91.4 | 19 | 33,287 | 0.1455 |
| first cut (#162) | site, paid, 23:49 | 87.6 | 19 | 33,346 | 0.1435 |
| routine steps in code (#182) | site, paid, 00:24 | 55.5 | 3 | 2,852 | 0.0269 |
| three in a row, after the name flip | site, paid, 01:16, 01:17, 01:18 | 54.2, 45.4, 42.6 | 3 each | 2,963, 2,995, 2,877 | 0.0293, 0.0270, 0.0247 |

**Average of the three:** 47.4 s (−48%), 3 calls (from 19), about 2,950 tokens (−91%), $0.027 (−81%). Their transactions:

- [0x32bb…6b5e](https://explorer.testnet.whitechain.io/tx/0x32bbd598de36731532da5a3d3927d355aab62b27fcd743d1fd62dc0c09c66b5e)
- [0xdeda…5742](https://explorer.testnet.whitechain.io/tx/0xdedadeb8be1ee53cc6428a845024fd8052c4e734dcc4e844a227410638f15742)
- [0x1285…a238](https://explorer.testnet.whitechain.io/tx/0x128517cae8acca9ac1cc229ddda5fd0ae1a63065788ad487eac24b0e9d80a238)

Per agent and per call: `docs/sessions/w4-agents/runs/` and OPEN's calibration table.

- **Where the time goes now:** the models take 14 to 16 s (the analyst 6 to 7, the concierge 4.5 to 6, the risk agent about 3). The payer's 27 to 37 s is the 402 step (the hosted shop writes the quote to Arkiv; about 13.6 s at 00:24) and the settlement (our facilitator and the chain; about 13.3 s). Both are outside the agents; the Coordinator has the timings.
- **Code mode** (`runErrand({ steps: 'code' })`, the default; ADR-0078). `steps: 'model'` keeps the original flow for the bad-play tests. `callTool` runs an agent's own traced tool, so the run log has the same events. A test shows the messages equal the all-model flow's, and the phones' mapper draws the same events. One number changes for the better: the analyst's visible GraphQL call is code's fixed query, so the phones count its real reads. The model's own query asked for "Mumbai" while the graph stores "mumbai", and found nothing.
- **Presets** (`story.json` `agentModels`, testing, video, live): the concierge at high, every other role at low (ADR-0067 amended).
- **The reviewer:** ship, no blocking issues. Its should-fix items are all in #182: a stopped run pays nothing; a failed model is recorded honestly; a no-fit carries its reason, so the phones show the budget card.
- **Tests:** 95 in `packages/agents`; the workspace suite passes; `pnpm check` is clean.
- **Open (OPEN, frontend):** /customer's "By 23:59" chip and the deck's old request text. Acceptance E1 now reads the span (W5's #188).

## State

- Done. Running nothing; no more live errands unless asked. W5 runs the full acceptance next.
