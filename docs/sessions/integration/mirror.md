# Mirror working notes (Join, M11)

Updated 02:05 IST, Fri 6 Nov.

## Wiring (done)

- Arkiv: `packages/mirror/src/arkiv.mjs` implements the mirror's ledger port over `@graphpay/money-graph` (M7a, PR 14). It runs three ledgers on W_LEDGER's rows: the chain stream `chain:1874:<checkout>`, the `recorder` stream and the history stream. A write through one marks the others stale, and they re-read from Arkiv before their next write. The live writes pin the nonce read before the anchors (`NONCE_TAKEN` otherwise). The history is written in parts sized to one unsplit transaction, so each part lands whole with its checkpoint.
- Chain: the ABI and `FAIL_REASON` come from `@graphpay/contracts` (M1, PR 12); `nodeOfWallet` attributes recorder refusals.
- Process: `src/workers.mjs` (lease, heartbeat, history, loops) and `src/main.mjs` (`pnpm workers`).

## Still needed

- T1 (M2): `whitechain.contracts.checkout` in the config with `address` and `deployBlock` (or `GRAPHPAY_CONTRACT` and `DEPLOY_BLOCK` in `.env`).
- T2 (M5): the epochs by name. Fresh names are epoch 0; a `BOOTSTRAP_FILE` JSON `{ "epochs": { "<ens>": <n> } }` overrides. Then the M6 watcher hosted in this process.
- T1 (M3): the recorder's refusal edge carries the signing wallet (`payload.payer`, or the ref `att:<orderId>:<wallet>:<n>`).

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
