# Relay: integration (Join), 22:30 IST, Fri 6 Nov

## In plain words

- Join wires the tracks together and proves them on the real networks.
- **The runner:** every errand on the stage runs on our server at `/api/agents/run`, on the live preset, with every guardrail on. One errand runs at a time per server, with no hourly cap (the founder's choice).
- **The reliable errand:** the founder's two test errands at 13:28 and 13:30 IST both paid 4.80 with no retry. The payer has spent 78.00 of today's 100.
- **The mirror** copies every Whitechain payment into the money graph on Arkiv. It runs on this Mac, with T2's ENS watcher. Join restarted it on #148 at 21:58 IST.
- **Acceptance:** 45 pass, 0 fail, 1 blocked (D7, the big city) and 2 not run (B7, B9), from the 13:35 IST run.
- **Watch:** after the restart, one poll hung from 22:02 IST for about half an hour, with no error recorded. The same process recovered by itself; at 22:39 IST its health check was ok and it was 2 blocks behind the chain. Nothing is lost in a stall: the mirror catches up when it polls again.

## Technical

- Mirror: [#8](https://github.com/Zugzwang-world/graphpay/pull/8), [#20](https://github.com/Zugzwang-world/graphpay/pull/20), [#33](https://github.com/Zugzwang-world/graphpay/pull/33), [#60](https://github.com/Zugzwang-world/graphpay/pull/60) (M11 done). Runbook: `docs/sessions/integration/mirror.md`.
- End to end and the kill: [#37](https://github.com/Zugzwang-world/graphpay/pull/37), [#46](https://github.com/Zugzwang-world/graphpay/pull/46), [#48](https://github.com/Zugzwang-world/graphpay/pull/48), [#50](https://github.com/Zugzwang-world/graphpay/pull/50), [#52](https://github.com/Zugzwang-world/graphpay/pull/52), [#56](https://github.com/Zugzwang-world/graphpay/pull/56) (M12 done).
- Hosted acceptance: [#66](https://github.com/Zugzwang-world/graphpay/pull/66), [#67](https://github.com/Zugzwang-world/graphpay/pull/67), [#79](https://github.com/Zugzwang-world/graphpay/pull/79) (M13 done); C6 and F2 under public access: [#120](https://github.com/Zugzwang-world/graphpay/pull/120). Report: `ACCEPTANCE_REPORT.md`.
- Runner: [#85](https://github.com/Zugzwang-world/graphpay/pull/85), [#88](https://github.com/Zugzwang-world/graphpay/pull/88), [#91](https://github.com/Zugzwang-world/graphpay/pull/91), [#93](https://github.com/Zugzwang-world/graphpay/pull/93), [#102](https://github.com/Zugzwang-world/graphpay/pull/102) (the first paid errand through the site).
- Reliable errand: [#108](https://github.com/Zugzwang-world/graphpay/pull/108) (retry while the shop says it is safe), [#112](https://github.com/Zugzwang-world/graphpay/pull/112) (the facilitator's busy 502), [#119](https://github.com/Zugzwang-world/graphpay/pull/119) (the proof).
- The process: `pnpm workers` from Join's worktree at #148 (pid 34797). Its checkpoint stays at block 12,326,024, behind two parked events of the store's kit payment (a payer outside the cast), so each restart re-scans from there and skips what it already wrote.
- Open:
  - if the health check fails again, restart the mirror from Join's worktree, and never run two;
  - regenerate the acceptance report from main (the 22:25 brief);
  - D7 waits for the big city; the demo cast's bootstrap (Friday item 6) waits for the new names.

## State

- **Idle.** Session `local_e67c2aa7-36f4-43ff-bee9-578ad5a1d519`.
- Resume file: `docs/sessions/integration/resume.md` (13:33 IST; before public access and tonight's restart).
- Next step: the acceptance run from main; watch the mirror's health.
