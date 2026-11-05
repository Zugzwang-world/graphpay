# Relay: agents (M10)

Updated 01:35 IST, Fri 6 Nov. **Built and green on mock models; live runs and the reviewer pass are next.**

## In plain words

The agents are written. A buyer team (concierge, scout, analyst, payer) takes Vitalik's one-line request, finds the shops, ranks them by trust, and pays one shop once. A shop team (storefront, risk, dispatch) quotes, vets the buyer's agent and confirms delivery. The rule from ADR-0019 is kept: the model proposes, code disposes. The budget and deadline come from the words of the request, the ranking is recomputed in code from the graph's own numbers, and the payer's two tools take no input at all, so a confused or tricked model has no way to name another shop, URL or amount.

Before any signature the payer checks every field of the 402, asks ENS who the shop's payee is (refusing `PAYEE_MISMATCH` or `PAYEE_UNRESOLVED`), checks the shop's accepts record, and checks the Arkiv quote (a missing or expired quote is re-quoted once; a mismatch refuses). If the answer after signing is unclear (502, timeout, a 200 without a receipt), the money stays counted and nothing is paid again.

All data is synthetic or mock and labelled so. Tonight's test story is read from `packages/config/story.json`; no name lives in code.

## What is verified

- 53 tests on mock models: the trap is never paid (price-only concierge, lying analyst), the model cannot widen the limits, one payment per errand (three parallel calls), scout and analyst run in parallel, revoked, expired and paused payers are refused before any 402, a 502 after signing keeps the reservation, an `AGENT_MODE` typo never starts a paid run, a key echoed by a failing model never reaches the log.
- Ranking reproduces 0.986 / 0.934 / 0.821, and about 0.916 / 0.863 / 0.750 for the smaller history.
- Not yet: the five live runs on the testing preset (`claude-opus-5-5`, xhigh) and their seconds and cost in `OPEN.md`.

## Technical

Package `packages/agents` (ESM, AI SDK 7.0.162, zod 4.6.7). Entry `runErrand` returns the run log (`graphpay.agent-run/v1`), metrics (seconds, tokens, `apiCostUsd`) and the final state. Live services come in through `LiveHooks`, `McpLike`, `ShopSurface` (`index.d.ts`); `mocks/` holds a full fake world. `pnpm agents:errand [--runs N]` runs the story errand (mock by default; `AGENT_MODE=anthropic` uses the active preset). Deviations and Join's wiring list: `docs/sessions/agents/NOTES.md`. Pins: `docs/technical/VERSIONS.md`.
