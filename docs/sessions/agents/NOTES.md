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

## Deviations from the pack

- Models come from the story presets (`agentPreset(role)`, ADR-0048), not `AGENT_MODEL`; `AGENT_PRESET` overrides. Grok (`AGENT_PROVIDER`) is not built (optional); a preset naming another provider fails closed.
- The model-facing output schemas (`WIRE_OUTPUTS`) are bare types; code validates the reply against the strict `OUTPUTS` after the call, because native structured output drops bounds and patterns.
- The need and limits are adopted from the request by code (G1); `directory_list` searches for the adopted need whatever the model types.
- `pay_shop` guard also needs the scout's offer for the chosen shop to fit budget and deadline, and a refusal ends the errand (one payment slot).
- A 402 is checked for contract, order id, merchant, nodes and amount, and `408` after signing counts as unclear, not final.
- `dryRun` option: every pre-sign check, then `DRY_RUN`, never a signature (acceptance B9 b, D10).
- Spec §12 (`NEEDS` for shirt and ride) is not built: it is story content (ADR-0047); `NeedSpec.need` keeps the three names.
