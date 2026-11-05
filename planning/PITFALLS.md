# PITFALLS (the lab's top problems and how to avoid them)

Ranked by how much time they cost or how much damage they could have done. Each one actually happened (or was caught by a reviewer before it shipped) in the lab. Area specs carry their own longer lists.

## 1. Money and correctness

| # | pitfall | what happened | avoid it |
|---|---|---|---|
| 1 | **A salted create is not idempotent on Arkiv** | the same create sent twice with the same salt made two entities on Rabdi (the key includes the owner's nonce); a retry after a timeout would write a second, readonly payment row | anchor (checkpoint, `ref`) in the same atomic batch; confirmed nonce; find the mined tx by nonce before any resend (`SPEC/ARKIV_GRAPH.md` §7) |
| 2 | **An unclear settlement treated as a failure** | review found that a receipt timeout, a 502 after signing, or a 200 without a receipt released the reservation, so a retrying agent could pay a second shop | after a signature only a pre-send refusal, a revert or a recorded `PaymentFailed` is final; otherwise keep the reservation and report `unsettled` |
| 3 | **Signing more than you checked** | the payer checked `accepts[0]` but would have signed another entry | refuse a 402 with more than one entry; sign only the checked one |
| 4 | **Ranking from the model's query** | a model-written GraphQL query with aliases (`refundRate: fails`) or another window could make the trap shop look clean | code ranks from its own fixed query; the model's queries only explain |
| 5 | **Policy bypass with `payerNode = 0`** | a revoked agent could sign as "a human" | bind wallet ↔ node on-chain; `NODE_MISMATCH` |
| 6 | **The facilitator paying to publish garbage** | failures are events, not reverts, so `eth_call` succeeds for doomed payments; the relayer would pay gas for forged or doomed requests | verify the signature first, predict with chain reads, send only what will succeed (plus a small quota of recorded failures) |
| 7 | **Concurrency double-spends** | the AI SDK runs same-step tool calls in parallel; three `pay_shop` calls passed a check-then-act guard | reserve synchronously before any `await`; single-flight payment; the contract enforces the order id |
| 8 | **The gas cap from research was too low** | 300k refused the first settle (≈ 312k–334k) | 450k (`MAX_SETTLE_GAS`) |
| 9 | **x402 spend controls deny custom assets by default** | "All payment requirements were rejected by spendControls" | `setSpendControls({ allowedAssets })` |
| 10 | **A hard-coded token** | the stand-in failed `wrong_asset`, and an approval signed under the wrong EIP-712 name is silently dropped | the token is configuration; check `USDT()` and `DOMAIN_SEPARATOR()` at start-up |
| 11 | **Over-cap never reaches the chain** | the real ENS gate refuses over-cap off-chain (`CAP_EXCEEDED`) | expect on-chain failure records only for revoked or expired policies; record off-chain refusals on Arkiv |
| 12 | **Renewals counted twice** | a renewal emits `PaymentSettled` and `SubscriptionRenewed` | money only on `PaymentSettled`; the `renew` edge carries 0 |
| 13 | **The daily cap is a real limit** | one lifecycle run spent `payer.vitalik`'s 6.00 for the UTC day; the next real errand had to wait for 05:30 IST | Thursday 21:00 to Friday 05:30 IST is one UTC day: rehearse as `rehearsal.vitalik` (30.00), accept as `acceptance.vitalik`, keep `payer.vitalik` for the counting run and the stage (E-15) |
| 14a | **One wallet backs one agent node** | the checkout's `setPolicy` reverts "wallet bound to another node", and a bound wallet that pays as a human fails `NODE_MISMATCH` (caught by the pack's fact-check before the event: sharing PAYER between `payer` and a disposable agent, or binding VITALIK, would have broken the kill test, the human payment and the subscription) | one dedicated wallet per paying agent; never bind owner wallets (E-14) |
| 14b | **A watcher that copies the ENS cap into the policy** | the lab's watcher design read `graphpay.cap_micro` into `setPolicy`; with ADR-0013's 50 USDT in ENS it would have lifted the 6.00 on-chain cap | policies come from a configured list; the watcher mirrors status, epoch and expiry only (E-11) |
| 14c | **Two mirror writers** | a Vercel cron plus an on-demand trigger can overlap; a batch built on a stale read lands at the next confirmed nonce and overwrites absolute tallies | exactly one long-lived workers process; heartbeat check at start; nonce read before the anchors; a reconcile job (E-2) |
| 14 | **Scores shrink with a scaled-down history** | with 5% of the deck's history on Rabdi the volume term drops (kesar about 0.916 instead of 0.986) | the test recomputes from the tallies read; the website shows computed scores, never typed ones |

## 2. Identity (ENS)

