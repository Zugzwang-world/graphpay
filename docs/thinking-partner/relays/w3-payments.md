# Relay: W3 Payments, 23:45 IST, Fri 6 Nov

## In plain words

- Tonight's payments stream: every money action in the story works live, with its explorer link and its Arkiv record (brief `briefs/2258-w3-payments.md`).
- **1. Re-order, done:** "Another coffee" re-orders the filter coffee for 0.80, the story's re-order (ADR-0073), instead of the 4.80 combo. It paid live at 23:34 IST. The Arkiv edges follow once the mirror runs again.
- **2. Subscriptions, in review:** Vitalik subscribes to the Sunday breakfast at 2.40, on the labelled 2-minute demo clock. 2.40 is stored on chain.
  - The payer agent signs, and pays no gas. The first box is charged at once; the renewal job charges the next ones.
  - The payer agent cancels with its own signature.
  - Each subscription can pull at most 3 charges (7.20), so the demo never eats the pass.
- **3. Refund decline, in its PR:** the shop can decline a refund request. The decline is recorded on Arkiv as the shop's answer to the payer agent. No money moves.
- **4. Limits:** next.

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
- **Decline (`pay/w3-refund-decline`):**
  - Route: `POST /api/merchant/refund-decline`.
  - It writes a W_SYNC `request` edge, shop to payer, ref `dec:<order>:<minute>`, and only against a `req:` request on the record. A `fail` edge touching the shop would count against it, so it is not one.
- **The mirror stall:** the workers on the Mac stopped polling at about 23:29 IST. W5 owns them and is told.

## State

- Running: the subscriptions review, and the decline PR.
- Next: live subscribe, renew and cancel after the merge; then the limits:
  - over the pass ("dosas for everyone");
  - the owner's cap change. POLICY_WRITER stays local (ADR-0021), so the bounded design goes to the Coordinator first;
  - the agent's refused cap raise.
- Blockers: the mirror stall, for the Arkiv records that come from the chain.
