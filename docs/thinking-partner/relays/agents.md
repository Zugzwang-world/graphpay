# Relay: agents (T4 Agents), 22:30 IST, Fri 6 Nov

## In plain words

- A buyer team (concierge, scout, analyst, payer) takes Vitalik's one-line ask, finds the shops, ranks them on the money graph's numbers and pays one shop once. A shop team quotes, vets the buyer's agent and confirms delivery.
- The model proposes, code decides. The budget, the deadline, the ranking and every payment check are in code. The payer's tools take no input, so a tricked model cannot name another shop, URL or amount.
- The agents run on Kimi (the founder's choice, ADR-0067). Every errand on the stage uses the live preset.
- On the stage an errand takes about 2 minutes and pays 4.80 to Filter & Fold. Tawa Tangle is rejected for its refund and on-time rates.

## Technical

- The teams and every guard: [#11](https://github.com/Zugzwang-world/graphpay/pull/11) (M10). Presence and hand-off hooks: [#16](https://github.com/Zugzwang-world/graphpay/pull/16).
- Kimi: [#87](https://github.com/Zugzwang-world/graphpay/pull/87) (all three presets; the Anthropic ones kept as `anthropic-*`), [#92](https://github.com/Zugzwang-world/graphpay/pull/92) (the output schema in the instructions, so the concierge calls its tools), [#95](https://github.com/Zugzwang-world/graphpay/pull/95) (calibration).
- Presets (`agentModels` in `packages/config/story.json`): testing `kimi-k3.1-pro`; video and live `kimi-k3.1-pro-highspeed`; all at high.
- Calibration (`docs/thinking-partner/OPEN.md`):
  - on mock services the live preset took 58 to 65 s, about $0.12 an errand;
  - on production, paid errands took 115 to 171 s and $0.11 to $3.55 each by token count (the exact `apiCostUsd` is in the server log).
- The Booth's swap: the agents match the order item to each shop's first product by exact name, so each first product is "masala dosa"; the quote uses the combo's `short` name ([#135](https://github.com/Zugzwang-world/graphpay/pull/135), [#140](https://github.com/Zugzwang-world/graphpay/pull/140)).
- Open:
  - Kimi is prepaid, so its balance is the spend cap across all servers, and with public access anyone can start an errand (the founder: the balance);
  - a second reviewer pass was skipped at M10.

## State

- **Idle.** Session `local_0a83861b-1aaa-424f-abb4-cd36290807d2`.
- Resume file: `docs/sessions/agents/resume.md` (02:00 IST; it predates Kimi). Notes: `docs/sessions/agents/NOTES.md`.
- Next step: none queued; on call if a live errand shows an agents fault.
