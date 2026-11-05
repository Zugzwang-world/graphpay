# Mirror working notes (Join, M11)

Updated 03:36 IST, Fri 6 Nov.

## Wiring (done)

- Arkiv: `packages/mirror/src/arkiv.mjs` implements the mirror's ledger port over `@graphpay/money-graph` (M7a, PR 14). It runs three ledgers on W_LEDGER's rows: the chain stream `chain:1874:<checkout>`, the `recorder` stream and the history stream. A write through one marks the others stale, and they re-read from Arkiv before their next write. The live writes pin the nonce read before the anchors (`NONCE_TAKEN` otherwise). The history is written in parts sized to one unsplit transaction, so each part lands whole with its checkpoint.
- Chain: the ABI and `FAIL_REASON` come from `@graphpay/contracts` (M1, PR 12); `nodeOfWallet` attributes recorder refusals.
- Process: `src/workers.mjs` (lease, heartbeat, history, loops) and `src/main.mjs` (`pnpm workers`).

## Live run (since 03:13 IST, Fri 6 Nov)

- First start: 19 cast nodes registered; history `history:test:v1:x0.05:d20762:b7d36bb9`, 1,258 events (synthetic), 03:13–03:26 IST; the chain stream from block 12,313,887: 9 setup events (OwnershipTransferred, RelayerSet, AgentPolicySet × 5, …), none needing a write; lag 2 blocks. W_LEDGER 1.998 → 1.510 tGLM.
- D2a (`node acceptance/mirror.mjs d2a`): clean, but `not run` (no mirrored edge event yet). Both replays would send 0 batches; the nonce moved once during the first, from the running workers' heartbeat.
- D15, first pass (no edge events in the window yet): SIGSTOP 21:57:43–21:59:43 UTC; `/health` came back within 5 s, 127 blocks caught up, no retries. SIGKILL at 21:59:54, restart: the lease was taken at once (the claim's pid had exited), 0 nodes re-registered, history done, running in 22 s, same cursor (12,314,093:0). `refs` over the window: 9 events, 0 edges, no duplicates; `not run` until a payment is in the window.
- Still needed for `(M11 done)`: the first real payment (T1's M3 part B) for D1, D2b, D2c and D3; D15 again with payments in the window; the M6 watcher hosted in `main.mjs`; T1's recorder edge carrying the signing wallet (`payload.payer`, or the ref `att:<orderId>:<wallet>:<n>`).

## Real payments (from 04:00 IST)

- 36 checkout events mirrored once each (25 edges: pay 7, order 8, deliver 4, refund 1, subscribe 1, renew 2, cancel 1, fail 1; 2 standings), 0 parked.
- D1 on acceptance's qualifying 4.80 (`1874:0x87505ef2…c72c00:4`): one Rabdi transaction with the pay edge, the link, 4 tally patches and the checkpoint; 642,628 gas (2.07× the lab's 310,527, recorded).
- D3: `RAW_VERIFIED` for kesar and acceptance.vitalik; the paged recount equals the stored all-time tallies.
- 30 minutes of lag (03:31–04:01 IST, 31 samples): at most 4 blocks (about 8 s), at most 5.5 s since the last good poll, 0 retries.
- T2's watcher is hosted in `main.mjs` (`src/ens.mjs`): a policy sink as POLICY_WRITER, retried until it starts.

## D2b, D2c, D15 (05:00–05:05 IST): M11 done

- Window: the workers frozen (SIGSTOP) 23:30:53–23:34:05 UTC; during it rehearsal.vitalik paid 0.40 to kesar and the shop delivered (tx `0x8f57b92a…bcaaf`): 3 edge events the mirror had not seen.
- D2b: two replay processes held their first raw transaction to the same instant and sent the same batch at nonce 320 (54 ms apart): one mined, the other was refused ("replacement transaction underpriced"), re-adopted and found the winner's write; 1 edge per event.
- D2c: a replay killed itself (SIGKILL) right after the node accepted its first transaction (nonce 322); that transaction was mined; the restart found the event behind the checkpoint and sent nothing.
- D15: on SIGCONT the workers caught up to the head (the 3 events skipped by the checkpoint, 0 retries); then SIGKILL and a restart (lease taken at once). Every event since the deploy has its one edge: 47 events, 35 edge events.
- With D1, D2a, D3 and the 30-minute lag sample: every M11 check passes on the real networks.

## The kill (F, E7, B6; 04:52–04:56 IST, one-shot for disposable-1)

- Alive: disposable-1 paid 0.40 to kesar (HTTP 200): https://explorer.testnet.whitechain.io/tx/0x763973499f7f7eb7bdda058fa03ee3d9f9480be53d75bc4574c62d7beec84b9c
- Kill: the owner's unregister on Sepolia, block 12,072,701: https://sepolia.etherscan.io/tx/0x785a13f119ab77f67c1ed8dfa6f1213708fde4f43158122a357e72c018acf29f
- The next payment, 9.3 s after the kill's receipt: HTTP 402 `ENS_EXPIRED_OR_REVOKED` from our facilitator's gate (the limit is 25 s).
- The watcher (hosted in the workers) revoked the AgentPolicy 11 s after the kill: `setPolicy` epoch 0 revoked, Whitechain block 12,324,621, 36,358 gas.
- The recorder's off-chain fail edge: the first write failed (T1's ref was 136 bytes, over Arkiv's 128-byte str), fixed (`att:<order>:<wallet>:<8 hex>`); the refusal-only re-run wrote it, `0xc2d2ed38…2699`, and the mirror folds it into the agent's `fails` after its 120 s settle window.
- Evidence: `docs/sessions/integration/runs/kill-disposable-1/kill.json`. DISPOSABLE_2 is untouched (the video and the pitch).

## The D checks (`acceptance/mirror.mjs`, results in `docs/sessions/integration/acceptance/`)

```bash
node acceptance/mirror.mjs d1 --tx <whitechain settle tx>
```

```bash
node acceptance/mirror.mjs d3 --ens kesar-kingdom.graphpay.eth --ens acceptance.vitalik.graphpay.eth
```

- `d2a` runs beside the workers. `d2b --block N` and `d2c --block N` need the workers stopped cleanly (Ctrl-C) and an unmirrored edge event at or after block N: stop the workers before a payment, run the check, then start the workers again.
- `refs --from N --to N` (D15's count) and `lag` (one fresh heartbeat).

## Running it (founder's Mac)

```bash
fnm exec --using=22.23.4 pnpm workers
```

- The process holds `caffeinate -ims -w <pid>`. Check it with `pmset -g assertions | grep caffeinate`.
- It refuses to start while another instance's heartbeat is under 90 s old. A clean stop (Ctrl-C) frees the lease at once.
- Local endpoints: `curl -s 127.0.0.1:8788/status`, `curl -s -X POST 127.0.0.1:8788/sync`.
- The first start registers the cast and writes the 5% history (1,258 events, about 100 transactions, 10–15 min). Later starts resume from the checkpoints.

## D15 (resume after a drop)

1. With the process running, record `/status` (checkpoint, cursor).
2. Cut the network for 2 minutes (Wi-Fi off), or `kill -STOP <pid>`, then restore it (`kill -CONT <pid>`).
3. Make a payment during or after the cut. `/status` shows the poll errors, then the catch-up.
4. Force a restart (Ctrl-C, start again).
5. Check every event in the window: `count(edge where ref = id) = 1`, and the cursor continues from the last processed block.
