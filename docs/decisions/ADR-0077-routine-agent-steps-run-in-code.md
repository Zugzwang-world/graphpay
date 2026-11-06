# ADR-0077: Routine agent steps run in code; each model keeps one judgment call
Status: accepted · Date: 2026-11-07 00:10 IST · Decided by: W4 Agents under the founder's authority · Source: the founder's W4 brief (`docs/thinking-partner/briefs/2258-w4-agents.md`, item 3: "do routine steps in code"; keep the trap veto and every visible message)

## Decision
By default (`runErrand({ steps: 'code' })`) the routine steps of an errand are code, under each agent's own name and through its own traced tools: the scout, the payer, the storefront and dispatch make no model call, and code does the reads and the delegation for the analyst, the risk agent and the concierge. Each of those three keeps one model call for its judgment: the concierge chooses the shop (effort high), the analyst ranks the data code read, and the risk agent vets the buyer (both low, and both can only be stricter than code). `steps: 'model'` keeps the original flow.

## Why
A live errand made 19 model calls one after another (91.4 s, $0.1455, 23:30 IST); lower effort alone saved 4% (87.6 s), because each call costs 1.5 to 4 s even at low. In code mode an errand makes 3 calls; on Kimi over mock services it took 14 s and $0.027 (`docs/thinking-partner/relays/w4-agents.md`). The run log keeps the same events, messages and tool results (a test compares the messages with the all-model flow; the phones' mapper draws the same events).

## Consequences
- ADR-0019 ("the model proposes, code decides") holds: every guard is unchanged, and code now also carries the steps where the model only sequenced tools. A ranked shop the guard refuses (the trap) still ends the errand; when the concierge names no shop of the ranking, code pays its best eligible offer within the limits (`bestFit`), with a G2 line; an eligible pick that misses the limits falls to the same rule.
- The analyst's visible `graphql` call is code's fixed ranking query, so the phones count its real reads.
- ADR-0067's amendment (23:45 IST) is amended again: only the concierge stays at high (see there).
- The prompts gain one-call forms (`concierge-choose`, `analyst-data`, `risk-data`), a deviation from `planning/SPEC/AGENTS.md` §8 recorded in `docs/sessions/agents/NOTES.md`.
