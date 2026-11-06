# Relay: W3 Payments, 01:25 IST, Sat 7 Nov

## In plain words

- **The brief:** every money action in the story works live, each with its explorer link and its Arkiv record (`briefs/2258-w3-payments.md`). **Done: all of it is live on production.**
- **Re-order:** "Another coffee" re-orders the filter coffee for 0.80 (ADR-0073).
- **Subscriptions:**
  - Vitalik subscribes to the Sunday breakfast at 2.40, on the labelled 2-minute demo clock, and the chain stores 2.40.
  - The payer agent signs with no gas, and the first box is charged at once.
  - The renewal job charges the next one by itself, and the payer agent cancels with its own signature.
  - A demo subscription can pull at most 3 charges.
- **Refund decline:** the shop declines a refund request, and the decline is recorded on Arkiv. No money moves.
- **Limits:**
  - **Over the pass:** "Dosas for everyone at the hackathon" (100 dosas, 480) against the 300 pass is refused before anything is sent, and recorded.
  - **The agent's own cap raise:** ENS refuses it with revert `EACUnauthorizedAccountRoles`. It was simulated, so nothing was sent, and it is recorded.
  - **The owner's cap change:** the cap moves in both the ENS record and the spending policy, 300 → 250 → 300. The policy follows through the watcher on the Mac, never above the configured cap (ADR-0079).

## Technical

- **Re-order (#155):** `order.reorder.sku` and `item`, at 800000. A refunded parent may be re-ordered.
- **Subscriptions (#173):** `POST /api/customer/subscribe` and `/unsubscribe`.
  - The payer's wallet signs a Permit2 `PermitSingle` for price × `renewal.demoPeriod.maxCharges`, plus `Subscribe` and `Cancel`. RENEWER (E-1) sends.
  - The persona is the subscriber node, so a cancel never raises the paying agent's cancel rate.
  - The cron skips a charge whose allowance or token approval is spent, and an agent paused in ENS.
  - `/api/state/customer` reports the subscription.
- **Decline (#163):** `POST /api/merchant/refund-decline`.
  - It writes a W_SYNC `request` edge, shop to payer, ref `dec:<order>:<request minute>`.
  - It waits while the chain shows a refund the graph doesn't yet, and the `/order` page words it "Refund declined".
  - Reasons and notes refuse contact details.
- **Limits (#169, #190):**
  - `POST /api/customer/over-pass` signs `order.overPass` only above the whole pass and above the payer's balance, and sends it to our facilitator's verify step only. Only a decision on the payer counts as a refusal; one 95 s deadline bounds the attempt.
  - `POST /api/customer/raise-cap` runs an eth_call of `setText` from the agent's address, at a stated block. Its record is a `request` edge with amount 0.
- **Owner cap (#179; W1's #191; ADR-0079):** `POST /api/customer/cap`.
  - The owner (VITALIK) runs `setCap` on Sepolia, in the one owner-key queue (`inOwnerQueue`).
  - A cap above the configured one, or below today's spend plus the errand's budget, is refused, so a visitor can never stop the day's errands.
  - The watcher writes min(owner's cap, configured cap) as POLICY_WRITER, which stays local (ADR-0021). The route waits for the policy and writes an `own:` record.
  - #204 raises that wait to 90 s, since the first setPolicy landed 61 s after the ENS write.
- **Review:** every PR had a reviewer pass. No blocking issue remains: the decline's two and the owner cap's one were fixed and confirmed.
- **Frontend:** every new route and event is in OPEN under "frontend".

## Live evidence (01:25 IST)

- Re-order: [tx](https://explorer.testnet.whitechain.io/tx/0xf1d7cb5654de6cc09ede0a404818a009f7429d9d149e3e564222d4a4d3ae2b4a), [Arkiv](https://graphpay-event.vercel.app/api/explain/8391bb5c1b6b).
- Subscription: [subscribe](https://explorer.testnet.whitechain.io/tx/0xf3f7586090fb37cf4b04963216dabc7b89915f02afb19f71fb81ca138e53c393), [renew](https://explorer.testnet.whitechain.io/tx/0x8d40d556382f40313dafaf712d3c174d7cc8365176c8813f04e849f93338de83), [cancel](https://explorer.testnet.whitechain.io/tx/0x70ed2b3ffa63b81fa426631c70cb39591f8b80c077455930d05e63de04077b42), [Arkiv](https://graphpay-event.vercel.app/api/explain/23281094e730).
- Decline: [Arkiv](https://graphpay-event.vercel.app/api/explain/033a073bd39e).
- Over the pass: [Arkiv](https://rabdi.explorer.arkiv.network/entity/0x49163142476bc996134f3a4b0cac473f9698fa0781f39895206b138cfab1dc19).
- Refused cap raise: [Arkiv](https://rabdi.explorer.arkiv.network/tx/0xabc41f475312767e363e073ec872c3ff4b3556883901201dca53f1dafd444144).
- Owner cap:
  - ENS [down](https://sepolia.etherscan.io/tx/0x88eee4073dd89ca143cb1a155f4443f9810435cbd0522e3dde87102077b06bca) and [back](https://sepolia.etherscan.io/tx/0x9ede86e263e96dab93b13686c290ced72041da5c2b8b7b0ae76a8774040b0d62);
  - policy [down](https://explorer.testnet.whitechain.io/tx/0x9ee983c5b03c6fa183fc5d6ebbcda5e87c1955b04d474ddfc6f40f7a16caeb1c) and [back](https://explorer.testnet.whitechain.io/tx/0xa8171e53f95808df50d7fcad4820d071b0aa23b83ffcc09b8bb8173bcae6224e);
  - [Arkiv](https://rabdi.explorer.arkiv.network/tx/0x0156c13f9a2eefc977e83cd1fac6fec0f4cd06c86f8ef887850f6a6393407a1a).

## State

- Running: #204, on auto-merge after its check.
- Open, not tonight: the founder may set the "everyone" headcount; W1 may add a reconcile at the watcher's start.
- Blockers: none.
