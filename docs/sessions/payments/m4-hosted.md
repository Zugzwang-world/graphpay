# M4: the facilitator, the shop API, the recorder and the renewal cron on Vercel (T1 Payments working notes)

## What is built

- `apps/web/lib/payments.server.ts`: one build per instance of each service from the environment and the config, on the real chain only (`networkMode` hosted: https, not loopback, `ALLOW_REAL_NETWORK=1`; no ENS stub). A failed build or start-up check answers 503 and is retried on the next request; errors are one line with a check's name or an error's name, never a message (viem quotes RPC URLs).
  - Facilitator: `facilitatorSettings`, the relayer key FACILITATOR (start-up: a relayer on the checkout, never its admin), T2's `createEnsGate` over `checkoutPolicyReads` (moved into `@graphpay/facilitator`, shared with the part B scripts), the 0.3 WBT floor and a 30 s receipt cap enforced, refusal records to the hosted recorder kept alive with Next's `after()`.
  - Shop: `shopSettings`, `createEnsReader().resolvePayee`, quotes written as W_DIRECTORY (fails closed: without the key a 402 step with a `requestId` is 503), `markDelivered` with the shop's merchant key (E-3).
  - Recorder: `recordEdge` as W_SYNC behind `RECORDER_TOKEN`.
  - `hostedEnv`: the facilitator and recorder URLs are the production domain's (config `site.url`, never `VERCEL_URL`); an env value may only repeat them, so a bearer never goes to another origin. The merchant lists are derived from the shop keys held there until the config has the public role addresses; a differing explicit list is refused.
- Routes (Node runtime, `force-dynamic`, every answer `no-store`): `/api/facilitator/[...path]` (verify, settle with the bearer; supported, health open; `maxDuration` 60), `/api/shop/[...path]` (catalog, quote, orders/:id/pay|reorder with the passcode, health; 120), `/api/recorder/[...path]` (attempts; 60), `/api/cron/renew` (`CRON_SECRET` bearer; 60).
- `lib/renew.server.ts` and `apps/web/vercel.json`: the cron runs every minute as RENEWER (E-1): the most recent 25 subscriptions read in parallel, at most 3 renewals per run, no new send after 25 s, `eth_chainId` before each send, renewer not the admin and above 0.02 WBT. `renew` is guarded on-chain, so overlapping runs cost at most a reverted estimate.
- `scripts/whitechain/vercel-env.mjs`: read-only chain checks (FACILITATOR and RENEWER are different relayers, neither the admin), then 14 names to the pinned project as Sensitive values through `pnpm -s secrets:vercel` (stdin): ALLOW_REAL_NETWORK, WHITECHAIN_RPC_URL, FACILITATOR_PRIVATE_KEY, FACILITATOR_AUTH_TOKEN, DEMO_PASSCODE, W_SYNC_PRIVATE_KEY, ARKIV_ACCESS_KEY, RECORDER_TOKEN, RENEWER_PRIVATE_KEY, CRON_SECRET, W_DIRECTORY_PRIVATE_KEY and the three shop keys. Run at 05:00 IST: all set.
- `pnpm pay:public` (`scripts/whitechain/pay-public.mjs`): the production domain only, no redirect followed; health and the signer, C6's 401s, the cron's and the recorder's 401; `--yes` pays one piece as the persona (human payer) and repeats it (`alreadyPaid`); `--recorder` posts one unattributed `test` edge to a non-cast name. Results: `m4-public.json`.

## Tests and reviews

- `apps/web/lib/payments.test.ts` (4): hostedEnv, the wrapper (503, 500 with the name only, no-store), the cron's and the recorder's bearer guards. Web tests 128, facilitator 62, shop 15; typecheck, `next build`, `pnpm check` green.
- Security pass and correctness pass (in parallel): both "do not ship" on one blocker (a test failed `pnpm typecheck`), fixed. Should-fixes done: hosted URLs and merchant lists pinned, the cron bounded, refusal records kept alive, quotes fail closed, ENS read retries, the receipt cap, the explorer URL from the config, the recorder test edge off the cast.

## Deviations and open

- No `--token` switch (the stand-in is retired, ADR-0054) and no `--deploy`: deploys come from `main` through the Vercel Git integration.
- `SEPOLIA_RPC_URL` is not in `.env`: ENS reads use the public Sepolia RPCs with two retries.
- The one-minute cron needs a Vercel plan that allows it; this PR's preview build shows it (a plan without it refuses the deploy). Auto-merge only after that check.
- Per-instance state (in-flight, failure counts, nonces): two instances can clash on a relayer nonce (no double payment). Join's local runs also relay as FACILITATOR and deliver as SHOP_KESAR: one sender per key at a time until Join relays through the hosted facilitator.
