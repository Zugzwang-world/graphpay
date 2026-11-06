# Relay: w5-ops (W5 Ops), 01:40 IST, Sat 7 Nov

## In plain words

- W5 keeps the live site healthy all night and drives the acceptance report to no failures.
- **The payer is active, with a pass of 300 test USDT a day for tonight** (#152). Its wallet is back at 125 test USDT. At 01:3x it was refilled from the shop's takings (63.2 from Filter & Fold's wallet), the way the brief asked.
- **Pause per agent and self-healing are live** (#172).
  - A tap on an agent's card pauses that agent. Only the payer and the scout can be paused; the others say why.
  - A paused agent resumes by itself after two minutes; a closed shop opens again within five.
  - The cron also reopened Filter & Fold under its new name at 00:32, right after the label flip, and keeps renewing its listing.
- **The mirror follows the new shop names.**
  - Restarted at 00:51 on main with W1's flip, W1's cap sync and the watchdog.
  - A live errand at 01:07 paid 4.80 to filter-and-fold.graphpay.eth. The mirror wrote it under that name, and Filter & Fold's phone shows it. W1 checked it independently.
  - The payments from before the flip stay under the old name, as they should.
- **The weak spot is Arkiv.** This Mac's free query allowance (10,000 a minute) runs out at times. The mirror then waits, or re-reads and re-scans; once it showed a paid order 9 minutes late.
  - The founder's new Arkiv key is the fix.
  - Meanwhile (this PR), the checkout kit's anonymous payment no longer holds the mirror's checkpoint, so a re-scan is short.
- **Acceptance** (#188): the 8 failures are fixed or updated to tonight's decisions.
  - B1, B2, C7 and E3 pass.
  - E1 needs one fresh errand (next). C3 needs a fresh hosted run after 05:30 IST. D4 and D8 need the full run.

## Technical

- **Pass:** `scripts/whitechain/policy-cap.mjs` ([0x608a…b8fd](https://explorer.testnet.whitechain.io/tx/0x608ae1b6a9e380eee452735f311eaef1ad8ac502ee9b16268bacb1eebc30b8fd)); the ENS record ([0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc)).
- **Top-ups:** from FUNDER, [0xa47d…3fe0](https://explorer.testnet.whitechain.io/tx/0xa47dc8907a91e0426ce16961972a07451473d20ac6ca3ab0f52fc16137643fe0); from the shop, [0xd94a…6f97](https://explorer.testnet.whitechain.io/tx/0xd94af7b0a27a90b1d1c631972dd489c2642e3912b0777f29a73f4f277b926f97), with `scripts/ops/payer-topup.mjs --from shop|funder`.
  - One source per run.
  - Both senders' pending nonces are checked first.
  - The funding script's identity checks, and the payer's wallet as bound by the checkout's policy.
  - The planned amount is a hard ceiling (fundUsdt's new `maxNeed`).
  - The reviewer ran twice: 2 blocking findings, fixed.
- **Self-healing:** `apps/web/lib/heal.ts` and `heal.server.ts`, `GET /api/cron/heal` every minute, `GET /api/state/heal`, off with `GRAPHPAY_HEAL=0`. The Vercel log has `heal: … resumed`, `reopened` and `listing renewed` lines. The cron's resumes: [scout](https://sepolia.etherscan.io/tx/0x2caf65295863d61681fe26ac3aaf6160cc971171e1f16d3bd1f982b69fbf213c), [payer](https://sepolia.etherscan.io/tx/0x58fc69dcf6297a7bd99249beba185ee3864cbbc6326da2be468a6f2bf331a26c).
- **Workers:**
  - Checkout `.claude/worktrees/w5-workers`, detached at main (ff67dac at 00:51).
  - The watchdog is `scripts/ops/workers-watchdog.mjs`, with a 30-minute fuse and a hold file. It relaunched the workers at 01:00 after the 00:51 start died on a 429 (pid 30776).
  - Shops are attributed by the event's `shopNode` (`packages/mirror/src/map.mjs`), never by wallet. `adopt()` loads every node row from Arkiv, so old and new names are both known (46 actors).
  - The proof errand: [0xcc69…e5cb5](https://explorer.testnet.whitechain.io/tx/0xcc69b7bb16eb17c9dede32da4765a90ca15a6af18397011efae6a9eb599e5cb5).
  - The zero node (the kit's anonymous payer) is passed with nothing written; its two events had held the checkpoint at block 12,326,024. Runbook: `docs/sessions/integration/mirror.md`; P-w5-ops-1.
- **Acceptance:** `acceptance/checks.mjs`, with the amended rows in `docs/plan/ACCEPTANCE_ADDITIONS.md`.

## State

- **Running:** the workers and their watchdog; this session.
- **Blockers:** the Arkiv key (founder).
- **Next:** restart the workers on this PR; one e2e:food errand for E1; the full acceptance run, shipped; the hosted run after 05:30 IST.
