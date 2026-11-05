# M3 — Facilitator and the shop's 402 API

**Goal:** our own x402 facilitator for the `graphpay-order` scheme with the full drain-protection pipeline, and a stateless shop API that answers 402, settles through the facilitator and never charges twice.
**Depends on:** M1 (ABI); M7a's writer for the recorder routes; the real ENS gate from M6 (inject a stub on the fork only); **part B** needs M2, M5 and M6 merged. **Worktree:** `wt-payments` (`pay/facilitator`). **Model:** Opus High. **Time:** 60–75 min (lab: about 52 min over two sessions, two reviewer passes each).

## Inputs
`SPEC/PAYMENTS_WHITECHAIN.md` §5, §6, §8, §9, §10; `SPEC/IDENTITY_ENS.md` §7 (gate interface); `SPEC/INTEGRATION_AND_MIRROR.md` §3 (refusal records).

## Prompt
> In `packages/facilitator` build the `graphpay-order` scheme on `@x402/core` (verify the API names in `planning/SPEC/PAYMENTS_WHITECHAIN.md` §5 against the installed types first): the facilitator side (`verify`, `settle` through a one-at-a-time queue) and the client side (`createPaymentPayload` signing the Permit2 witness and the optional EIP-2612 approval). Implement the five-stage pipeline in §5 in that order: free schema and terms checks, the payer's signature before anything costly, on-chain prediction reads, send only if all pass (with the recorded-failure quota and never `NODE_MISMATCH`), and limits consumed only at send time. Decide `settle` from the receipt. Inject `ensGate(name, amountMicro)` (interface in `SPEC/IDENTITY_ENS.md` §7) with a 20 s cache keyed by exact spelling; refuse to start on a real network with a stub. POST every refusal to `ATTEMPTS_URL` (the recorder route `/api/recorder/attempts`, `SPEC/INTEGRATION_AND_MIRROR.md` §2) with the bearer `RECORDER_TOKEN`, attributed to a node only when the wallet is bound to it; a recorder outage must never block or fail a payment decision. Build the recorder routes here too, once M7a's writer has merged (until then the route answers 503 and the facilitator carries on): W_SYNC writes each record as one readonly edge with a unique `ref` (confirmed nonce; on a clash, re-check the `ref` and retry), no tallies. Start-up checks per §5. HTTP: bearer token on `/verify` and `/settle`, 64 KB body limit, rate limits, `/health` cached 5 s, `/supported`.
>
> In `packages/shop` build the shop API of §6: `/catalog` (synthetic, labelled), `/quote` (price from the catalog only), `/orders/:id/pay` and `/orders/:id/reorder` behind `X-Demo-Passcode`, 402 with exactly one `accepts` entry, `alreadyPaid` from chain state, 502 on facilitator outage, `markDelivered` with the merchant key when configured, stateless order ids (top bit cleared). Everything configurable by env (§9); the token and its EIP-712 domain are configuration checked at start-up.
>
> Offline tests with fakes for every refusal path in the pipeline (garbage, wrong token, wrong contract, unknown merchant, payload/requirement mismatch, bad signature, ERC-6492, used nonce, empty balance, approval that will not apply, cap/revoked/expired predicted, node mismatch never sent, limits not burned by refusals, gas cap, budget reservation, relayer floor, receipt timeout), plus a fork end-to-end: quote → 402 → sign → 200 → replay `alreadyPaid` → refund → re-order. Two reviewer passes. Ship.
>
> **Part B, real chain (once M2, M5 and M6 have merged):** run the facilitator and shop API locally against the real RPC (`ALLOW_REAL_NETWORK=1`), signing as FACILITATOR (before M4 hosts it; after M4, real payments go through the hosted facilitator only):
> 1. `lifecycle --token standin --buyer rehearsal`: play **as `rehearsal.vitalik`** (never `payer.vitalik`, whose 6.00 for this UTC day is kept for M12): gasless payment 4.80, replay → `alreadyPaid`, refund 0.80, re-order 1.20, over-cap refused off-chain, `scout.vitalik` revoked and then refused on-chain (`AGENT_REVOKED`), VITALIK as a human payer 0.40; rehearse first on an anvil fork.
> 2. `subscription demo|create|renew|cancel`: a 0.40 subscription with a 120 s demo period, renewed by RENEWER, cancelled with the subscriber's signature.
> 3. When test USDT has reached FUNDER: `usdt-ready --go --yes` deploys and verifies the USDT checkout, sets it up (its own policies, so `acceptance.vitalik` has a fresh 6.00 there), funds ACCEPTANCE_PAYER first (`planning/WALLETS.md` §3) and makes **the qualifying payment once, as `acceptance.vitalik`** (C7), printing its explorer link.

## Done when
- Unit tests and the fork e2e pass; the reviewer says "ship".
- A forged or doomed payment sends no transaction (tests prove it).
- With the stand-in configured, start-up checks pass against the real chain read-only.
- Part B: the lifecycle transcript shows every beat with explorer links and the payer's WBT unchanged; the subscription renewed once and was cancelled; C7 is done or `blocked: no test USDT`.

## Pitfalls
`SPEC/PAYMENTS_WHITECHAIN.md` §10 items 1, 2, 6, 7, 15, 16; `x402Client` spend controls deny custom assets until `allowedAssets` is set; `estimateGas` succeeds for doomed payments; send gas as `min(cap, max(1.2 × estimate, 400k))`; never print a start-up RPC error; look headers up case-insensitively.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`payments`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `payments` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/payments.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `payments` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `payments` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
