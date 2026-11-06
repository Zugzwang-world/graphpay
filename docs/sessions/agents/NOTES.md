# T4 agents: working notes

Package `packages/agents` (M10). Everything the guards need is code; live services sit behind `LiveHooks`, `McpLike` and `ShopSurface` in `packages/agents/index.d.ts`, with full mocks in `packages/agents/mocks`.

## What Join wires in M12

`LiveHooks`: `directory` (T3 `discoverShops`), `catalog`, `storefrontUrl`, `shopClient` (an HTTP client to the shop gateway, or `createShopGateway` in process over a `ShopSurface`), `payerWallet`, `nodeOf`, `resolvePayee` and `readAccepts` (T2), `findQuotes` and `shopKey` (T3), `ensCheck` (T2 gate), `sign` (called only after every check), `contracts` (default: the values in the config's `whitechain.contracts`; **empty today, so every real 402 is refused `UNKNOWN_CONTRACT` until T1's checkout address is in the config or passed here**). `McpLike.call` gives code its own reads (`schema`, `graphql`, `ask`); `McpLike.tools()` gives the model's tools.

## Presence and handoff hooks (Friday item 2)

Two optional members of `LiveHooks`, no-ops when absent (hooks absent or recording: the run log is byte-identical). Join (item 3) writes the entities through W_DIRECTORY, batched per phase.

- `presence(phase, { agentEns, ownerEns, role, session })`, `phase` is `'start'` or `'renew'`; `session` is the run id. Called at each agent's first `agent.start` (buyer and shop agents), then `'renew'` for every started agent each `PRESENCE_RENEW_MS` (5 min, inside the 15 min expiry) until the errand ends. Owner = the persona for the buyer team, the shop's ENS for its storefront, risk and dispatch agents; all names come from the cast.
- `handoff(from, to, step, { requestId })`, `requestId` is the run id. Called at every message edge between two agents (not the human's own ask). `step` is the explainer lane: `ask` (concierge to scout or analyst), `check` (their reports back), `check-back` (storefront and risk vetting the buyer), `quote` (quote and 402), `pay` (pay order, signature, settlement, dispatch, the concierge's pay order and its result). The lanes are labels, not one global order: the check back runs inside the quote call, so T5 sorts by lane, not by arrival.
- Fire and forget: a throw or rejection never blocks or fails a step; it is scrubbed into the log as a `HOOKS` guard (`ok: true`, "the errand goes on"). A hook that never settles holds nothing. Hook calls after the errand ends are dropped.
- Mocks: `createMockActivity({ fail: 'sync' | 'async', hang })` returns recording `presence` and `handoff` (spread into the mock hooks). Tests: `packages/agents/test/activity.test.mjs`. Errand options `presenceRenewMs`, `setTimer`, `clearTimer` exist for tests.

## Kimi as the provider (ADR-0067)

- Presets: `testing`, `video`, `live` are `moonshot` (`kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`) at `high`, `maxTokens` 32000; the Anthropic ones are `anthropic-testing|video|live`. `AGENT_PRESET=anthropic-testing` runs the old setup (needs `ANTHROPIC_API_KEY`).
- Mode: `AGENT_MODE=live` (old name `anthropic` still works). The factory (`packages/agents/src/models.mjs`) needs the key of every provider the preset uses (`KIMI_API_KEY` for Kimi), passes it and the config's base URL explicitly, and never reads a shell base-URL variable.
- Kimi requests: `reasoning_effort` from the preset, `max_tokens` always set, no temperature (fixed at 1.0 by the model); the history sent back keeps `reasoning_content`, `tool_calls` and one tool message per call (tested with a fake server in `test/kimi.test.mjs`). The Kimi model is not wrapped in the final-text-block middleware: a chat-completions reply is one content string, so history is exactly what the API returned.
- Structured output: with a `response_format` Kimi answered the JSON at once and never called its tools (first live errand: no purchase, 1 call). For `moonshot` the schema (`z.toJSONSchema(WIRE_OUTPUTS[role])`) goes into the instructions, no `output` is sent, and `runAgent` parses the last text (code fences stripped) and validates it against `OUTPUTS` as before; empty, cut-off (`length`) and non-JSON replies are no-answers. `PROMPTED_JSON` in `src/agents.mjs` lists the providers that need this.
- Cost: `moonshotUsage` maps cached tokens to the cached price and everything else in the prompt (cache-write tokens included, assumption: no write price is published) to the input price; output includes reasoning tokens.
- Join: `integration/e2e-food.mjs` calls `runErrand({ mode: 'anthropic' })` (accepted, means live) and needs `KIMI_API_KEY` in the env it passes, now that the active preset is Kimi.

