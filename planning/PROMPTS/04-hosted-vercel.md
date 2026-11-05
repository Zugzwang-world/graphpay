# M4 — Shop API and facilitator hosted on Vercel

**Goal:** the shop API and facilitator answer on the production domain, on the real chain, behind the passcode and the bearer token; one payment goes through the public URL.
**Depends on:** M2, M3, M6 (the real gate; no ENS stub on a real network). **Worktree:** `wt-payments` (`pay/hosted`). **Model:** Opus High. **Time:** 45–60 min (lab: about 47 min with two reviewer passes).

## Inputs
`SPEC/PAYMENTS_WHITECHAIN.md` §8, §9; `SPEC/SECURITY_AND_OPS.md` §6, §7; `DECISIONS.md` E-1, E-3.

## Prompt
> Serve the shop API, the facilitator and the recorder as Next.js route handlers in `apps/web` (`/api/shop/*`, `/api/facilitator/*`, `/api/recorder/*`, Node runtime), building the M3 apps once per instance. Set `ATTEMPTS_URL` to the hosted `/api/recorder/attempts`. Add the **renewal cron** (`ARCHITECTURE.md` §3 row 5b): `/api/cron/renew` checks `CRON_SECRET` (Vercel sends it as a bearer), signs `renew` for due subscriptions as RENEWER, and is scheduled every minute in `vercel.json` (Pro allows one-minute crons); a clash only costs a nonce because `renew` is guarded on-chain. Mirror the facilitator's start-up checks (a failed check answers 503 and is retried on the next request). Hosted config is stricter than local (`planning/SPEC/PAYMENTS_WHITECHAIN.md` §8): `ALLOW_REAL_NETWORK=1`, https RPC, passcode and token of at least 24 characters, merchant allow-list, no ENS stub, a 0.3 WBT relayer-balance floor, a 30 s receipt wait, `maxDuration` 60 s (facilitator) and 120 s (shop). Every answer `no-store`; errors are one redacted log line and `{"error":"internal error"}`.
>
> Write `scripts/whitechain/vercel-env` (one `--token` switch): public values from the deployments record, secrets from `.env` as Sensitive on stdin (`FACILITATOR_PRIVATE_KEY`, `FACILITATOR_AUTH_TOKEN`, `DEMO_PASSCODE`; for the recorder `W_SYNC_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `RECORDER_TOKEN`; for the cron `RENEWER_PRIVATE_KEY`, `CRON_SECRET`), checks that the facilitator key is the relayer and not the admin, the pinned project id and production domain recorded in `docs/technical/FACTS.md` at M0; `--deploy` deploys only a commit on `origin/main`. Add merchant keys only for the passcode-gated merchant routes the website needs (E-3). Write `pay:public`: calls only the production domain, follows no redirect, checks that a wrong passcode gets 401 and that the facilitator's signer is ours, then pays 0.40 as a human payer and repeats the request. Offline tests for the bearer guard and the start-up checks. Two reviewer passes (security and correctness). Ship and deploy.

## Done when
- `GET /api/shop/health` and `/api/facilitator/health` answer 200 on the production domain.
- `ACCEPTANCE_TESTS.md` C6 passes (401 without passcode or token).
- `pay:public` settles one payment with no payer gas, and the repeat answers `alreadyPaid`; the explorer link is in `docs/technical/FACTS.md`.
- `POST /api/recorder/attempts` with the bearer writes one edge on Rabdi (tx link; post it **unattributed and labelled `test`**, so no cast agent gets a failure); without it, 401.
- `/api/cron/renew` without `CRON_SECRET` answers 401; with it, it renews a due 120 s demo subscription once (tx link).
- Facts go to the payments section of `docs/thinking-partner/NOW.md` and `relays/payments.md`; main copies them into `docs/technical/FACTS.md`.

## Pitfalls
In-memory limits are per instance; only on-chain caps and the relayer floor bound the deployment. Two instances can clash on the relayer nonce (no double payment; a retry works). Do not use the hosted relayer key from local scripts during the demo. `vercel link` writes `.env.local`; `.vercelignore` must exclude `.env*`.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`payments`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `payments` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/payments.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `payments` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `payments` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
