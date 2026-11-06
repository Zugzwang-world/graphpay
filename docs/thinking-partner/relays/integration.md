# Relay: integration (Join)

Updated 05:41 IST, Fri 6 Nov.

## In plain words

Since T1 put the payment services on the production domain (M4), every payment Join makes goes through them, exactly as a judge's would: the hosted shop quotes and delivers, and our hosted facilitator relays the payment on Whitechain so the agent pays no gas. No script on this Mac relays payments any more.

At 05:30 IST the acceptance agent's daily allowance reset, and the acceptance run on the hosted endpoints passed:

- **It paid 4.80 test USDT for the errand without spending gas of its own.** The agent first checked the shop's payout address on ENS and its own spending rules, then signed. Our facilitator settled it, and the shop marked it delivered.
- **Sending the same payment again did nothing.** It answered "already paid", and no transaction was sent.
- **The shop refunded 0.80, and the agent re-ordered 3 for 1.20.** The re-order is linked to the first order on-chain.
- **A 0.40 payment over its 6.00 daily cap was refused.** Nothing was sent, and the refusal is recorded in the money graph on Arkiv, so other agents can see it.
- **Every endpoint that can spend refuses a caller without the passcode or token.** That is 17 routes: the shop, the facilitator, the recorder, the renewal cron, the customer and merchant actions, and the agents runner.
- **The subscription renewal comes from T1's hosted cron.** It renewed a 120-second demo subscription (the rehearsal agent's) for its second cycle; Join read that from the receipt again.

Five more checks from the other tracks are now wired into the report from their recorded evidence: the `.env` deny rules (A3), auto-merge (A4), the agent model presets (A9), the Whitechain RPC rules (A10), and the agent being unable to raise its own cap on ENS (B3).

- **A revoked agent is stopped by the contract itself (C4a).** With the Coordinator's go, Join paused the workers (they hold the policy writer's key for T2's watcher), revoked the scout agent's spending policy, and let the scout try to pay 0.40: the contract recorded the refusal (AGENT_REVOKED). The policy was restored exactly and read back, and after the restart the mirror wrote that refusal to Arkiv once, resuming from its checkpoint with nothing written twice.

- **No secrets are in the repo (F1).** The secret scan passes on the tree and on the history of every branch (313 commits), no env file is tracked, and all 14 secret-shaped variables on Vercel's production environment are hidden.

**The acceptance report: 43 pass, 0 fail, 1 blocked (the big city waits for the locked story), 4 not run.**

## What is not done, and whose it is

- **B7:** T2's fork tests cover "renew keeps the epoch" but not a new registration after a lapse or an unregister.
- **D10(c):** the quote's expiry on Arkiv. Parts (a) and (b) pass on the agents' own code, in process and without signing.
- **B9:** T2's ENS script still prints no B9 rows (its payee comparison waited for a settled payment; there are several now).
- **F3:** the relayer's safety floor needs a preview deployment with the floor raised. That is T1's.

## Technical

**New: `pnpm e2e:hosted`** (`integration/hosted.mjs`). It talks only to `config.site.url`, with no redirects followed, and writes `docs/sessions/integration/hosted/<read|paid>-<time>.json`. `acceptance/checks.mjs` (`hosted()`) reads the latest file.

- **No flags (read-only).** Health, the signer, and `isRelayer(signer)` on the checkout. C6 and F2: every spending route without a passcode and with a wrong one (or bearer). A 401 counts only when it is the app's JSON refusal, not a platform login page. Both the FACILITATOR nonce and the shop's merchant nonce must be unchanged.
- **`--yes`.** It refuses unless the payer's `spentToday` is 0 and the UTC day change is more than 15 minutes away. The payer signs for exactly the quoted amount. It refuses to sign unless the 402's `payTo` is the shop's ENS payee. The payer-side gate (`createPayerGate`) checks the amount being signed.
- **`--refund`.** The one local send, as SHOP_KESAR, because the hosted merchant-refund route is not live yet. It waits up to 90 s for the order to read DELIVERED, and refuses while that key has a pending transaction: the hosted shop sends `markDelivered` with the same key. T1 agreed to this.

**Evidence** (Whitechain testnet, 00:01–00:03 UTC):

