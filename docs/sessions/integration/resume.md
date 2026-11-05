# Join: resume after a fresh start

Updated 05:20 IST, Fri 6 Nov. Read this first, then `docs/plan/sessions/join.md`.

## Running now

- `pnpm workers` (instance `a0db97956035a559`, since 05:08 IST, started detached with nohup so it outlives this session) from this worktree (`.claude/worktrees/graphpay-join-session-272a7b`), log `workers.log` (gitignored), with T2's ENS watcher (real policy sink as POLICY_WRITER). Check: `curl -s 127.0.0.1:8788/status`, `node acceptance/mirror.mjs lag`. **Never start a second one**; if it died, start it again from this worktree (it resumes from Arkiv).

## Done

- PR 57 closed as superseded (its lines landed in PR 60).
- **M11 done** (PR 60, merged): D1, D2a–c, D3, D15 and the 30-minute lag pass on the real networks (`docs/sessions/integration/mirror.md`).
- **M12 done** (PRs 48, 52, 56): `pnpm e2e:food` passed A–E as payer.vitalik (04:43 IST) and `pnpm e2e:kill` passed F on disposable-1 (killed once; DISPOSABLE_2 is kept for the video).
- **Acceptance** (`pnpm acceptance`, `ACCEPTANCE_REPORT.md`): 31 pass, 0 fail, 1 blocked (D7), 16 not run. Results in `docs/sessions/integration/acceptance/`, run files in `docs/sessions/integration/runs/`.
- Friday item 3 (batched presence and hand-offs, `integration/src/activity.mjs`).

## Next (M13)

1. **Branch `join/m13-hosted`** (this worktree): `pnpm e2e:hosted` (`integration/hosted.mjs`) runs C2, C3 (re-order; refund with `--refund`, the one local send as SHOP_KESAR, after telling T1), C4(b), C5, C6 and F2 through the production domain; results in `docs/sessions/integration/hosted/`, read by `acceptance/checks.mjs` (`hosted()`). Read-only pass done 05:15 IST: C6 and F2 pass (17 routes, nonce unchanged). The paying run (`ALLOW_REAL_NETWORK=1 pnpm e2e:hosted --yes [--refund]`) only after 05:30 IST, when the acceptance payer's `spentToday` is 0; it refuses otherwise. C3's renewal is read from T1's hosted-cron receipt (`m4-hosted.md`, the `| cron |` row): it passes.
2. Not covered yet: C4(a) (a POLICY_WRITER revoke of the scout agent while the workers hold that key) and F3 (a preview deployment with the floor raised; T1's). `integration/src/stack.mjs` (e2e:food, e2e:kill) now refuses unless `STACK_LOCAL_RELAY=1`.
3. Wire the other tracks' checks (B3, B7, A3, A4, A9, A10, D10) in `acceptance/tracks.mjs`, merged into `checks.mjs`. B9 is wired (fromEns).
4. The website errand runner: `runId: input.runId` and `batchedActivity` + `flush()` (T5's note).

## Relay key rule

- M4 is merged (PR 58, 05:12 IST). **From now on relay only through the hosted facilitator**: `POST https://graphpay-event.vercel.app/api/facilitator/{verify,settle}` with the bearer `FACILITATOR_AUTH_TOKEN` (from .env; never printed). Switch `integration/src/stack.mjs` to an `HTTPFacilitatorClient` on that URL (keep the in-process shop, or use the hosted shop) before the next real run; no local FACILITATOR sends.
- **No local RENEWER sends** from anyone: the hosted cron renews every minute when a subscription is due.
- T1 announces its own hosted sends; wait for its "free" before a run that pays.

## The website's errand runner (T5, 05:05 IST)

- When wiring `apps/web/lib/agents-live.server.ts` `errandRunner()`: pass `runId: input.runId` to `runErrand` (PR 55); the explainer lanes and the map query the hand-off and presence rows by it. Use `batchedActivity(dir)` with `await activity.flush()` before the stream ends. The seam waits for M4 (the hosted facilitator and shop).

## Notes

- Usage rule: pause at 92% weekly (check `get_usage` at each stopping point).
- The ENS watcher's log reads fail about 1 poll in 10 on the public Sepolia RPC (a lagging backend); the checkpoint stays put and the next poll repeats it.
