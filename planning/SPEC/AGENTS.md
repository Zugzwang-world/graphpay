# SPEC: The agent teams

One request: *"Just landed in Mumbai. Get me the best gulab jamun near me under 6 USDT by 8 pm."* A buyer team finds, ranks, checks and pays; a shop team quotes, vets the buyer and dispatches. A price-only agent would pick `jamun-junction` (3.30 USDT, 18.4% refunds). This team never does, and no prompt is responsible for that: **code is** (ADR-0019).

Proven in the lab: live on Claude Haiku (`claude-haiku-5-5`) through real x402, the real ENS gate and Graph Arkiv over MCP; the whole errand took 66,535 tokens and 13 tool calls on the first run and 68,730 tokens and 14 tool calls on the hardened second run (Whitechain fork, Arkiv emulator), and the model's ranking matched the code's both times. All data synthetic and labelled.

## 1. Cast (one constant; `ROOT` = `graphpay.eth`)

| who | ENS name | wallet role |
|---|---|---|
| persona (human) | `vitalik.graphpay.eth` | VITALIK (owner: pauses and kills his agents) |
| buyer agents | `concierge.`, `scout.`, `analyst.`, `payer.` + `vitalik.graphpay.eth` | `payer` signs with PAYER (the stage payer); `scout` is bound to DEAL_HUNTER for the revoked-agent beat; concierge and analyst are held by VITALIK and never get a policy |
| working buyers | `rehearsal.vitalik.graphpay.eth` (the M3 part B lifecycle and every rehearsal), `acceptance.vitalik.graphpay.eth` (the acceptance suite) | REHEARSAL_PAYER, ACCEPTANCE_PAYER |
| kill target | `disposable-<n>.vitalik.graphpay.eth` (fresh label and fresh wallet per kill) | DISPOSABLE_<n> |

**One wallet per paying agent.** The checkout binds one wallet to one node and refuses a bound wallet that pays as a human (`SPEC/PAYMENTS_WHITECHAIN.md` §2), so no two paying agents share a wallet and no owner wallet is ever bound. `E2E_BUYER` picks which buyer agent the team pays as.
| shops | `kesar-kingdom.` (the good one), `jamun-junction.` (the trap), `syrup-street.` (runner-up) + `graphpay.eth` | SHOP_KESAR, SHOP_JAMUN, SHOP_SYRUP |
| shop agents | `storefront.`, `risk.`, `dispatch.` + `<shop>.graphpay.eth` | the shop's wallet |
| the order | 12 gulab jamun, 4.80 at kesar-kingdom, budget 6, by 8 pm IST | — |

Scenario data (SYNTHETIC, from the deck; inputs, not measurements):

| shop | refunds 90 d | on time | orders 90 d | verified | price for 12 | ETA | km |
|---|---|---|---|---|---|---|---|
| kesar-kingdom | 1.2% | 97% | 4,812 | yes | 4.80 | 45 min | 2.1 |
| syrup-street | 3.1% | 93% | 1,204 | yes | 4.20 | 50 min | 1.4 |
| jamun-junction | 18.4% | 71% | 2,190 | yes | 3.30 | 25 min | 0.9 |

Expected ranking, computed in code (never typed in): kesar-kingdom 0.986 > syrup-street 0.934 > jamun-junction 0.821 (excluded).

## 2. Roles

| role | side | tools | structured output | job |
|---|---|---|---|---|
| concierge | buyer | `scout`, `analyst`, `pay_shop` (sub-agents or a guarded action) | `{ summary, chosenShop }` | parse the need, delegate, choose, report |
| scout | buyer | `directory_list`, `catalog_read` | `{ offers: Quote[] }` | discover shops; read every catalog in one step |
| analyst | buyer | MCP `schema`, `ask`, `graphql`, `explain` | `{ ranking, recommendation, notes }` | one graph call for tallies, then `explain` |
| payer | buyer | `get_quote`, `pay_order` (bound to the approved order) | `{ status, reason, receiptTransaction }` | buy exactly the approved order |
| storefront | shop | `catalog_quote` | `{ quoteUsdt, etaMinutes, message }` | quote the catalog price |
| risk | shop | MCP tools + `ens_check` | `{ decision, reasons[] }` | vet the buyer agent before quoting |
| dispatch | shop | `dispatch_confirm` | `{ confirmed, orderId, etaIso, message }` | confirm delivery after settlement |

