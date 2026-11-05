# SPEC: The mirror and the one-command integration run

**The mirror** turns `GraphPayCheckout` events into Graph Arkiv writes (our own code, not arkiv-sync). **The integration run** (`pnpm e2e:food`) takes Vitalik's errand through every layer in one command and checks the outcome with assertions.

Proven in the lab: `pnpm e2e:food` passed 6 of 6 assertions on Claude Haiku with Whitechain as a local fork, Arkiv as the emulator (ArkivSim) and ENS on real Sepolia (including one real kill). Separately, the mirror read all 26 real events of the real Whitechain lifecycle run and its tallies matched exactly. **Not run in the lab:** the paying side on real Whitechain inside `e2e:food`, and the mirror writing to real Rabdi. At the event both are first runs (M11, M12).

## 1. Wiring

| # | component | process | reads / writes | talks to |
|---|---|---|---|---|
| 1 | Whitechain | fork (`anvil --fork-url https://rpc.testnet.whitechain.io --chain-id 1874`) for rehearsal; the real chain for the event | test USDT or stand-in, Permit2 | everyone |
| 2 | `GraphPayCheckout` | deployed by the run on a fork; the deployed address on the real chain | orders, AgentPolicy, events | facilitator (relayer), merchants, policy writer |
| 3 | mirror (with the ENS watcher, in one "workers" process) | **exactly one long-lived process** (the founder's Mac during the event), polling every 2 s | **the only writer** of nodes, chain-derived edges, tallies, links and checkpoints (W_LEDGER); reads the chain and the recorder's edges | Arkiv, Whitechain RPC, Sepolia RPC |
| 3b | recorder | Vercel routes `/api/recorder/attempts`, `/api/recorder/requests` | writes readonly off-chain records only (facilitator refusals, customer refund requests) from W_SYNC; never tallies | Arkiv |
| 4 | Arkiv | ArkivSim in process (rehearsal); Rabdi (event) | nodes, edges, tallies, links, checkpoints | mirror and recorder (writers), every reader |
| 5 | Graph Arkiv | GraphQL + MCP | reads Arkiv; trusted owners W_LEDGER (everything) and W_SYNC (off-chain edges only) | Arkiv RPC |
| 6 | facilitator | Vercel (event) or local | sends `settleOrder`; reads ENS on Sepolia | chain, Sepolia RPC, recorder `/api/recorder/attempts` |
| 7 | shop API | Vercel or local | `markDelivered` and refunds with merchant keys | facilitator |
| 8 | agents | the run's own process (local) or a Vercel function (website) | MCP, ENS, catalog, x402 signing | shop gateway, MCP |

## 2. The mirror

**One writer, by construction (ADR-0020, ADR-0023).** Exactly one mirror process runs at a time; it is the only W_LEDGER writer. Do **not** run it on Vercel cron plus an on-demand trigger: two overlapping invocations can each read the anchors, and if the second fetches the confirmed nonce after the first has landed, its batch built on stale state lands at the next nonce and overwrites the absolute tallies (and the stale `ref` check lets a duplicate edge through). Confirmed nonces stop two sends at the same nonce, not a stale read. Defences in depth: read the confirmed nonce **before** reading the anchors and send at exactly that nonce (a "nonce too low" means someone else wrote: start over); and a reconcile job that recounts the cast's tallies from edges with `count()` and deletes duplicate edges by `ref`. Optional fallback when the process is down: a Vercel cron that runs only if the process's heartbeat (a lease row patched every 30 s) is older than 90 s; untested.

**Off-chain records come from a second, create-only writer (W_SYNC, "the recorder").** The hosted facilitator cannot reach a process on the founder's Mac, so refusals and customer refund requests are written by Vercel routes as readonly edges owned by W_SYNC, each with a unique `ref`; on a nonce clash the route re-checks `ref` and retries. They carry no tallies. The mirror polls the recorder's edges (owner W_SYNC, by `ts` from its own `recorder` checkpoint) and folds refusals into the tallies (`fails + 1`) in its own batches. Readers trust both owners for edges (one call per owner, merged and de-duplicated by `ref`).

**Mirror service endpoints** (local only): `/health`, `/status`, `/sync` (poll now and return only after the writes landed; used by the local run). The cast and the history are registered at start-up from a bootstrap file. For the website's lag chip, the mirror patches a heartbeat row on Arkiv every 30 s (cursor, last block, lag), which also serves as the fallback lease.

**Per event, in order:**
1. Skip it if it is at or before the stream checkpoint.
2. Skip it if an edge with `ref` = its id (`1874:<tx>:<logIndex>`) exists.
3. Otherwise map it (§3) and queue the stream checkpoint in the **same** `executeBatch` (`SPEC/ARKIV_GRAPH.md` §7).
4. Payer epoch from the event; shop and buyer epochs from the node rows. **Fresh ENSv2 names are epoch 0**; the mirror stamps the ENS epoch and the AgentPolicy uses the same epoch.
5. Events whose actors are unknown are parked and written when the actors are registered. **Register actors before the chain source starts** (the deploy's `AgentPolicySet` arrives first).
6. On any failed write: discard the queued operations, re-adopt state from Arkiv, re-read from the cursor, rethrow.

**Chain source:** poll `eth_getLogs` in ranges of at most 1,000 blocks from the checkpoint to `head − CONFIRMATIONS` (2 on Whitechain). Read the head with `cacheTime: 0` (viem caches `getBlockNumber` for its polling interval, about 4 s, and a lab `/sync` returned before the payment was mirrored). One lock covers each poll and its write; `/sync` waits on it. Advance only after the write.

**On time** = delivered within a promise after the payment's time (default 2 h; the contract has no delivery promise: `OrderCreated.deadline` is the payment deadline). Read the payment time back from Arkiv after a restart.

**Latency:** polling every 2 s on Whitechain's 1 s blocks with `CONFIRMATIONS=2`, plus a 5–8 s Rabdi write, puts a payment on Arkiv about 10–15 s after its receipt (estimate). The website shows the lag chip; nothing needs to call the mirror.

**Labelled synthetic history** for the three cast shops (the deck's 90 days: 4,812, 2,190 and 1,204 orders, exact refund and late counts, today left empty) is a separate stream named after its parameters; a different history is refused, not seeded on top. Full scale is 25,116 events (1,005 batches of 25 on the emulator in 4.4 s): far too many for Rabdi. **On Rabdi use 5%** (`history.scale` 0.05): about **1,256 events**, written in 25-event logical batches split by bytes (`SPEC/ARKIV_GRAPH.md` §7) into about 100 transactions (about 10–15 minutes and 0.7–0.9 tGLM, a projection from the S seed). (The lab's integration spec said "about 50 transactions": that counted 25-event batches without the byte split.) Scale assertion D's expected counts and the agents' expected scores with it (`ACCEPTANCE_TESTS.md` E2).

## 3. Event → Arkiv mapping

| contract event | Arkiv write | notes |
|---|---|---|
| `OrderCreated` | `order` edge payer → shop (the human buyer if `payerNode` = 0), amount, `order_id` | caches buyer, shop, payer for the order |
| `PaymentSettled` | `pay` edge payer → shop; `from_epoch` = `payerEpoch` | records the payment time |
| `PaymentFailed` | `fail` edge, payload `{ onchain: true, reason }`; `DUPLICATE` not counted | |
| `Refunded` | `refund` edge shop → the order's payer | |
| `OrderDelivered` | `deliver` (within the promise) or `late`, shop → payer | |
| `OrderCancelled`, `Disputed` | `cancel` / `dispute` payer → shop; `by` in the payload | |
| `SubscriptionCreated` / `Renewed` / `RenewalFailed` / `Cancelled` | `subscribe` (`order_id` = subId) / `renew` (amount 0) / `fail` / `cancel` | money is on the renewal's `PaymentSettled` |
| `AgentPolicySet` | patch the node's `status` and `cap_micro` (same epoch only) | standing, not an edge |
| facilitator refusal (recorder `POST /api/recorder/attempts`) | **written by W_SYNC:** off-chain `fail` edge payer → shop, payload `{ onchain: false, reason }`, `ref` = `att:<orderId>:<payer>:<n>`; **the mirror then adds `fails + 1`** | attributed to a node only when the signing wallet is bound to it |
| customer refund request (recorder `POST /api/recorder/requests`, new at the event) | **written by W_SYNC:** `request` edge payer → shop, payload `{ orderId, amountMicro, reason }`, `ref` = `req:<orderId>:<n>` | moves no tally; the merchant screen lists open requests |
| ownership and role events | none (the cursor advances) | |

Expected result of the lab's fork transcript, as a mirror test: kesar-kingdom orders 5, paid 6.40, 1 refund of 0.80, 2 fails, 3 delivered.

## 4. `pnpm e2e:food`: start order

| step | what | ready when |
|---|---|---|
| 1 | Load secrets through the git-based env loader (names printed, never values): `ANTHROPIC_API_KEY`, `VITALIK_PRIVATE_KEY`, `PAYER_PRIVATE_KEY`, and on real networks the role keys | — |
| 2 | Read the cast from ENS on real Sepolia through the gate (18 names, 6 at a time): epoch and standing per name | about 10–12 s |
| 3 | **Fork mode:** start the fork; build the contract if the ABI changed; impersonate a token holder (fork only); fund throwaway wallets; deploy with the 5-argument constructor; merchants approve refunds. **Real mode:** skip all of this; use the deployed checkout and the funded role wallets | `eth_chainId` = 1874 |
| 4 | `setPolicy` from the configured list, each agent with **its own wallet** (`SPEC/PAYMENTS_WHITECHAIN.md` §2): the run's buyer agent (cap 6.00/day) and the disposable agent (1.00/day), epoch from ENS, from the policy writer (real mode: only if not already set) | receipts |
| 5 | Mirror with the cast and the history registered **before** the chain source starts | `GET /health` |
| 6 | Facilitator with its start-up checks | `GET /health` |
| 7 | Shop API | `GET /health` |
| 8 | Agents in process: MCP to Graph Arkiv, live hooks, shop gateway, prompts with the real SDL; Haiku first, the mock model as fallback | — |
| 9 | After each chain step: `POST /sync` on the mirror | returns after the writes |

## 5. Assertions (lab: all passed on the fork, 2026-11-04)

| id | assertion | how it is checked | lab value |
|---|---|---|---|
| A | the shop is chosen from live GraphQL reputation; the trap is never paid | the analyst's `graphql` answer carries `extensions.arkiv.explainId` and the shop rows; no jamun order or payment on-chain; jamun's balance unchanged | kesar 0.986 > syrup 0.934 > jamun 0.821 EXCLUDED |
| B | the payment settles | `PaymentSettled` for the order; payer −4.80, kesar +4.80; the receipt label says FORK or WHITECHAIN | 4.80 |
| C | the events are mirrored | mirror cursor ≥ the settle block; `order(id)` trail = order → pay → deliver, each `ref` = `1874:<tx>:<logIndex>` | — |
| D | GraphQL shows the new edge and updated tallies | kesar TODAY: 1 order, 4.80 paid, 1 delivered, 1 on time; all-time orders = history + 1; payer TODAY paid 4.80 | 4,813 = 4,812 + 1 (full history) |
| E | a partial refund updates the tallies | merchant `refund(order, 0.80)`; kesar TODAY refunds 1, refunded 0.80; all-time refunds +1; trail ends in `refund` | 58 → 59 |
| F | a killed agent is refused | the disposable agent pays 0.40 while alive; the owner's `unregister` on real Sepolia; after the 20 s gate cache the next payment gets HTTP 402 `refused: ENS_EXPIRED_OR_REVOKED`; the mirror records an off-chain `fail` edge | about 20 s to bite |

The kill is one-shot per label. A run that finds its label already killed checks only the refusal. Provision a fresh disposable agent (3 Sepolia transactions) before each rehearsal that should kill live.

**Outputs:** a readable transcript (`e2e-food-transcript.md`) and a machine run file (`graphpay.integration-run/v1`: the agents' run log, chain events with explorer links, the mirror's writes, the GraphQL answers and their explain ids, the kill, the assertions). The website's replay and `ACCEPTANCE_REPORT.md` read the same file. Only live-model runs write these; mock runs write elsewhere.

**Lab timing:** about 2 min 16 s for the whole fork run on the founder's Mac (with a 21 s cache wait for the kill); Haiku used 66,535 tokens and 13 tool calls on the first run and 68,730 tokens and 14 tool calls on the hardened second run (fork and emulator).

## 6. Real-network mode (the event)

Env only, no code branches beyond "skip the fork deploy":
- facilitator and shop: `WHITECHAIN_RPC_URL=https://rpc.ankr.com/whitechain_testnet` (backup `https://rpc.testnet.whitechain.io`), `ALLOW_REAL_NETWORK=1`, `GRAPHPAY_CONTRACT`, `GRAPHPAY_TOKEN`, `GRAPHPAY_TOKEN_NAME`, `GRAPHPAY_TOKEN_VERSION`, `FACILITATOR_PRIVATE_KEY` (the relayer), merchant keys;
- the payer signs with `PAYER_PRIVATE_KEY`;
- mirror: `ARKIV_BACKEND=rabdi`, `ARKIV_ACCESS_KEY`, `W_LEDGER_PRIVATE_KEY`, `CONFIRMATIONS=2`, `MIRROR_SYNTHETIC=0` for the real stream, `E2E_HISTORY_SCALE=0.05`;
- labels: receipts say `WHITECHAIN`; anything from a stand-in checkout says "stand-in" wherever it shows.
- **Mind the daily cap:** a 6.00 agent's day is spent after one errand plus a re-order (4.80 + 1.20). The cap resets at 00:00 UTC (**05:30 IST**), so everything from Thursday 21:00 to Friday 05:30 IST is one UTC day. **The M3 part B lifecycle and every rehearsal pay as `rehearsal.vitalik.graphpay.eth` (cap 30.00, enough for the lifecycle and four errands); acceptance pays as `acceptance.vitalik.graphpay.eth`; `payer.vitalik` pays only in the M12 real run and on stage** (`E2E_BUYER` selects the agent). A second full errand by one agent in the same UTC day is refused off-chain with `CAP_EXCEEDED`.

Cost of one real errand (lab receipts): settle about 312k gas (0.0016 WBT) on Whitechain; 6–7 Arkiv operations per mirrored money event (about 0.0003 tGLM each); ENS reads are free; the kill is one Sepolia transaction (163k gas).

## 7. Environment variables (names only)

| service | variables |
|---|---|
| run | `ANTHROPIC_API_KEY`, `VITALIK_PRIVATE_KEY`, the buyer agent's key (`PAYER_PRIVATE_KEY`, `REHEARSAL_PAYER_PRIVATE_KEY` or `ACCEPTANCE_PAYER_PRIVATE_KEY`), `E2E_BUYER` (`payer`, `rehearsal`, `acceptance`), `E2E_MODEL` (`auto`, `anthropic`, `mock`), `AGENT_MODEL` (`claude-haiku-5-5`), `E2E_KILL` (`real`, `skip`), `E2E_NETWORK` (`fork`, `real`), `E2E_HISTORY_SCALE`, `SEPOLIA_RPC_URL` |
| mirror (workers process) | `ARKIV_BACKEND`, `W_LEDGER_PRIVATE_KEY`, `POLICY_WRITER_PRIVATE_KEY` (watcher), `ARKIV_ACCESS_KEY`, `ARKIV_RPC_URL`, `WHITECHAIN_RPC_URL`, `SEPOLIA_RPC_URL`, `ALLOW_REAL_NETWORK`, `GRAPHPAY_CONTRACT`, `DEPLOY_BLOCK`, `CONFIRMATIONS`, `MIRROR_SYNTHETIC`, `BOOTSTRAP_FILE`, `DELIVERY_PROMISE_S`, `RECORDER_OWNER` (W_SYNC's address) |
| recorder (Vercel routes) | `W_SYNC_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `RECORDER_TOKEN` |
| facilitator, shop | `SPEC/PAYMENTS_WHITECHAIN.md` §9 |
| agents | `ANTHROPIC_API_KEY`, `AGENT_MODEL`, `AGENT_MODE`, `GRAPHPAY_ROOT_ENS` |

Each child process gets `PATH`, `HOME` and its own variables, nothing else. Fork keys are generated per run and never mirrored to a real AgentPolicy or Arkiv.

## 8. Pitfalls

1. viem's cached head made "sync" return early. Read the head uncached.
2. A sync racing the poll loop returned before the writes. One lock.
3. Register actors before the chain source starts; park events with unknown actors.
4. A failed write must not leak half a batch or move the cursor past lost events.
5. `OrderCreated.deadline` is not a delivery promise.
6. Renewals emit `PaymentSettled` and `SubscriptionRenewed`: count the money once.
7. Gate cache: key by exact spelling; up to the TTL to bite; a revoked policy's cap (0) must not pre-empt the on-chain `AGENT_REVOKED` record.
8. Refusal records are evidence against a node: attribute only when the wallet is bound to it.
9. The token must match the checkout and its EIP-712 domain: check at start-up.
10. Never print a start-up RPC error (the URL can carry a key).
11. The x402 resource URL in the shop's 402 is a path; the gateway rewrites it to the agent-facing URL so spend controls can check the host.
12. The public Sepolia RPC takes 1.2–2.3 s per gate call: cache 20 s; read the cast 6 at a time.
13. ArkivSim has no 256 KiB request limit and its `count()` returns rows the node does not: re-measure on Rabdi.
14. A fresh worktree has no contract libraries: install them before `forge build`.
15. Force-push is denied: after a rebase push under a new branch name, or merge main into the branch.
16. Two local processes (or a local script and the hosted facilitator) using one relayer key clash on nonces.
17. **Two mirror processes corrupt tallies** (a stale read lands at the next nonce). Run exactly one; check for another before starting (the heartbeat row).
18. One wallet backs one node: a refusal or payment from a wallet bound to a different node is `NODE_MISMATCH` (`SPEC/PAYMENTS_WHITECHAIN.md` §2).
