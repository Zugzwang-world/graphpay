# ADR-0067: Kimi replaces Anthropic in the agent presets
Status: accepted · Date: 2026-11-06 · Decided by: founder (relayed by the Coordinator) · Source: ADR-0048; the Anthropic API key ran out of credit

## Decision
The `testing`, `video` and `live` presets run on Kimi (Moonshot AI) at effort `high`: `testing` = `kimi-k3.1-pro`, `video` and `live` = `kimi-k3.1-pro-highspeed`. The three Anthropic presets stay in the story config, unchanged, as `anthropic-testing`, `anthropic-video` and `anthropic-live`; `AGENT_PRESET` still overrides the active preset.

## Why
The Anthropic key has no credit left. Kimi's API reasons on every call, keeps reasoning across turns and is priced per token (pro $2 in, $0.20 cached, $10 out per million; highspeed $4, $0.20, $20), from the verifier's rows in `docs/technical/FACTS.md`.

## Consequences
- `agentModels.presets` gains provider `moonshot`; `models.moonshot` in `graphpay.config.json` holds the base URL, the key variable name (`KIMI_API_KEY`, server-only) and the efforts (low, high, max: no xhigh). Kimi prices sit with the other model prices, so `apiCostUsd` covers them.
- `AGENT_MODE` is `mock`, `live` or `auto` (`anthropic` stays as the old name of `live`); the provider is the preset's. `auto` goes live only when the keys of the active preset's providers are set.
- Kimi calls send the whole assistant message back every turn (`reasoning_content`, `tool_calls`, one tool message per call), keep the effort fixed for the whole errand, always set the output-token cap and never send a temperature. ADR-0048's "read only the final text block" applies to what is parsed, not to the history.
- Supersedes the model names in ADR-0048 (`claude-opus-5-5` for `testing` and `video`, `claude-haiku-5-5` for `live`); the preset mechanism, the calibration table and "nothing changes a preset without the founder" stand.

## Amendment, Fri 6 Nov 23:45 IST (night Coordinator): the routine roles at low

The founder's W4 brief for the night run ("lower Kimi's reasoning effort for the routine agents", `docs/thinking-partner/briefs/2258-w4-agents.md`) is the founder's word this decision asks for. Since #162 (23:40 IST), the concierge and the analyst stay at `high`, and the scout, payer, storefront, risk and dispatch roles run at `low`, in the `testing`, `video` and `live` presets. The models, the preset mechanism and `AGENT_PRESET` are unchanged. The trap veto and every visible message stay; W4 records the before-and-after tokens and seconds in its relay.