Every agent is an AI SDK 7 `ToolLoopAgent` with `output: Output.object({ schema })` and `stopWhen: isStepCount(8)` (the SDK default is 20 steps). The final structured output is validated by zod; if it is missing, record `agent.end { error }` and treat it as "no answer".

## 3. The model proposes, code disposes (guards)

Each guard holds against a hostile model. Name each test after its promise ("the trap is never paid"): judges read test names.

| # | guard | enforced in code |
|---|---|---|
| G1 | **Limits come from the human's words.** Budget ("under 6 USDT") and deadline ("by 8 pm", IST) are parsed by code from the request. The model's own budget and deadline are overwritten; a disagreement is logged. No readable budget or deadline: no agent runs (fail closed) | mandate parser, need adoption |
| G2 | **The trap is never paid.** Ranking is recomputed in code from the tallies the graph returned, from **code's own fixed GraphQL query** (a model-written query can alias `refundRate: fails` or pick another window). `pay_shop` refuses any shop not ranked eligible | ranking, pay guard |
| G3 | Budget and deadline checked against the mandate; dates with `Date.parse` and `!(arrives <= deadline)` so `NaN` refuses | pay guard |
| G4 | **The payer acts only on the approved order.** Its tools close over `{ shopEns, storefront, item, quantity, maxPriceUsdt, deadlineIso }` and refuse any other shop, quantity or order id. No free-form URL tool | payer tools |
| G5 | **Client spend controls:** resource host and pay URL = the approved storefront; scheme, asset and network allowed; `payTo` = the approved shop's payout address; the order id = the quoted one; contract known; amount ≤ budget − spent and ≤ approved price. **Refuse a 402 with more than one `accepts` entry** and sign only the entry you checked | payer client |
| G6 | Facilitator policy (`SPEC/PAYMENTS_WHITECHAIN.md` §5) | facilitator |
| G7 | On-chain AgentPolicy: revoked flag, expiry, daily cap, even if the ENS read was stale | contract |
| G8 | A revoked, expired or paused payer is refused by the shop's risk step before any 402, and again at settlement. **Arkiv and ENS must both say active**; an ENS read error is a refusal, never "active" | shop risk, facilitator, contract |
| G9 | Stricter wins: the shop's decision is code reasons ∪ model reasons | shop risk |
| G10 | **One payment per errand, one charge per order, atomically.** Reserve synchronously before any `await` (the SDK runs same-step tool calls concurrently, so three parallel `pay_shop` calls must not all pass); `pay_order` is single-flight; the shop keeps the in-flight settlement per order; the contract enforces the order id | pay guard, payer tools, shop |
| G11 | Orders are shop-scoped and bound to their resource URL; quotes expire (10 min) | shop |
| G12 | Phases: `pay_shop` is refused until scout and analyst have both reported | pay guard |
| G13 | Tool data wins over model text for the price, the delivery plan and the receipt. Model prose is never shown as a figure | result builder |
| G14 | No secret in the log: scrub configured keys and `sk-`/`xai-` shapes from agent and tool errors before tracing | scrubber |
| G15 | The ranking is a 90-day ranking: a model query for another window does not feed it | ranking |
| G16 | **An unclear settlement is not a failure.** After a signature, only three answers are final: a refusal before sending (4xx with no settlement response), a reverted transaction, or a `PaymentFailed` the chain recorded. A receipt timeout, a send error, a 5xx, no answer, or a 200 without a receipt may still move money: keep the reservation, count the amount as spent, report `unsettled`, never pay again in that errand | payer tools |

## 4. Orchestration

```text
request ─▶ concierge ─┬─▶ scout   (catalogs) ─┐
                      └─▶ analyst (graph)    ─┴─▶ choose ─▶ pay_shop ─▶ payer ─▶ shop: quote → risk → 402 → settle → dispatch
```

