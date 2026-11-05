# Join: resume after a fresh start

Updated 05:12 IST, Fri 6 Nov. Read this first, then `docs/plan/sessions/join.md`.

## Running now

- `pnpm workers` (instance `a0db97956035a559`, since 05:08 IST, started detached with nohup so it outlives this session) from this worktree (`.claude/worktrees/graphpay-join-session-272a7b`), log `workers.log` (gitignored), with T2's ENS watcher (real policy sink as POLICY_WRITER). Check: `curl -s 127.0.0.1:8788/status`, `node acceptance/mirror.mjs lag`. **Never start a second one**; if it died, start it again from this worktree (it resumes from Arkiv).

## Done

- **M11 done** (PR 60): D1, D2a–c, D3, D15 and the 30-minute lag pass on the real networks (`docs/sessions/integration/mirror.md`).
- **M12 done** (PRs 48, 52, 56): `pnpm e2e:food` passed A–E as payer.vitalik (04:43 IST) and `pnpm e2e:kill` passed F on disposable-1 (killed once; DISPOSABLE_2 is kept for the video).
- **Acceptance** (`pnpm acceptance`, `ACCEPTANCE_REPORT.md`): 31 pass, 0 fail, 1 blocked (D7), 16 not run. Results in `docs/sessions/integration/acceptance/`, run files in `docs/sessions/integration/runs/`.
- Friday item 3 (batched presence and hand-offs, `integration/src/activity.mjs`).

## Next (M13)

1. After 05:30 IST (acceptance.vitalik's fresh UTC day) and once T1's M4 hosts the facilitator and shop: C2–C6, F2, F3 through the hosted routes (`pnpm acceptance --dry-run` first; no run while the website demo is live).
2. Wire the other tracks' checks into `acceptance/checks.mjs`: B3 (`scripts/ens/b3-real.mjs`), B7 (T2's fork test), B9, A3, A4, A9 (the probe rows in OPEN.md), A10, D10 (T4's presignCheck), F1 (history scan + Vercel env names).
3. The website errand runner: `runId: input.runId` and `batchedActivity` + `flush()` (T5's note).

## Relay key rule

- M4 is merged (PR 58, 05:12 IST). **From now on relay only through the hosted facilitator**: `POST https://graphpay-event.vercel.app/api/facilitator/{verify,settle}` with the bearer `FACILITATOR_AUTH_TOKEN` (from .env; never printed). Switch `integration/src/stack.mjs` to an `HTTPFacilitatorClient` on that URL (keep the in-process shop, or use the hosted shop) before the next real run; no local FACILITATOR sends.
- **No local RENEWER sends** from anyone: the hosted cron renews every minute when a subscription is due.
- T1 announces its own hosted sends; wait for its "free" before a run that pays.

## Notes

- Usage rule: pause at 92% weekly (check `get_usage` at each stopping point).
- The ENS watcher's log reads fail about 1 poll in 10 on the public Sepolia RPC (a lagging backend); the checkpoint stays put and the next poll repeats it.
