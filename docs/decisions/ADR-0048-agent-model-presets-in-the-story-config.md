# ADR-0048: Agent model presets in the story config

Status: accepted · Date: 2026-11-05 · Decided by: founder (chat, 22:42 IST; brief v2)

## Decision

The model and effort of every agent role are named presets in the story config, never hard-coded: `testing` = `claude-opus-5-5` at `xhigh` (active tonight); `video` = `claude-opus-5-5` at `xhigh` if its timing fits, because a video cannot be sped up; `live` (the live demo and the submission) = `claude-haiku-5-5` at `xhigh`. `AGENT_PRESET` overrides the active preset for one run. Every test run records the seconds and the API cost of each full errand in `docs/thinking-partner/OPEN.md`, to calibrate the presets on Friday.

## Why

The founder wants the strongest model while testing and a fast, cheap one live, switchable without code changes. The M0 probe (22:54 IST) confirmed both ids and `xhigh` are accepted; prices come from the config (`models`).

## Consequences

Supersedes `planning/DECISIONS.md` E-10 (Haiku by default). Agents read only the final text block of a reply (the probe saw Haiku at `xhigh` return the same short answer in two text blocks once), give `xhigh` a large `max_tokens` (64,000 in the presets), and check for an empty reply and a `max_tokens` stop. Nothing changes a preset without the founder.
