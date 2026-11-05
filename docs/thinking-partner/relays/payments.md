# Relay: payments (T1)

Updated 05:11 IST, Fri 6 Nov.

## In plain words

**Real money paths work end to end on Whitechain Sepolia.** Until tonight every payment had run on a local copy of the chain. Now, with T2's ENS gate merged, the facilitator and the shop ran against the real chain and the real ENS names, and every step of the payment story happened on the public explorer.

**The qualifying payment is done, once.** An AI agent with an ENS name, `acceptance.vitalik.graphpay.eth`, paid 4.80 test USDT to the shop `kesar-kingdom.graphpay.eth` through our own x402 facilitator. Before it paid, the facilitator asked ENS whether the agent may pay (active, within its limit) and took the shop's payout address from the shop's ENS name. The agent paid no gas: the facilitator sent the transaction and paid for it. That single payment is the evidence for Whitechain's qualification (acceptance C7, also E3), and the script that made it refuses to pay again, from its own record and from the chain itself.

**The whole lifecycle ran for real,** as the rehearsal agent so the demo agents' daily limits stay untouched:
- paid 4.80 with no gas of its own; the same signed payment sent again answered "already paid" and moved nothing;
- the shop refunded 0.80 from its float; the agent re-ordered for 1.20;
- a payment above the agent's daily limit was refused by the ENS gate before anything reached the chain;
- the scout agent's on-chain permission was revoked, its payment attempt was recorded on-chain as a failure ("agent revoked") with no money moving, and its permission was then put back exactly as it was;
- the persona paid 0.40 as a human, with no agent name involved;
- a weekly sweets-box subscription was created (first charge included), renewed by our renewer after the 2-minute demo period, and cancelled with the subscriber's own signature.

**Now (M4): the same payments from the public site.** The shop, our facilitator, the refusal recorder and a renewal job that runs every minute are routes on https://graphpay-event.vercel.app, behind the demo passcode and bearer tokens, on the real chain only. The server keys went to Vercel as Sensitive values (never printed, never in the browser). It is live: a 0.40 payment went through the public URL with no payer gas ([explorer](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), the repeat answered "already paid", every protected route answers 401 without its passcode or token, a refusal record landed on Arkiv, and the renewal job renewed a 2-minute demo subscription by itself ([explorer](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)). Join's agents now pay through the hosted facilitator.

**What it meant for the demo (M3):** identify (ENS), pay (Whitechain) and the refusal and revocation stories all have real transactions behind them now. Join's watcher and the integration checks (D1, D2b/c, D3, CP4) can use these. Next is M4: hosting the facilitator and the shop on Vercel, so these same payments run from the public site. Nothing for the founder.

## Technical

- M4 (PR from `pay/hosted`; dependencies in https://github.com/Zugzwang-world/graphpay/pull/53): `apps/web/lib/payments.server.ts` (one build per instance, 503 and retried on a failed start-up, hosted URLs pinned to the production domain, merchant lists from the shop keys), routes `/api/{facilitator,shop,recorder}/[...path]` and `/api/cron/renew` (RENEWER, 25 newest subscriptions, at most 3 renewals per run, 25 s budget), `scripts/whitechain/vercel-env.mjs` (14 Sensitive values set at 05:00 IST), `pnpm pay:public`. Security and correctness reviews: one blocker (typecheck), fixed; should-fixes done; "ship". Merged as https://github.com/Zugzwang-world/graphpay/pull/58 (05:05 IST); live checks (health 200, C6, pay:public 226,480 gas, recorder edge, cron renewal 222,881 gas as RENEWER) in `docs/sessions/payments/m4-hosted.md`. FACTS.md entries for main: the pay:public and cron links.

- PRs: part A merged as https://github.com/Zugzwang-world/graphpay/pull/42 (04:06 IST); part B on `pay/part-b`, titled `(M3 done)`.
- C7: https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00, block 12,322,239, 309,483 gas with the gasless EIP-2612 approval, `tx.from` FACILITATOR, `PaymentSettled`, 4,800,000 units of `0xcedf…55a7`, payer WBT 0.005 before and after. Paid on UTC 5 Nov, so the acceptance agent's 6.00 for M13 (UTC 6 Nov) is fresh. Record `docs/sessions/payments/c7.json`; the README link is asked for in OPEN.md.
- Lifecycle (real, 04:14–04:16 IST): pay 237,206 gas, refund 75,335, re-order 244,295, `AGENT_REVOKED` recorded 136,586, human payer 281,661, policy revoke and restore 38,394 and 38,382; over-cap refused off-chain with `CAP_EXCEEDED`. Subscription: create 433,969, renew 222,881, cancel 42,227. Every link in `docs/sessions/payments/m3-part-b.md`; transcript `m3-lifecycle.json`; all transactions in `txlog.jsonl`.
- Scripts (`scripts/whitechain/`): `local-pay.mjs` composes the facilitator and shop in-process with T2's `createEnsGate` (its epoch, cap and spent-today inputs read from the checkout: no policy → `ENS_NO_POLICY`, the contract's UTC day) and `createEnsReader().resolvePayee`; `lifecycle.mjs`; `usdt-ready.mjs --go --yes` (pending record before the payment, chain guard on `PaymentSettled` by payer node); `subscription.mjs`. Real sends need `--yes` and `ALLOW_REAL_NETWORK=1`; `sendTx` re-reads `eth_chainId` before every send. `@graphpay/facilitator` re-exports the x402 classes so scripts and M4 share its pinned `@x402/core`.
- Reviewers: part A pass 2 fixed (no gate cache of ours; a failed order is never resent; `eth_chainId` before every send). Part B: two blocking (C7 double-pay window, subscription without the real-network flag), fixed, then "ship". Every script was rehearsed on an anvil fork first.
- Balances after: FACILITATOR 0.794 WBT, RENEWER 0.097 WBT.
- Open: C4(b) as the acceptance agent is M13's; M4 decides the facilitator's one-instance rule (per-instance in-flight and failure state, OPEN.md); refusal records go to Arkiv once M4's recorder route runs (here they were printed only).
- Next: M4 (hosted routes over the packages' Fetch handlers, the recorder's W_SYNC writer, the quote writer, `/api/cron/renew`).