## Routine steps in code (W4 Agents, Fri 6 Nov night)

`runErrand({ steps })`: `'code'` (the default) or `'model'` (the original flow; the bad-play tests use it).
- In code mode the scout, payer, storefront and dispatch make no model call: code calls their own traced tools (`callTool`), so the run log has the same `agent.start`, `tool.call`, `tool.result`, `message` and `agent.end` events (`model: 'code'`, no calls). The payer still only calls `get_quote` then `pay_order`; every pre-sign check is unchanged.
- The analyst's reads are code's: its fixed `RANKING_QUERY` through the analyst's traced `graphql` tool (the one ranking read, in the graph's lower-case city), then `explain`; the model judges the data in one call (`analyst-data` prompt), advisory as before.
- The risk agent's reads (`ens_check`, `ask` buyer_risk) are code's, through its traced tools; code's reasons come from those answers; the model judges in one call (`risk-data`) and can only add declines (G9).
- The concierge: code asks the scout and the analyst at once with code's need, the model chooses in one call (`concierge-choose`) on the offers and code's ranking (the analyst model's opinion stays out), and code pays through `pay_shop`. A choice that names no shop of the ranking (or no answer) falls to `bestFit` (the best-ranked eligible offer within the budget left and the deadline; a G2 line says so); a ranked shop the guard refuses (the trap) ends the errand, as before.
- A directory or ranking read that throws is tried once more after `retryMs` (1 s).
- Presets: the concierge at high; every other role at low (only the analyst and the risk agent still call a model in code mode).

## Deviations from the pack

- Models come from the story presets (`agentPreset(role)`, ADR-0048), not `AGENT_MODEL`; `AGENT_PRESET` overrides. Providers: anthropic and moonshot (Kimi, ADR-0067). Grok (`AGENT_PROVIDER`) is not built (optional); a preset naming another provider fails closed.
- The model-facing output schemas (`WIRE_OUTPUTS`) are bare types; code validates the reply against the strict `OUTPUTS` after the call, because native structured output drops bounds and patterns.
- The need and limits are adopted from the request by code (G1); `directory_list` searches for the adopted need whatever the model types.
- The concierge's task carries `limits` (code's budget and deadline) and its prompt's step 1 says to copy them (W4); the routine roles think at Kimi's low effort; the models read short tool replies (`MODEL_VIEW` in `src/graph.mjs`, `modelView` on `tracedTool`) while the run log keeps the whole answers.
- The deadline may be a span from the request ("within an hour", W4 Agents, Fri 6 Nov): the request instant plus the span, floored to the minute, so errands work at any hour; a clock time and a different span together are ambiguous and refused.
- `pay_shop` guard also needs the scout's offer for the chosen shop to fit budget and deadline, and a refusal ends the errand (one payment slot).
- A 402 is checked for contract, order id, merchant, nodes and amount, and `408` after signing counts as unclear, not final.
- `dryRun` option: every pre-sign check, then `DRY_RUN`, never a signature (acceptance B9 b, D10).
- Spec §12 (`NEEDS` for shirt and ride) is not built: it is story content (ADR-0047); `NeedSpec.need` keeps the three names.
