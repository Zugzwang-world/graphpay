# Mirror working notes (Join, M11)

The interfaces `packages/mirror` expects from the other tracks, so the wiring is short when each gate lands. Owners: T3 (Arkiv), T1 (payments), T2 (identity). Updated 01:20 IST, Fri 6 Nov.

## From T3 (M7a; the Coordinator says the import is `@graphpay/money-graph`)

The mirror talks to Arkiv through a small port (`Ledger` in `packages/mirror/index.d.ts`); the adapter over M7a's writer is written when it merges.

| port call | needs from the writer | why |
|---|---|---|
| `confirmedNonce()`, then `writeEdge(edge, { stream, checkpoint, nonce })` | a send **at a nonce the caller read before the anchors**, refusing (code `NONCE_TAKEN` or equivalent) if it is taken | §2: read the confirmed nonce before the anchors; a stale batch must not land at the next nonce |
| `writeEdge` | one batch: the readonly edge (ADR-0034), the tally rows of both ends (`all` and the day), the link, the stream checkpoint; split by bytes only for the history | D1 |
| `edge.counted = false` | the planner skips the tally for a `DUPLICATE` fail | §3 tally rules |
| `writeStanding({ node, epoch, status, capMicro })` | a node-row patch plus the checkpoint, same epoch only | `AgentPolicySet` |
| `registerActors(actors)` | node-row creates (30-day life; synthetic history buyers 14 days) | bootstrap, recognised disposables |
| `hasRef(ref)`, `readCheckpoint(stream)`, `readActors()` | W_LEDGER-owned reads | anchors, adopt |
| `readRecorderEdges({ sinceTs, untilTs })` | W_SYNC edges by `ts` (indexed, per the M7 amendment §9) | recorder fold |
| `foldRecorder(edges, { stream, checkpoint, nonce })` | **tally patches for existing edges, no edge create** | refusals fold into `fails` |
| heartbeat row | a `heartbeat` entity, owner W_LEDGER, mutable: `instance` str, `state` str, `cursor_block` u64, `cursor_log` u64, `head_block` u64, `lag_blocks` u64, `updated_ts` u64, 1-day life, extended | the lease and the website's lag chip; T3 lists it in `arkiv/schema.md` |

## From T1 (M1, M2, M3)

- The checkout ABI, exported from `packages/contracts` (the mirror decodes with it; the event list in `planning/SPEC/PAYMENTS_WHITECHAIN.md` §3.3).
- The checkout address and its **deploy block** in `whitechain.contracts` of the config file (`DEPLOY_BLOCK` otherwise).
- A view `nodeOfWallet(address)` (in the spec) for recorder attribution.
- The recorder's refusal edge carries the signing wallet: `payload.payer`, or the ref `att:<orderId>:<wallet>:<n>`.

## From T2 (M5, M6)

- `docs/sessions/identity/namespace.md`: epoch per name (fresh names are epoch 0) for the bootstrap.
- The watcher as a library this process starts and stops; its node writes go through the mirror's lock (single W_LEDGER writer).

## Decisions taken here

See `docs/thinking-partner/relays/integration.md` ("Where I chose"): the history's 12 synthetic buyers and its day spread; the checkpoint held before the earliest parked event; standing replays; the recorder's settle window (120 s).
