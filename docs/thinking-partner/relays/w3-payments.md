# Relay: W3 Payments, 00:25 IST, Sat 7 Nov

## In plain words

- **The brief:** every money action in the story works live, each with its explorer link and its Arkiv record (`briefs/2258-w3-payments.md`). All of it is live except the owner's cap change, which waits for W1's watcher.
- **1. Re-order, done:** "Another coffee" re-orders the filter coffee for 0.80 (ADR-0073), instead of the 4.80 combo.
- **2. Subscriptions, done:** Vitalik subscribes to the Sunday breakfast at 2.40, on the labelled 2-minute demo clock, and 2.40 is what the chain stores.
  - The payer agent signs and pays no gas, and the first box is charged at once.
  - The renewal job charged the next one by itself, and the payer agent cancelled with its own signature.
  - Each subscription can pull at most 3 charges (7.20), so the demo never eats the pass.
- **3. Refund decline, done:** the shop declines a refund request. The decline is recorded on Arkiv as the shop's answer to that request, and no money moves.
- **4. Limits:**
  - **over the pass, done:** "Dosas for everyone at the hackathon" (100 dosas, 480) against a 300 pass is refused before anything is sent, and the refusal is recorded;
  - **the agent's own cap raise, done:** ENS refuses it, with the revert reason. It was simulated, so nothing was sent, and the attempt is recorded;
  - **the owner's cap change, built:** the owner writes the ENS cap, and the spending policy follows through the watcher on the Mac, never above the configured cap (ADR-0078). It is live once W1's watcher change is merged and W5 restarts the workers.

## Technical

- **Re-order (#155):**
  - `order.reorder.sku` and `item`, at 800000. The quote asks for that sku, and the signed terms must name it.
  - A refunded parent order may be re-ordered.
  - Live: [tx](https://explorer.testnet.whitechain.io/tx/0xf1d7cb5654de6cc09ede0a404818a009f7429d9d149e3e564222d4a4d3ae2b4a), with OrderCreated kind 1 and the parent's id.
- **Subscriptions (#173):** `POST /api/customer/subscribe` and `/unsubscribe`.
  - What the payer's wallet signs: a Permit2 `PermitSingle` for price × `renewal.demoPeriod.maxCharges`, the `Subscribe` terms, and an EIP-2612 approval when short.
  - RENEWER (E-1) simulates, then sends. The persona is the subscriber node, so a cancel never raises the paying agent's cancel rate.
  - Subscribe is refused while any of the payer wallet's subscriptions is active (they share one allowance), and within 180 s of the last one (read from the chain).
  - The cron skips three cases: the allowance or token approval is spent, or the agent is paused in ENS.
  - `/api/state/customer` reports the subscription.
  - Live: [subscribe](https://explorer.testnet.whitechain.io/tx/0xf3f7586090fb37cf4b04963216dabc7b89915f02afb19f71fb81ca138e53c393), the cron's [renew](https://explorer.testnet.whitechain.io/tx/0x8d40d556382f40313dafaf712d3c174d7cc8365176c8813f04e849f93338de83), [cancel](https://explorer.testnet.whitechain.io/tx/0x70ed2b3ffa63b81fa426631c70cb39591f8b80c077455930d05e63de04077b42), and [Arkiv](https://graphpay-event.vercel.app/api/explain/23281094e730).
- **Decline (#163):** `POST /api/merchant/refund-decline`.
  - It writes a W_SYNC `request` edge, shop to payer, ref `dec:<order>:<request minute>`.
  - It waits while the chain shows a refund the graph doesn't yet. The `/order` page words it "Refund declined".
  - Notes and reasons refuse contact details.
  - Live: [explain](https://graphpay-event.vercel.app/api/explain/033a073bd39e).
- **Limits (#169):**
  - `POST /api/customer/over-pass` signs `order.overPass` only when it is above the whole pass, and sends it to our facilitator's verify step only (never settled). It got `CAP_EXCEEDED` and a [fail edge](https://rabdi.explorer.arkiv.network/entity/0x49163142476bc996134f3a4b0cac473f9698fa0781f39895206b138cfab1dc19).
  - `POST /api/customer/raise-cap` runs an eth_call of `setText` from the agent's address and gets `EACUnauthorizedAccountRoles`, at a stated block. Its [record](https://rabdi.explorer.arkiv.network/tx/0xabc41f475312767e363e073ec872c3ff4b3556883901201dca53f1dafd444144) is a `request` edge with amount 0.
  - A repeat within a minute gets the last answer.
- **Owner cap (#179, in review):** `POST /api/customer/cap`. The owner (VITALIK) runs `setCap` on Sepolia; the route waits up to 45 s for the policy and writes an `own:` record. Anything above `buyerAgents.payer.capMicro` is refused.
- **Every PR had a reviewer pass:** no blocking issues remain. The decline's two blocking items were fixed and confirmed.
- **Frontend:** every new route and event is listed in OPEN under "frontend".

## State

- Running: #179's review; W1's watcher PR, then W5's restart.
- Next: prove the owner's cap change live once (300 → 250 → 300).
- Blockers: none.
