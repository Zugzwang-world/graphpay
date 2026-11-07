# Relay: records (the night Coordinator)

Updated 07:50 IST, Sat 7 Nov, by the night Coordinator (`local_1caa580c-782f-4658-a828-66758afb211a`).

## Plain language

The backend closed at 02:15 IST on the founder's word. Since then the Coordinator has kept the stage live: the payer agent is active, Filter & Fold is open, and the workers and the self-healing cron run.

**What changed this morning:**
- **A teammate's Arkiv key works.** It was probed first, then pushed to Vercel. The site was redeployed on the newest build of main (#224), and the workers were restarted on the key. The mirror now polls on the keyed endpoint, 2 blocks behind.
- **The payer was refilled** from the shop's takings at 06:11 IST (66.4 test USDT), back to its 125 target.
- **A bug was found at 07:17 IST.** The customer phone's "last order" was stuck on the 06:29 IST order. The stage's refund request and re-order both act on that last order, so on any newer order they answered NOT_THIS_ORDER. The fix (#225) is reviewed and green, and held for the founder's go: nothing merges without it since "merge nothing else".

**Held for the founder:**
- #225, the last-order fix;
- #220, a visitor refunds an order once, which needs main merged in first;
- #221, ADR-0082, the stage's scene 7 shows the lab's benchmark.

## Technical

- **The cause:**
  - `apps/web/lib/customer-state.server.ts` read `out(kind: "pay", sinceDay: today-30, limit: 50)`.
  - The engine (`packages/money-graph/src/graphql.mjs`, `edgesOfUncached`) returns a node's oldest edges first and slices at `min(listCap, limit)` without a flag.
  - With 55 payments, the newest five were cut.
- **The fix:**
  - The runner passes `listCap: LIST_CAP` (500, the engine's row cap, shared with the merchant feed), and the query asks `limit: 500`.
  - A full list, or `extensions.arkiv.truncated`, throws instead of being read as complete.
  - The last order comes from today, then yesterday, then the last 30 days, the first window holding a payment with an order id. The chain runs inside the `Promise.all`.
  - The pass bounds a day: 300 a day at the cheapest product, 0.60, is at most 500 payments.
- **Checks:** 305 web tests pass, including a cutting double that fails at `limit: 50`; the typecheck is clean; `pnpm check` is clean; CI is green.
- **Reviewer:** no blocking issue. One non-blocking note: a renewal settling after the newest dosa order becomes the last order. That is safe (same shop, same buyer, story price) and not new.
- **Live at 07:37 IST:**
  - the payer is ACTIVE, 57.6 of 300 spent;
  - PAYER holds 91.4 test USDT, SHOP_KESAR 152.41 and FUNDER 130.34;
  - FACILITATOR has 0.73 WBT;
  - the mirror is alive, lag 2.