1. Sub-agents are tools of the concierge (`scout`, `analyst`, `pay_shop`); the concierge's prompt says to call scout and analyst in the same step.
2. AI SDK 7 runs tool calls of one step concurrently (`toolCallConcurrency` caps it). No hand-written `Promise.all`.
3. The same pattern repeats inside agents: the scout reads every catalog in one step; the risk agent calls `graphql` and `ens_check` in one step.
4. Shared state is code-owned and small: `RunState { mandate, need, quotes, tallies, ranking, scoutDone, analystDone, payment, paying, refusals }`. Parallel tools write disjoint fields; the need is set once.
5. Join in code: the pay guard runs only after both phase flags are set. The model decides **which** shop; the guard decides **whether**.
6. Payment is one guarded tool; there is no free-form agent-to-agent payment channel.
7. The run log records `agent.start`/`agent.end` with a sequence number, so parallelism is testable (both starts before either end).

## 5. Tool interfaces (zod schemas; names stay the same from mock to real)

- MCP `schema`, `ask`, `graphql`, `explain`: `SPEC/ARKIV_GRAPH.md` §6. Connect with `createMCPClient` from `@ai-sdk/mcp` and `await client.tools()`.
- `ask(buyer_risk)` TSV columns: `ens status orders cancellations disputes daily_cap_usdt spend_today_usdt principal principal_verified`. `ask(compare_shops)`: `ens orders refund_rate on_time_rate verified_owner score`, best first.
- **Code's fixed ranking query** (the "one call ranks every shop" moment), against the real SDL: all `nodes(kind: "shop", category, city)` with `ens`, `verified`, `status` and `reputation(window: D90) { orders refundRate onTimeRate source synthetic }`. It must return `extensions.arkiv.explainId`.
- `ens_check({ name }) → { name, registryState: 'REGISTERED'|'EXPIRED'|'UNREGISTERED'|'UNKNOWN', status: 'ACTIVE'|'PAUSED'|'REVOKED'|'EXPIRED'|'UNKNOWN', records: { 'agent-context', 'agent-endpoint[mcp]', 'graphpay.status', 'graphpay.cap_micro', 'graphpay.principal', 'graphpay.kind' } }`. Status rule: UNREGISTERED = REVOKED; EXPIRED = EXPIRED; `graphpay.status=paused` = PAUSED; otherwise ACTIVE. Implement it on the ENS gate (registry state, not resolution).
- `directory_list({ category, city }) → { shops: string[] }` (Arkiv nodes by kind, category and city, current epoch).
- `catalog_read({ shopEns }) → { offers: Quote[] }`; `Quote = { shop, sku, item, quantity, priceUsdt, etaMinutes, distanceKm }`.
- `catalog_quote({ item, quantity }) → Quote` (binding; price scales with quantity, rounded **up**).
- `dispatch_confirm({ item, quantity, deadlineIso, orderId }) → { confirmed, orderId, etaIso, meetsDeadline, courier }` (confirms from what the shop API did on-chain).
- `get_quote()` and `pay_order()` take **no** free-form URL or amount: everything comes from the approved order.

## 6. Data contracts (zod)

| contract | fields |
|---|---|
| `NeedSpec` | `need: 'food'|'shirt'|'ride', item, category, quantity: int > 0, budgetUsdt: /^\d+(\.\d{1,6})?$/, deadlineIso, city, buyer` |
| `Quote` | `shop, sku, item, quantity, priceUsdt, etaMinutes, distanceKm` |
| `ShopTally` | `ens, refundRate90d, onTimeRate90d, orders90d, verifiedOwner` |
| `AgentStanding` | `ens, principal { ens, verifiedOwner }, status, orders, cancellations, disputes, dailyCapUsdt, spendTodayUsdt` |
| `RankedShop` | `ens, score, eligible, reasons[]` |
| `Receipt` | `success, transaction, network, payer, payTo, amountUsdt, asset, explorerUrl` |
| `Mandate` | `budgetUsdt, deadlineIso, hash` |

Money is a decimal string at the edges and a bigint of 6-decimal units inside; never a float (`Number('4.80') * 1e6` rounds wrong). Compare as bigints; validate numeric strings with a regex first.

## 7. Scoring and policy (scenario constants)