| # | pitfall | what happened | avoid it |
|---|---|---|---|
| 15 | **A killed name resolves to empty strings, not an error** | resolution "succeeds" through the parent's resolver | liveness from `getState` only; walk every ancestor |
| 16 | **`renew()` resurrects a killed name's records** | the label becomes RESERVED and the old resolver says `active` again; a watcher that un-revoked on `ExpiryUpdated` would re-activate a killed agent | require REGISTERED; re-read state before un-revoking |
| 17 | **Unpinned namespace** | the gate accepted any `x.evil.eth` with a factory-proxy resolver | `allowedRoots: ['graphpay.eth']` |
| 18 | **Gate-cache poisoning** | a look-alike spelling (leading space) poisoned the real name's cache entry | key the cache by the exact normalised spelling |
| 19 | **The epoch is off by one after `unregister`**; fresh names are epoch 0 | a writer numbered epochs from 1 | read the epoch only while REGISTERED; stamp it from ENS |
| 20 | **A kill is one-shot per label** | deterministic resolver addresses stop a label being provisioned again | fresh `disposable-<n>` per kill rehearsal |
| 21 | **Load-balanced Sepolia RPC** | a read right after a write said "available" | re-read before trusting; cache the gate 20 s |

## 3. Arkiv

| # | pitfall | what happened | avoid it |
|---|---|---|---|
| 22 | **256 KiB request cap** | the first seed failed with "Execution error without revert data" (HTTP 413 underneath); the emulator had no limit | split transactions by bytes under 120 KB; give the emulator the limit |
| 23 | **Bare bigints match nothing** | `eq('day', 5n)` renders as u256 | type every predicate value |
| 24 | **A blank owner disabled the trust filter** | `''` is falsy | validate owners at start-up; owner required |
| 25 | **Silent undercounting under a row cap** | 50 shops × 90 day rows through a 500-row cap looked fine | chunk to the cap; report `TRUNCATED` |
| 26 | **One dataset per owner wallet** | reads filter by owner, not dataset | one seed wallet per city size and per run |
| 27 | **Agent query text escaping the owner filter** | `x) OR (y` closed the parenthesis | parse and re-render, then add the filter |
| 28 | **The access key in error messages** | viem puts the RPC URL (which contains the key) in errors; an HTTP log cut before redacting | redacting transport; redact before truncating; never print start-up RPC errors |
| 29 | **Cached chain head** | `/sync` returned before the payment was mirrored | `cacheTime: 0`; one lock around poll and write |

## 4. Repo and tooling

| # | pitfall | what happened | avoid it |
|---|---|---|---|
| 30 | **Secret helpers written fast** | the first review found 7 blocking issues, the re-review 2 more (`JSON.parse` quoting secrets, overridable Vercel targets, weak scan patterns) | build them from `SPEC/SECURITY_AND_OPS.md` §3–§4 and review before merging |
| 31 | **Vercel cannot see a new repo** | `vercel git connect` failed until the founder granted the GitHub app access | founder step at 21:10 |
| 32 | **Worktrees have no `.env` and no contract libraries** | a symlink was refused; `forge build` failed | the git-based env loader; install contract libraries in every fresh worktree |
| 33 | **A generator that fills every missing role** | it minted new shop keys that clashed with on-chain addresses (twice) | generate one named role at a time |
| 34 | **Force-push is denied** | rebased branches could not be pushed | rebase only before the first push; afterwards merge `origin/main` |
| 35 | **Lockfile conflicts between parallel sessions** | PRs went DIRTY | one early PR owns dependencies; take main's lockfile and re-install |
| 36 | **Two `graphql` majors in one repo** | the lab ended with 16.14.2 and 17.0.2 side by side ("from another module or realm" risk) | one major (16.14.2) everywhere |
| 37 | **Auto-merge did not fire** | green, `CLEAN` PRs stayed open for minutes | merge directly with squash when green and clean |
| 38 | **Foundry with `via_ir`** | `block.timestamp` in tests was stale after `vm.warp` (twice) | `vm.getBlockTimestamp()` in tests |
| 39 | **`--import tsx` from the repo root** | module not found | run entry points from the package that owns `tsx` |
| 40 | **Two instances, one relayer key** | nonce clashes between Vercel instances and local scripts | a second relayer for scheduled jobs; no local scripts with the hosted key during the demo |

## 5. Found in the pre-event final pass (2026-11-05)

| # | pitfall | what happened | avoid it |
|---|---|---|---|
| 41 | **A fixed 21,000 gas limit on Sepolia** | sending ETH to a wallet with no state was mined and failed (Glamsterdam: a new account costs 183,600 more; the transfer used 204,600) | estimate gas for every transaction; fresh event wallets are all new accounts |
| 42 | **Two Vercel projects for one repo** | importing the repo in the dashboard creates a project named after the repo | the founder only grants the GitHub app access; Claude creates `graphpay-event` |
| 43 | **Parallel sessions rewriting the same status file** | every PR touching one `NOW.md` conflicts and stalls auto-merge | one section per activity in `NOW.md`, `LOG.md` and `OPEN.md`; watch the PR until merged |
| 44 | **A spending key left on an old deployment** | the lab's hosted demo kept a funded relayer key after the lab ended | when a deployment retires, remove its keys from Vercel, redeploy, and check that the spending routes answer 503 |

