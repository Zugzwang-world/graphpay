# ADR-0047: One story config: nothing story-specific in code

Status: accepted · Date: 2026-11-05 · Decided by: founder (chat, 22:42 IST; brief v2)

## Decision

Everything story-specific comes from one story config file, `packages/config/story.json`, never from code: the cast, shops, agents, products, prices, the renewal item and schedule, locations, the synthetic city parameters, the scripted demo steps and the agent model presets. Tonight it holds the pack's cast as the test story; the founder's final story replaces it when he locks it. The infrastructure config (`graphpay.config.json`) keeps addresses, networks, wallet roles and model prices.

## Why

The demo story changes on Friday; a story value in code would have to be found and changed in every package.

## Consequences

`pnpm check` fails on a story name or value (labels, display names, products, the renewal item and plan, the request text) in code outside the story file. Supersedes the cast part of ADR-0030 and amends ADR-0013.
