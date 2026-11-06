# Relay: W3 Payments, 00:00 IST, Sat 7 Nov

## In plain words

- Tonight's payments stream: every money action in the story works live, with its explorer link and its Arkiv record (brief `briefs/2258-w3-payments.md`).
- **1. Re-order, done:** "Another coffee" re-orders the filter coffee for 0.80, the story's re-order (ADR-0073), instead of the 4.80 combo. It paid live at 23:34 IST, and its order, pay and deliver edges are on Arkiv.
- **2. Subscriptions, reviewed and in their PR:** Vitalik subscribes to the Sunday breakfast at 2.40, on the labelled 2-minute demo clock. 2.40 is stored on chain.
  - The payer agent signs, and pays no gas. The first box is charged at once; the renewal job charges the next ones.
  - The payer agent cancels with its own signature.
  - Each subscription can pull at most 3 charges (7.20), so the demo never eats the pass.
- **3. Refund decline, in review (#163):** the shop can decline a refund request. The decline is recorded on Arkiv as the shop's answer to the payer agent. No money moves.
- **4. Limits, in review (#169):** a payment over the pass ("dosas for everyone") is refused and recorded; the agent's attempt to raise its own cap in ENS is refused, with its revert reason. The owner's cap change waits for the Coordinator.

## Technical

- **Re-order (#155):**
  - `order.reorder` gains `sku` and `item`, at 800000.
  - The quote asks for that sku, and the signed terms must name it.
  - A refunded order may be re-ordered; the checkout and the shop accept it.
- **Subscriptions (`pay/w3-subscriptions`):**
  - Routes: `POST /api/customer/subscribe` and `/unsubscribe`, in `lib/subscription.server.ts` and `lib/subscription-live.server.ts`.
  - The payer's wallet signs three things: a Permit2 `PermitSingle` for price × `renewal.demoPeriod.maxCharges`, the `Subscribe` terms, and an EIP-2612 approval of Permit2 when it is short.
  - RENEWER (E-1) simulates, then sends `createSubscription`, then `cancelWithSig`.
  - The subscriber node is the persona, so a cancel never raises the paying agent's cancel rate (the shops' risk check refuses one above 15%).
  - The cron skips three cases: a charge the signed allowance or the token approval cannot cover, and a story agent paused in ENS.
  - `/api/state/customer` reports the payer's subscription from the checkout.
  - Fork run: subscribe, two renewals, the third skipped, cancel, then subscribe again.
  - Hardened after review: no new subscription while any of the payer wallet's is active, since they share one Permit2 allowance; only the transaction's own receipt counts; the payee is confirmed by the shop key; 180 s between subscriptions, read from the chain.
- **Decline (`pay/w3-refund-decline`):**
  - Route: `POST /api/merchant/refund-decline`.
  - It writes a W_SYNC `request` edge, shop to payer, ref `dec:<order>:<minute>`, and only against a `req:` request on the record. A `fail` edge touching the shop would count against it, so it is not one.
- **Limits (#169):** `POST /api/customer/over-pass` signs the story's `order.overPass` only when it is over what is left of min(ENS cap, policy cap). The facilitator refuses with `CAP_EXCEEDED` and its recorder writes the `fail` edge. `POST /api/customer/raise-cap` simulates the agent's own `setText(graphpay.cap_micro)`: it reverts `EACUnauthorizedAccountRoles`, nothing is sent, and a `request` edge records it.
- **The mirror stall** (about 23:29 IST) was fixed by W5's restart at 23:43; it caught up at 23:49.

## State

- Running: the subscriptions PR, and the reviews of #163 and #169.
- Next: live subscribe, renew and cancel, then the decline and the two limits, each once on production with its links. Then the owner's cap change, once the Coordinator decides the policy half.
- Blockers: none.
