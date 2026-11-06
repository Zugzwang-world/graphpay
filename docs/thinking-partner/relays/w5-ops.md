# Relay: w5-ops (W5 Ops), 00:35 IST, Sat 7 Nov

## In plain words

- W5 keeps the live site healthy all night and drives the acceptance report to no failures.
- **The payer is active, with a pass of 300 test USDT a day for tonight** (#152).
  - The gate reads two places and takes the lower one, so both were raised: the spending policy on Whitechain and the cap record in ENS.
  - PAYER was topped up to 125 test USDT from FUNDER; the shop's takings can refill it.
- **Pause per agent, live since 00:06 IST** (#172).
  - Pausing an agent's card pauses that agent.
  - Only the agents that can spend, the payer and the scout, can be paused. The concierge and the analyst answer that they have no spending pass.
  - The phones still send no agent name, so their Pause means the payer until the frontend pass wires it (OPEN, "frontend").
- **Self-healing, live.** A cron on the site checks every minute and stores nothing.
  - A paused agent resumes by itself after two minutes. Proven: the scout was paused at 00:07 and the cron resumed it at 00:09; the payer was paused at 00:10:36 and resumed at 00:12:51.
  - A closed shop reopens five minutes after its close. When I closed it at 00:15, a merchant page left open renewed it at 00:19, first.
  - The cron also renews the shop's listing, so it stays open with no page on screen.
- **The mirror (the workers on this Mac)** sometimes looks stuck: at 22:02, 23:29 and 00:23. It is waiting out Arkiv's shared rate-limit window. The founder's key has run out, so every process on the Mac shares one free allowance.
  - A watchdog now keeps the workers running. It restarts them only after 30 minutes with no progress, because a restart spends the allowance again (W2's diagnosis).
  - The real fix is a new Arkiv key from the founder.
- **Acceptance** (#188): the 8 failures were fixed or updated to tonight's decisions, each reviewed.
  - B2, C7 and E3 pass now, and B1 passes since the payer is active.
  - C3 needs a fresh hosted run after 05:30 IST, when the test agent's daily pass resets.
  - E1 needs one fresh errand, after W1's label flip.
  - D4 and D8 need a full run (W2's pinned city cast, #167, is in).

## Technical

- Pass: `scripts/whitechain/policy-cap.mjs payer --yes` ([0x608a…b8fd](https://explorer.testnet.whitechain.io/tx/0x608ae1b6a9e380eee452735f311eaef1ad8ac502ee9b16268bacb1eebc30b8fd)), `scripts/ens/owner.mjs cap … --real` ([0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc)).
- Pause per agent: `pickAgent` and `pausableAgents` in `apps/web/lib/owner-actions.server.ts`. The cron's resumes: [scout](https://sepolia.etherscan.io/tx/0x2caf65295863d61681fe26ac3aaf6160cc971171e1f16d3bd1f982b69fbf213c), [payer](https://sepolia.etherscan.io/tx/0x58fc69dcf6297a7bd99249beba185ee3864cbbc6326da2be468a6f2bf331a26c) (Vercel log `heal: … resumed`).
- Self-healing: `apps/web/lib/heal.ts` (decisions), `heal.server.ts`, `GET /api/cron/heal` every minute, `GET /api/state/heal` (cached 10 s at the CDN), off with `GRAPHPAY_HEAL=0`.
  - A pause is dated by its `TextUpdated` log (900 blocks). With none in the window, the record read 10 blocks back through ENSIP-10 `resolve` decides.
  - Each write is decided again in its turn.
  - The reviewer ran twice: 2 blocking findings and 9 others, all fixed.
- Workers: `.claude/worktrees/w5-workers` (detached at main), watchdog `scripts/ops/workers-watchdog.mjs` (30-minute fuse, hold file); runbook in `docs/sessions/integration/mirror.md`; P-w5-ops-1.
- W2's history window: the workers were held 23:59 to 00:13 IST.
- Acceptance: `acceptance/checks.mjs`; the amended rows are in `docs/plan/ACCEPTANCE_ADDITIONS.md`.

## State

- **Running:** the watchdog and the workers; this session.
- **Blockers:** the Arkiv key (founder).
- **Next:** W1's flip, then a restart and the errand; the full acceptance run; the hosted run after 05:30 IST.
