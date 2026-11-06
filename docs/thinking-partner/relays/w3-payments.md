# Relay: W3 Payments, 23:40 IST, Fri 6 Nov

## In plain words

- Tonight's payments stream: every money action in the story works live, each with its explorer link and its Arkiv record (brief `briefs/2258-w3-payments.md`).
- **1. Re-order (in its PR):** "Another coffee" now re-orders the filter coffee for 0.80, the story's re-order (ADR-0073), instead of the 4.80 combo. The item, quantity and price come from `order.reorder` in the story; the server never takes them from the page. The old `BAD_402` was fixed by #131; this PR is proven by one live re-order after it deploys.
- **2. Subscriptions:** next.
- **3. Refund decline:** after that.
- **4. Limits** (over the pass, the owner's cap change, the agent's refused cap raise): last.

## Technical

- `packages/config/story.json`: `order.reorder` gains `sku` (`filter-and-fold-filter-coffee`) and `item`; its price is 800000. Only that key changes.
- `apps/web/lib/site.server.ts`: the site model carries the re-order's `sku` and `item`.
- `apps/web/lib/reorder.server.ts` and `reorder-live.server.ts`: the quote asks for the re-order's own sku, and the terms the payer signs must name it (else `PRICE_CHANGED`, nothing signed).
- Readers of the re-order kept in step: the shop's tests and fork script, and `scripts/whitechain/lifecycle.mjs`.
- Not mine, told to W5: `integration/hosted.mjs` C3 quotes the order's own sku for the re-order, and `acceptance/checks.mjs` still expects 1.20; both should follow `order.reorder`.

## State

- Running: the re-order PR.
- Next: subscribe and cancel routes (the payer agent signs; RENEWER, the second relayer, sends), then the refund decline, then the limits.
- Blockers: none.
