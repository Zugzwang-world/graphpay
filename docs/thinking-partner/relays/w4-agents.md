# Relay: w4-agents (W4 Agents, the night’s agents session), 23:35 IST, Fri 6 Nov

## In plain words

- **Item 1, done ([#153](https://github.com/Zugzwang-world/graphpay/pull/153), 23:18 IST): the deadline is relative.** Vitalik's request says "delivered within an hour". Code reads the hour from the moment of the request, so an errand can buy at any time of day or night. The guard checks each shop's delivery time against that hour three times: when the concierge picks, when the shop quotes, and just before the payer signs.
- **Item 2, done ([#157](https://github.com/Zugzwang-world/graphpay/pull/157), 23:26 IST): measuring.** Each agent reports every model call: tokens read (and how many came from Kimi's cache), tokens written (and how many were reasoning), its cost, its tools and its seconds. `node scripts/agents/site-errand.mjs` runs one live errand on the site and prints the table.
- **The baseline, live on the site at 23:30 IST:** paid 4.80 to the good shop in **91.4 s**, with **19 model calls, 33,287 tokens and $0.1455**. 62.6 s of it was the models thinking; the rest was reads, the quote, the signature and the settlement.
- **Item 3, first cut (in its PR):** the five routine agents (scout, payer, storefront, dispatch, risk) think at Kimi's low effort, while the concierge and the analyst stay at high; the models read short tool replies; and the concierge is handed the budget and deadline that code read, so it does no date arithmetic. The screens get exactly the same data as before. Next: measure it live, then do the routine steps in code.

## Technical

- Baseline per agent (live preset, all at high; `docs/sessions/w4-agents/runs/2026-11-06T18-00-33-601Z-paid.json`):

| agent | calls | in (cached) | out (reasoning) | model s | USD |
|---|---|---|---|---|---|
| concierge | 3 | 4,977 (2,816) | 849 (458) | 10.4 | 0.026 |
| scout | 3 | 2,763 (1,280) | 504 (115) | 6.8 | 0.016 |
| analyst | 3 | 7,413 (4,352) | 1,074 (774) | 16.7 | 0.035 |
| risk | 3 | 9,127 (4,352) | 903 (482) | 12.3 | 0.038 |
| storefront | 2 | 1,109 (256) | 272 (135) | 4.9 | 0.009 |
| payer | 3 | 2,300 (1,024) | 285 (123) | 6.0 | 0.011 |
| dispatch | 2 | 1,361 (512) | 350 (100) | 5.5 | 0.011 |
| errand | 19 | 29,050 (14,592) | 4,237 (2,187) | 62.6 | 0.146 |

- Where the time goes: the critical path is concierge → analyst (16.7 s) → concierge → payer → shop (risk 12.3 s + storefront 4.9 s) → 402, checks, signature and settlement → dispatch (5.5 s) → payer → concierge. Every one of those agents waits on the next.
- Found: the analyst's own GraphQL query asked for city "Mumbai" while the graph stores "mumbai", so its visible read returned no shops; code's fixed query did the ranking, as designed (G2). The risk agent's second query returned 4,502 characters, mostly Arkiv entity keys.
- Short tool replies: `tracedMcpTools` gives each MCP tool a `toModelOutput`: a graph answer becomes its data, errors and `{ explainId, calls }`, an explain trace its counts; the run log keeps the whole answer (the phones count reads from it; the explainer links it). `tracedTool({ modelView })` does the same for the concierge's reports (offers without the sku; the ranking with scores to 3 places). A test drives the SDK end to end: the model's second prompt has the data and the explain id, not the keys.
- Presets (`story.json` `agentModels`, testing, video and live only): concierge and analyst at high; scout, payer, storefront, dispatch and risk at low (Kimi has low, high, max).
- The concierge's task carries `limits` (code's budget and deadline); its prompt's step 1 says to copy them (a deviation from AGENTS.md §8, in NOTES).
- Tests: 80 pass in `packages/agents`; the workspace suite passes; `pnpm check` is clean.

## State

- Item 3's first cut in its PR. Next: one live errand on it, then the routine steps in code (with the reviewer), then three live errands in a row that pay.
- Open (OPEN): acceptance E1 expects the old 23:59 deadline (the Coordinator); frontend: /customer's "By 23:59" chip and the deck's copy of the old request.
