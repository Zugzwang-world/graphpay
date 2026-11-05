# Relay: integration (Join)

Updated 01:20 IST, Fri 6 Nov.

## In plain words

The Join session turns every payment on Whitechain into a line in the money graph on Arkiv. That piece is called the mirror, and it runs as one long-lived "workers" process on the founder's Mac. It reads the checkout contract's events, writes each one to Arkiv once and only once, and keeps every shop's and agent's scoreboard (its tallies) up to date. The agents read those scoreboards before they pay.

Tonight the mirror depends on three pieces from other sessions: the Arkiv writer (T3, M7a), the checkout contract's events (T1, M1) and the cast's ENS names (T2, M5). None has merged yet, so the mirror's logic was built and tested against stand-ins (a fake ledger and a fake chain). Plugging in the real pieces should mostly be wiring.

What already works, on the stand-ins:
- the lab's lifecycle comes out exactly as the lab measured it. The good shop has 5 orders, 6.40 paid, one refund of 0.80, 2 failures and 3 deliveries. The subscription renewal is counted once, and a replayed payment is recorded but not counted;
- running the same blocks twice, restarting, or losing the cursor never writes anything twice;
- if a second writer gets in first, our write is refused and the mirror starts over from Arkiv, so stale numbers are never written;
- a payment by an agent the mirror doesn't know yet is parked rather than lost, and is written once that agent is registered;
- a second workers process is refused while the first one's heartbeat is fresh;
- a refusal recorded by the website counts against an agent only if that agent's own wallet signed;
- the labelled synthetic history of the three cast shops at 5% scale comes to 1,258 events, about 100 Arkiv transactions. The pack projected about 1,256.

Nothing has been written to any network yet. Nothing is needed from the founder.

## Technical

**PR:** the mirror core on test doubles (link in `LOG.md`). The package is `packages/mirror` (ESM, `node --test`), with 21 tests:

| module | what |
|---|---|
| `decode.mjs` | logs → events with id `1874:<tx>:<logIndex>`, in chain order. Unknown topics are counted and skipped. The ABI comes from M1; a draft built from the spec exists only inside a test |
| `map.mjs` | the §3 table. A human payer (`payerNode` = 0) maps to the order's buyer. The payer's epoch comes from the event, every other epoch from the node rows. On time means delivered within the promise (default 2 h) after the payment's block time. `DUPLICATE` gets an edge with `counted: false`. `renew` carries 0. `AgentPolicySet` patches standing only within the same epoch, and an unchanged standing is not sent again |
| `orders.mjs` | the order and subscription book. A miss after a restart is read back through a loader (Arkiv edges or the checkout's views) |
| `mirror.mjs` | per event: skip it if the checkpoint covers it; read the confirmed nonce, then the anchors (checkpoint and `ref`); send at exactly that nonce. One lock covers each poll and its writes, and `/sync` waits on that lock. Any failed write re-adopts from Arkiv |
| `source.mjs` | `eth_getLogs` in ranges of at most 1,000 blocks up to head − 2, with an uncached head (`cacheTime: 0`) |
| `lease.mjs`, `awake.mjs` | heartbeat lease: stale after 90 s, aged by Arkiv blocks (2 s each), so clock skew can't matter. A clean stop frees it. A local claim file lets a restart on the same Mac take over at once when the old process has exited. `caffeinate -ims -w <pid>` (ADR-0056) |
| `recorder.mjs` | folds the W_SYNC refusals from the `recorder` checkpoint. Only records older than 120 s are folded, and records from the same second go in one batch. A refusal is attributed only when the checkout's `nodeOfWallet(wallet)` equals the edge's node |
| `history.mjs` | the cast history: deterministic (mulberry32, the story's seed) and named after its parameters. A different history on Arkiv is refused |
| `server.mjs` | `/health`, `/status`, `/sync` on 127.0.0.1 only; errors pass through the redactor |

**Numbers.** At 5% scale, the history counts are the scenario's full counts scaled and rounded:

| shop | orders | refunds | late |
|---|---|---|---|
| good | 241 | 3 | 7 |
| trap | 110 | 20 | 32 |
| runner-up | 60 | 2 | 4 |

That gives 1,258 events. At full scale the same formula gives the pack's 25,116 events exactly (tested). Source: `story.json` scenarios, the formula in `history.mjs`.

**Where I chose (the spec is silent):**
1. **History buyers.** The orders are spread over 12 labelled synthetic buyers, `history-buyer-<n>.sim.<root>` (owner W_LEDGER, `synthetic=true`). One price per shop (the scenario's 12-box price), full refunds, days spread evenly over the 89 days before the day of writing (so today stays empty and the whole history falls in the D90 window), late deliveries 10–60 min past the promise.
2. **Parking and the checkpoint.** The checkpoint written with any event never passes the earliest parked event, so a restart finds parked events again. Events after it are caught by `ref`.
3. **Standing replays** (after a lost cursor) converge on the latest policy. Standing patches have no `ref`, so an intermediate value can show for one poll.
4. **The recorder's wallet** is read from `payload.payer`, or else from the ref `att:<orderId>:<wallet>:<n>`. T1's recorder needs to write one of the two.

**Needed from the other tracks** (also in `docs/sessions/integration/mirror.md`):
- T3 (M7a): a send at a nonce the caller reads before the anchors; a fold of existing recorder edges into tallies without creating an edge; a heartbeat entity (type `heartbeat`, owner W_LEDGER, mutable) listed in `arkiv/schema.md`;
- T1 (M1): the ABI exported from `packages/contracts`, and the deploy block in the config;
- T2 (M5): the hand-off table (epoch per name), and the watcher as a library this process hosts.

**Risks.** The network on this Mac dropped twice (DNS). Rabdi writes take 5–8 s each, so the history takes about 10–15 min. W_LEDGER was funded with 2.0 tGLM at M0 (`docs/technical/WALLETS.md`), against a projected 0.7–0.9 for the history.
