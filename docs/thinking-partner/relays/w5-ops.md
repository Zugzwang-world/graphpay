# Relay: w5-ops (W5 Ops), 23:50 IST, Fri 6 Nov

## In plain words

- W5 keeps the live site healthy all night and drives the acceptance report to no failures.
- **Done (#152): the payer is active, with a pass of 300 test USDT a day for tonight.** The gate reads two places and takes the lower, so both were raised: the spending policy on Whitechain and the cap record in ENS. PAYER holds 125 test USDT, topped up from FUNDER; the shop's takings refill it next.
- **The shop is open.**
- **In review: Pause and Resume per agent.** A tap on an agent's card pauses that agent. Only the agents that can spend (the payer and the scout) can be paused; the concierge and the analyst answer that they have no spending pass.
- **In review: self-healing.** A paused agent resumes by itself after two minutes, and a closed shop reopens after five. A cron on the site checks every minute. It stores nothing: the pause time is read from the ENS record's own history on Sepolia, the close time from the shop's listing on Arkiv. The 20-second gap between a visitor's changes stays.
- **The mirror stalled again at 23:29 IST**, the same silent hang as at 22:02. W5 now owns the workers: it stopped the hung process (it ignored a clean stop) and started them from a dedicated copy of main at 23:43 IST. They caught up within six minutes.
- **The phones** still pause only the payer until the frontend pass sends the tapped agent's name (listed in OPEN under "frontend").
- **Next:** prove both live, restart the workers after W1's new shop names, acceptance at no failures.

## Technical

- Pass: `scripts/whitechain/policy-cap.mjs payer --yes` ([0x608a…b8fd](https://explorer.testnet.whitechain.io/tx/0x608ae1b6a9e380eee452735f311eaef1ad8ac502ee9b16268bacb1eebc30b8fd)); `scripts/ens/owner.mjs cap payer.vitalik.graphpay.eth --real` ([0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc)); top-up [0xa47d…3fe0](https://explorer.testnet.whitechain.io/tx/0xa47dc8907a91e0426ce16961972a07451473d20ac6ca3ab0f52fc16137643fe0).
- Pause per agent: `apps/web/lib/owner-actions.server.ts` (`pausableAgents`, `pickAgent`); the routes take `{ agent }`, none named is the payer; 409 `NO_PASS` for the others.
- Self-healing: `apps/web/lib/heal.ts` (decisions), `heal.server.ts` (reads and actions), `GET /api/cron/heal` every minute (`apps/web/vercel.json`, bearer `CRON_SECRET`), read-only `GET /api/state/heal`.
  - A pause is dated by the newest `TextUpdated` log for `graphpay.status` on the agent's resolver (last 900 blocks); no log in the window means an old pause, resumed at once.
  - The listing: renewed below 10 minutes left; reopened 300 s after the newest row's `open_until`, at once if no row is left.

- Workers: `pnpm workers` from `.claude/worktrees/w5-workers` (detached at main), pid 79148, `caffeinate -ims -w`, log `.workers.log` there. The old pid 34797 (Join's, 21:58) ignored SIGINT and SIGTERM and was killed at 23:43 IST; the lease was free at once. Restart again after the label flip: Ctrl-C (or `kill -INT`), `git -C .claude/worktrees/w5-workers checkout --detach origin/main` after a fetch, `pnpm install --frozen-lockfile`, then start.
- Review: 1 blocking finding (a no-log resume could undo a brand-new pause on a lagging node: now it needs the record paused 10 blocks back) and 9 should-fix ones, all fixed (re-checks in the queue, `GRAPHPAY_HEAL=0`, a 400 for a bad body, a CDN cache on `/api/state/heal`).

## State

- **Running:** this session; the reviewer agent on the pause and heal PR.
- **Blockers:** none.