- `score = 0.40 × (1 − refundRate) + 0.30 × onTimeRate + 0.20 × volume + 0.10 × verified`
- `volume = min(1, ln(orders90d) / ln(4812))` (4,812 = the busiest cast shop)
- A shop is **ineligible** if refundRate > 10% or onTimeRate < 80%; ineligible shops sort last with their reasons. The gate exists because a weighted blend alone could still pick a cheap risky shop.
- Buyer side (risk agent): decline if status is not ACTIVE, cancellations / orders > 15%, disputes > 5, or spend today + this order > daily cap.

## 8. Prompts (short on purpose: the guards are in code)

Every prompt ends with the shared tail:

```text
All data you can reach is SYNTHETIC or MOCK, and tools say so; say it too when you quote numbers.
Use only numbers that tool results gave you. Never invent a price, rate, address or hash.
When you are done, answer with the JSON object your output schema asks for, and nothing else.
```

**concierge**
```text
You are the concierge agent of a buyer. You turn one request into a purchase by delegating to your team.
1. Parse the request into a need: item, quantity (a standard box unless said), budget in USDT, deadline as an ISO instant, city.
2. Call the `scout` and `analyst` tools in the SAME step: they are independent, so they run in parallel.
3. Choose the shop: the best-ranked ELIGIBLE shop from the analyst that has a scout offer within budget and deadline. Never choose a shop the analyst marked ineligible, even if it is cheaper.
4. Call `pay_shop` once for the chosen shop. If it refuses, report the refusal; do not try to get round it.
Finish with a short summary for the human: who you chose, the price, and why the others lost.
```

**scout**
```text
You are the scout agent. Find who sells the requested item in the city and what they charge.
Call `directory_list`, then call `catalog_read` for EVERY shop it returns in one step (they are independent). Report only offers for the requested item. Do not rank shops: that is the analyst's job.
```

**analyst** (insert the SDL the `schema` tool returns at build time)
```text
You are the analyst agent. Rank shops by trust, not price. Ask the GraphPay graph once, with `graphql`, for the shops that sell the item in the city, then call `explain` on that result so the human can see the work.
Rank with the reputation the graph returns. Mark a shop ineligible if its 90-day refund rate is above 10% or its on-time rate is below 80%, and say why. Cheap does not make a risky shop eligible.
GraphQL schema:
<SDL from the schema tool>
```

**payer** (changed from the lab: the lab text named a free-form `x402_fetch` tool, which pitfall 2 forbids)
```text
You are the payer agent of a buyer. You may pay one shop, once, for exactly the order you were given.
Call `get_quote`, then `pay_order`. The tools already know the approved shop, item, quantity and maximum price, and they handle the 402 challenge. If a tool reports a refusal, report it as it is; never retry with different numbers.
```

**storefront**
```text
You are a shop's storefront agent. Quote the buyer the shop's price for the item and quantity by calling `catalog_quote`. Do not discount and do not guess; if the shop does not sell the item, say so.
```

**risk** (insert the SDL)
```text
You are a shop's risk agent. Before the shop quotes an order, check the buyer agent: call `graphql` for its standing (status, cancel rate, disputes, daily spend cap) and `ens_check` for its name, in the SAME step.
Decline if the name is not ACTIVE (revoked or expired), if the cancel rate is above 15%, if disputes exceed 5, or if spend today plus this order passes its daily cap. Otherwise approve. You may only say no more often than the policy, never yes less strictly.
GraphQL schema:
<SDL from the schema tool>
```

**dispatch**
```text
You are a shop's dispatch agent. After payment settles, confirm delivery by calling `dispatch_confirm`. Report the order id and the arrival time exactly as the tool gives them.
```

Task messages are plain JSON in the user turn (`Task (JSON): {...}`). The concierge's task carries `request`, `buyer`, `now`, `timezone: Asia/Kolkata (UTC+05:30)`, `defaults: { food: { quantity: 12, item: 'gulab jamun' } }`.

## 9. Run log (what the website's agent feed and explainer replay)

