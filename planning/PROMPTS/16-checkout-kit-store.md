# M16 — Checkout kit and the separate demo store

**Goal:** a GraphPay checkout kit that any shop integrates in about 20 lines, and a separate demo store app (Vercel project `graphpay-store`) that uses it, with customer and merchant views, refunds, renewals and an accountant export (Whitechain Operate).
**Depends on:** M4 (hosted shop API and facilitator). **Worktree:** `wt-web` (`web/kit`). **Model:** Sonnet High. **Time:** 60–90 min (not built in the lab).

## Inputs
`WEBSITE_SPEC.md` §10, `SPEC/PAYMENTS_WHITECHAIN.md` §4–§6, `SPONSOR_CHECKLIST.md` (Whitechain Operate).

## Prompt
> Build `packages/checkout-kit` to the interface in `planning/WEBSITE_SPEC.md` §10: a server helper that serves a shop's catalog, quote and 402 pay routes against our facilitator, and a client button that asks the buyer's browser wallet (Whitechain Sepolia 1874) to sign the Permit2 witness and the gasless EIP-2612 approval, then retries with `PAYMENT-SIGNATURE` and shows the receipt with its explorer link. Then `apps/store`, a small separate store for kesar-kingdom's sweets that integrates the kit in about 20 lines (count them; show them on a "How it's built" panel and in the README), with: a customer view (buy, re-order, subscribe to the Sunday sweets box, cancel), a merchant view (orders from Graph Arkiv, mark dispatched, partial and full refund, subscriptions), and the accountant export (CSV of orders, payments, refunds and renewals with amounts, dates, ENS names, transaction hashes and explorer links, read from GraphQL). Deploy it as its own Vercel project `graphpay-store`. Test the export columns and the 20-line claim (a test counts the integration lines).

## Done when
- A human pays in the store with a browser wallet and no gas; the receipt opens on the explorer.
- The export downloads and its rows match the chain.
- The README shows the ~20-line integration.

## Pitfalls
Browser-wallet signing of the witness was never tested in the lab (agents and scripts signed server-side): test the typed data in MetaMask early. A human payer must give a wallet address (two humans never share an order id). EIP-681 QR codes bypass the contract: use an HTTPS link.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`website`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `website` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/website.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `website` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `website` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
