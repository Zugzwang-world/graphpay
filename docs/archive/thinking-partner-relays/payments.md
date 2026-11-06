# Relay: payments (T1 Payments), 22:30 IST, Fri 6 Nov

## In plain words

- Payments run from the public site, https://graphpay-event.vercel.app: the shop, our own x402 facilitator, the refusal recorder and a renewal job that runs every minute.
- An agent pays in test USDT on Whitechain Sepolia with one signature and no gas. Our facilitator relays the payment and pays the gas.
- The same payment sent twice answers "already paid" and moves nothing. A payment over the agent's cap is refused before anything is sent.
- The payer agent's spending pass is 100 test USDT a day, on-chain.
- Every errand on the stage pays through these routes. The shop's refund and the re-order from the phones use the same contract (T5's #129 and #131).
- Not built: a hosted subscription endpoint, so Subscribe and Cancel on the phones do nothing. Renewal itself works: the job renewed a 2-minute demo subscription.

## Technical

- Contract and deploy: [#12](https://github.com/Zugzwang-world/graphpay/pull/12) (M1), [#15](https://github.com/Zugzwang-world/graphpay/pull/15) (M2).
- Facilitator, shop API and recorder: [#42](https://github.com/Zugzwang-world/graphpay/pull/42). Real payments through the ENS gate, the qualifying payment C7 and the full lifecycle: [#45](https://github.com/Zugzwang-world/graphpay/pull/45) (M3 done). Evidence: `docs/sessions/payments/m3-part-b.md` and `c7.json`.
- Hosted on Vercel: [#53](https://github.com/Zugzwang-world/graphpay/pull/53), [#58](https://github.com/Zugzwang-world/graphpay/pull/58), [#62](https://github.com/Zugzwang-world/graphpay/pull/62) (M4 done). Evidence: `docs/sessions/payments/m4-hosted.md`.
- F3, the relayer's balance floor refuses before sending: [#78](https://github.com/Zugzwang-world/graphpay/pull/78).
- Live fixes:
  - [#96](https://github.com/Zugzwang-world/graphpay/pull/96): the shop retries an uncertain quote write (several servers write as W_DIRECTORY);
  - [#100](https://github.com/Zugzwang-world/graphpay/pull/100): error logs name the cause chain, never the message;
  - [#114](https://github.com/Zugzwang-world/graphpay/pull/114): settle safety (a pending 504 after a possible send; the signed hash kept before the broadcast).
- The payer's 100-a-day cap on-chain: [#107](https://github.com/Zugzwang-world/graphpay/pull/107). T2 set the ENS record ([#106](https://github.com/Zugzwang-world/graphpay/pull/106)); the gate takes the lower of the two.
- Gas at 22:25 IST: FACILITATOR 0.774 WBT, RENEWER 0.097 WBT (`docs/technical/WALLETS.md`).
- Open:
  - Subscribe and Cancel need a hosted subscription endpoint; build it only if the Sunday box is in the video;
  - the new shops' agent policies wait for their ENS names (T2);
  - only `ci` is a required check, so the `contracts` job does not gate a merge (OPEN, payments).

## State

- **Idle.** Session `local_16ccf7cf-ca9a-497a-bfce-d8bb3415cd92`.
- Resume file: `docs/sessions/payments/resume.md` (10:56 IST; older than #107 and #114).
- Next step: on the founder's word, the policies for the new shops' agents, and the subscription endpoint if the Sunday box goes into the video. Real payments go through the hosted facilitator only.