Schema `graphpay.agent-run/v1`: `{ schema, label, runId, mode: 'mock'|'anthropic', model, synthetic: true, cast, request, edges: [{ seq, from, to }], events: TraceEvent[], result: { status: 'paid'|'refused'|'no-purchase'|'unsettled', chosenShop, priceUsdt, receipt, orderId, arrivesAt, ranking, refusals[], narrative, synthetic }, usageTokens }`.
`TraceEvent` = `message {from, to, text}` | `agent.start {agent, role, task}` | `agent.end {agent, role, output, usageTokens?}` | `tool.call {agent, tool, input}` | `tool.result {agent, tool, output, error?}` | `guard {guard, ok, detail}`. Sequence-numbered.
Replay hooks: `message` → pulses between ENS names; `tool.result` of `explain` carries entity keys → highlight the subgraph; `guard` with `ok:false` → the red veto; `result.receipt` → the settlement chip with the explorer link. Stream events to the website as they happen (SSE).

## 10. Runtime and model switch (re-verify versions at 9 pm)

- Lab versions (2026-11-03): `ai@7.0.162`, `@ai-sdk/anthropic@4.0.96`, `@ai-sdk/mcp@2.0.90`, `zod@4.6.7`, `@x402/*@2.29.0`. AI SDK 7 needs Node 22+ and ESM.
- Model: `claude-haiku-5-5` by default (`AGENT_MODEL` overrides), key `ANTHROPIC_API_KEY`. `AGENT_MODE=mock|anthropic|auto` (auto = live only when the key exists; an unknown value is an error, never a silent paid run).
- Grok (optional): `AGENT_PROVIDER=grok` with `@ai-sdk/xai` and `XAI_API_KEY`, one provider line; untested. R2 named `grok-4.7` (from research; re-verify).
- Mock model for CI: `MockLanguageModelV4` from `ai/test` with a script per role (tool results so far → next tool calls or the final JSON). Bad-play scripts: price-only concierge, lying analyst, overspend and wrong-shop payer.
- Log `usageTokens` from `result.usage.totalTokens`: agent-token figures on screen come only from measured runs.

## 11. Live wiring (how the lab connected the agents to the real services)

- Keep the agents package free of heavy runtime imports; give it interfaces only (`LiveHooks`, `McpLike`, `ShopSurface`) and wire the real clients from outside (the lab's agents package could not import the Arkiv package because of different TypeScript settings).
- **MCP:** the Graph Arkiv MCP server reached over an in-memory MCP transport (same process) or HTTP.
- **Hooks:** ENS through the gate (cached 20 s); the directory from Graph Arkiv; the catalog from the shop API; x402 signing with the `graphpay-order` client scheme, limited to the approved payee and price.
- **Shop gateway:** the shop's storefront, risk and dispatch agents in front of the real shop API; it rewrites the 402's resource path to the agent-facing URL.
- **Risk check in code** from `buyer_risk` standing and the ENS gate; the model can only be stricter. Dispatch confirms from what the shop API did on-chain.

## 12. More needs (configuration only; show the structure, build food)

`NEEDS: Record<'food'|'shirt'|'ride', { enabled, status: 'implemented'|'config-only', label, team: { scout, analyst, payer }, category, defaults: { quantity, item? }, rankingBasis, fulfilment }>`. Food uses plain role labels; other needs prefix the role (`shirt-scout.vitalik.graphpay.eth`, `ride-payer.vitalik.graphpay.eth`). Each team's payer has its own name, policy cap and blast radius; revoking one stops that team only.

## 13. Pitfalls

1. Guards in prompts are not guards. A lab draft compared the model's need to itself and let a payer tool take any URL.
2. A model-visible `x402_fetch(url, body)` lets a hallucinated URL pay the trap.
3. A hard-coded mandate (6.00) hid a budget bug: the facilitator's budget must be the request's.
4. Pending-quote keys without the shop let shop A's 402 settle at shop B.
5. Float money; date strings compared as strings; `NaN` compares false both ways.
6. Header case: look `payment-required` up case-insensitively.
7. Provider errors can echo keys; test the scrubber with a throwing model.
8. An `AGENT_MODE` typo must not fall through to a paid call.
9. A `graphql` tool that returns only `data` leaves the agent unable to call `explain`: surface `explainId`.
10. Concurrency is the bug class sequential tests miss: check-then-act across an `await` double-spends.
11. Structured output from a tool-using live model is the least-tested path: check `result.output` is non-null and tune the JSON tail on the first live runs.
12. A 502 after signing must not release the reservation (G16).
13. A key-shaped literal in a test (for example `sk-ant-…`) trips the secret scan: build it at run time.
