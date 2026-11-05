# SPEC: Architecture

GraphPay, "Ask before you pay": a payment network and money graph for humans and AI agents. Agents are known by ENS names, pay over x402 on Whitechain, and every payment becomes part of a money graph on Arkiv that any agent can ask before it pays.

This file is the map. Each layer has its own spec. Everything here was proven in the lab before the event (see `DISCLOSURE.md`), except where a row says "not built" or "untested".

## 1. The four layers and who owns what

| layer | network | what it holds | spec |
|---|---|---|---|
| Identity | Ethereum Sepolia 11155111, ENSv2 | names under `graphpay.eth`: owners (human, shops), agents, the `sim` wildcard; status, caps, endpoints, payment preference | `SPEC/IDENTITY_ENS.md` |
| Rails | Whitechain Sepolia 1874 | `GraphPayCheckout`: orders, Permit2 nonces, AgentPolicy (caps, revocation), refunds, subscriptions, every event | `SPEC/PAYMENTS_WHITECHAIN.md` |
| Memory | Arkiv Rabdi 7794095 | the money graph: nodes (ENS + epoch), edges (one per event), tallies, pair links, checkpoints, refusal records, synthetic city | `SPEC/ARKIV_GRAPH.md` |
| Ask | Vercel (code only) | GraphQL over Arkiv with an explain trace, MCP tools for agents, the website | `SPEC/ARKIV_GRAPH.md`, `WEBSITE_SPEC.md` |

Agents (`SPEC/AGENTS.md`) sit on top: a buyer team (concierge, scout, analyst, payer) and a shop team per shop (storefront, risk, dispatch). The mirror and the one-command run that ties everything together are in `SPEC/INTEGRATION_AND_MIRROR.md`.

**No off-chain database (ADR-0003).** State lives on the Whitechain contract and on Arkiv. Vercel only runs code, and so does the one long-lived workers process (it keeps no state of its own: its cursor is a checkpoint on Arkiv). No Supabase, no Redis, no KV. Secrets live only in the Vercel environment and the local `.env`. No personal data is collected.

## 2. One purchase, end to end

```text
human prompt ─▶ concierge ─┬─▶ scout (catalogs)          ─┐
                           └─▶ analyst (GraphQL over Arkiv) ─┴─▶ code ranks, guards ─▶ payer
payer ─GET quote─▶ shop API ─▶ storefront + risk (ENS gate + buyer standing)
payer ─POST pay─▶ 402 PAYMENT-REQUIRED (scheme graphpay-order, eip155:1874)
payer signs one Permit2 witness (+ optional EIP-2612 approval), no gas
payer ─retry with PAYMENT-SIGNATURE─▶ shop API ─/verify,/settle─▶ facilitator (relayer pays gas)
facilitator ─ENS gate (Sepolia)─▶ ok ─settleOrder─▶ GraphPayCheckout ─events─▶ mirror
mirror ─one atomic Arkiv batch per event (edge + tallies + link + checkpoint)─▶ Arkiv
website / agents ─GraphQL (explainId, exact reads)─▶ Arkiv
```

Measured in the lab (synthetic data, Claude Haiku): the whole errand took 66,535–68,730 tokens and 13–14 tool calls (two runs, Whitechain fork, Arkiv emulator); the chosen shop was kesar-kingdom (score 0.986), syrup-street second (0.934), jamun-junction excluded at 18.4% refunds; 4.80 paid with no payer gas.

## 3. Components and where they run

| # | component | runs on | talks to | key secret (name only) |
|---|---|---|---|---|
| 1 | `GraphPayCheckout` contract | Whitechain Sepolia | — | — |
| 2 | Facilitator (`/verify`, `/settle`, `/supported`, `/health`) | Vercel Function (Node, Fluid) | Whitechain RPC, Sepolia RPC (ENS gate), the recorder | `FACILITATOR_PRIVATE_KEY`, `FACILITATOR_AUTH_TOKEN`, `RECORDER_TOKEN` |
| 3 | Shop API (`/catalog`, `/quote`, `/orders/:id/pay`, `/orders/:id/reorder`) | Vercel Function | facilitator, Whitechain (reads, `markDelivered`) | `DEMO_PASSCODE`, merchant keys (optional, see §5) |
| 4 | Workers process: the mirror (contract events → Arkiv) and the ENS watcher (registry events → existing AgentPolicies and node status) | **exactly one long-lived process**, on the founder's Mac during the event, polling every 2 s (`SPEC/INTEGRATION_AND_MIRROR.md` §2); never two at once | Whitechain RPC, Sepolia RPC, Arkiv RPC | `W_LEDGER_PRIVATE_KEY`, `POLICY_WRITER_PRIVATE_KEY`, `ARKIV_ACCESS_KEY` |
| 5 | Recorder (off-chain records: facilitator refusals, customer refund requests) | Vercel Functions `/api/recorder/*`, create-only | Arkiv RPC | `W_SYNC_PRIVATE_KEY`, `RECORDER_TOKEN` |
| 5b | Renewer (`renew` for due subscriptions) | Vercel cron every minute (safe: `renew` is guarded on-chain, a clash only costs a nonce) | Whitechain RPC | `RENEWER_PRIVATE_KEY`, `CRON_SECRET` |
| 6 | Graph Arkiv (GraphQL + explain + MCP) | Vercel Function (GraphQL Yoga) | Arkiv RPC (reads only) | `ARKIV_ACCESS_KEY` |
| 7 | Agents (buyer and shop teams) | Vercel Function, streamed to the website (SSE on the Node runtime) | MCP, shop API, ENS | `ANTHROPIC_API_KEY`, `PAYER_PRIVATE_KEY`, `VITALIK_PRIVATE_KEY` (owner actions) |
| 8 | Website (customer, merchant, explainer, race mode) | Vercel project `graphpay-event` (Next.js) | everything above, through server routes | `DEMO_PASSCODE` |
| 9 | Demo store using the checkout kit | a second Vercel project `graphpay-store` | shop API, facilitator | none beyond the kit's config |
| 10 | Seeder and benchmark | founder's Mac (long runs) | Arkiv | `W_SEED_EVENT_PRIVATE_KEY`, `W_SEED_M_EVENT_PRIVATE_KEY`, `ARKIV_ACCESS_KEY` |