| row | result | gas |
|---|---|---|
| C2 | [0x7c6b…a0c8](https://explorer.testnet.whitechain.io/tx/0x7c6b60e23cd92cc4efb4e0557df9d455aa093ea89ed35dc4f2f7429d64afa0c8); payer WBT unchanged; from the relayer; quote entity `0x7984…d8cf`; delivered | 254,294, within 234,292–252,082 ±15% with an existing approval |
| C5 | 200 `alreadyPaid`; relayer nonce 11 → 11 | none |
| C3 refund | [0x0d04…e33f](https://explorer.testnet.whitechain.io/tx/0x0d04220e9a26243f919715e649d85681439dc4f2a492618bb1f1a916df9fe33f); `Refunded(800000, full false)`; payer +0.80 | 75,323, against 75,344 ±15% |
| C3 re-order | [0xb778…e3d2](https://explorer.testnet.whitechain.io/tx/0xb77851de876e39556a5c690e938e8fda69e5aa69ef5079a20b85aadcdf27e3d2); `OrderCreated(kind 1, parent = the C2 order)`; 1.20 settled | 244,343, against 252,082 ±15% |
| C3 renewal | T1's hosted cron, [0x48b1…480f](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f); `SubscriptionRenewed` cycle 2; a kind-2 order; 0.40; sent by a relayer | 222,881, against 201,555 ±15% |
| C4(a) | `integration/c4a.mjs`, workers stopped (SIGTERM), POLICY_WRITER nonce quiet: revoke [0x4fc9…34bc](https://explorer.testnet.whitechain.io/tx/0x4fc9dabb3d9c1a16f56c30aeac5a18bda720c8dabab7f5b881359f89ef5534bc); the scout's 0.40 → 402 `AGENT_REVOKED`, `PaymentFailed` [0x312d…6021](https://explorer.testnet.whitechain.io/tx/0x312d31320300c20205ac46a66501ac4738c2ac572ef1abebd21534765aee6021); restore [0xbafe…11a7](https://explorer.testnet.whitechain.io/tx/0xbafe960b7e34da24e8b84da0822f89ca4ad965263bda9c2bf082b9002d0511a7), read back identical (DEAL_HUNTER, 1.00/day); after the restart (same checkpoint block 12,326,024; 7 refs skipped, 2 written) one W_LEDGER `fail` edge `0xd39a…8982` for ref `1874:0x312d…6021:1` | 136,574, against 160,525 ±15% (the band starts at 136,446) |
| C4(b) | 402 `CAP_EXCEEDED`; relayer nonce 12 → 12; the hosted recorder's off-chain `fail` edge `0x1bd8…54b7` on Arkiv | none |

**Changes**

- `integration/src/stack.mjs` (used by e2e:food and e2e:kill) refuses to start unless `STACK_LOCAL_RELAY=1`, so it can no longer race the hosted relayer's nonces.
- `acceptance/tracks.mjs`: A3, A4, A9, A10, B3, B7 and D10, read-only. A4 uses `gh api`, A10 runs the config tests, and B3 reads T2's recorded Sepolia receipt again.

**Reviewer (C4a, PR 67):** two blocking items, both fixed: the hosted checks picked the newest file of any kind (the c4a file would have turned C6 and F2 into not run), and a revoke that timed out after broadcast could stay unrestored. Now the restore reads the chain and retries, `--restore` exists, the check re-reads the PaymentFailed log and both receipts on-chain, and the fail edge is counted by ref. **Reviewer (PR 66):** no blocking items. Nine should-fix items, all fixed before the paid run: the payee and amount are checked, real 401s only, evidence never overwritten, a slow delivery never ends the run, and the midnight guard.

**Deviations**

- The first paid attempt at 00:00:18 UTC was refused by the shop with 400 because `requestId` must be 32-byte hex. Nothing was signed or spent. It was fixed and re-run 30 s later.
- The renewal cited is the rehearsal agent's subscription, not the acceptance agent's. C3 asks only for cycle 2 and a kind-2 settlement, and creating a new subscription needs RENEWER, which belongs to the hosted cron.

**Earlier:** M11 (PR 60) and M12 (PRs 48, 52, 56) are merged. PR 57 was closed as superseded, because its lines landed with PR 60.