## 4. Data per layer (decided, ADR-0003 and the integration spec)

| data | lives in | why |
|---|---|---|
| item, price, stock, ETA | the shop's catalog (code constant, synthetic, labelled) | not money, not identity |
| order terms, payment, refunds, subscriptions, AgentPolicy, Permit2 nonces | Whitechain contract | the authority for money |
| names, status (`active`/`paused`), ENS cap, endpoints, payment preference | ENS | identity |
| category, city, tallies, standing, every event as an edge, refusal records | Arkiv | the memory agents ask |

## 5. Trust boundaries

- **The model proposes, code disposes (ADR-0019).** Limits come from the human's words, read by code. Ranking is recomputed in code. The payer can only pay the approved order. Details: `SPEC/AGENTS.md` §3.
- **Three spend controls in series:** the payer's client checks every field of the 402; the facilitator verifies the signature and predicts the on-chain outcome before it spends gas; the contract enforces AgentPolicy (cap, revocation, expiry, wallet binding).
- **Roles on the contract are split (ADR-0021):** admin, relayer, policy writer, and each order's merchant. A stolen relayer key cannot lift a cap or pull refunds.
- **One wallet per paying agent; owner wallets are never bound** (the checkout binds one wallet to one node; `SPEC/PAYMENTS_WHITECHAIN.md` §2).
- **One W_LEDGER writer process at a time** (a second one can overwrite absolute tallies from a stale read; `SPEC/INTEGRATION_AND_MIRROR.md` §2).
- **The registry decides, not the records (identity spec §6).** A killed name resolves to empty strings, not an error; only registry state says whether an agent is alive.
- **Arkiv reads trust one owner per role.** Anyone can write entities with our schema names; every read filters by the trusted writer's address.
- **Merchant keys on Vercel:** the lab deployed none (the merchant marked delivery and refunded from its own wallet). The website's merchant buttons (dispatch, refunds) need the merchant key server-side behind the passcode. Decide at M4 (see `DECISIONS.md` E-3).

## 6. Networks and explorers

| network | chain id | RPC | explorer |
|---|---|---|---|
| Whitechain Sepolia | 1874 | `https://rpc.ankr.com/whitechain_testnet` (primary; its WSS needs premium); backup `https://rpc.testnet.whitechain.io` (50 req/s per IP) | https://explorer.testnet.whitechain.io (Blockscout) |
| Ethereum Sepolia | 11155111 | `https://ethereum-sepolia-rpc.publicnode.com` (public; load balanced) | https://sepolia.etherscan.io |
| Arkiv Rabdi | 7794095 | `https://rpc.rabdi.db-chain.testnet.arkiv.network/<access key>` | https://rabdi.explorer.arkiv.network |

Every on-chain action on the website opens its explorer page (`WEBSITE_SPEC.md`).

## 7. What the lab did not build (plan time for it)

- The website (customer and merchant screens, explainer, race mode) and the Sigma graph view.
- The checkout kit and the separate demo store (Whitechain Operate).
- The accountant export.
- Subscriptions through the website (the lab drove them from an operator script).
- The real-chain mode of the one-command run (the lab ran it on a Whitechain fork; real Whitechain was proven separately by the lifecycle script; Rabdi writes by the mirror were implemented but never run live).
- A payment in the real test USDT (none could be obtained; a labelled stand-in token was used).
- ERC-8004 and ENSIP-25 records, CCIP-Read, reverse names.
- The tracker agent and the Grok switch (the switch is one provider line; untested).
