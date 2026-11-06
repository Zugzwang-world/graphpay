# PROBLEM LOG

Problems that cost time or nearly broke something, with cause, fix and prevention (skill `problem`). Newest last, under your activity's heading.

## foundation

### P-foundation-1: the first production deploy failed at install
When: 2026-11-05 22:16 IST · Activity: foundation · Cost: about 5 minutes
Symptom: `vercel deploy --prod` from a clean checkout stopped at `pnpm install` with exit 128.
Cause: the root `prepare` script ran `git config core.hooksPath .githooks`, and a Vercel CLI upload has no `.git` folder.
Fix: `scripts/prepare.mjs` sets the hooks path only inside a git checkout and never fails the install (PR #2); the redeploy was ready at 22:22.
Prevention: install-time scripts must work outside git; CLI deploys run from a clean `origin/main` checkout, so this shows up at once.

### P-foundation-2: a Sepolia send was refused right after a confirmed one
When: 2026-11-05 22:15 IST · Activity: foundation · Cost: about 3 minutes; nothing was double-sent
Symptom: the second Sepolia funding transfer failed with "Missing or invalid parameters"; the first had a receipt.
Cause: the public Sepolia RPC is load balanced; a nonce read right after a receipt answered one behind (`planning/SPEC/SECURITY_AND_OPS.md` §9 warns that reads can lag a block).
Fix: the funding script reads the confirmed nonce once per network and counts it locally after each receipt; balances are top-ups, so the re-run sent only what was missing.
Prevention: any script that sends several transactions in a row tracks its own nonce after the first confirmed read; never re-read the nonce from a load-balanced RPC between sends.

### P-foundation-3: the Read refusal text changed
When: 2026-11-05 21:53 IST · Activity: foundation · Cost: none
Symptom: the A3 self-check's refusal reads "File is in a directory that is denied by your permission settings.", not the pack's "covered by a Read deny rule".
Cause: Claude Code 2.1.318 words the refusal differently; the block itself holds (the shell `cat .env` is refused too).
Fix: recorded both refusals in `docs/thinking-partner/relays/foundation.md`.
Prevention: A3 checks that the read is refused, not the exact wording.

### P-foundation-4: the lab import could have stored a wrong key
When: 2026-11-05 22:28 IST · Activity: foundation · Cost: one review round; no wrong key was stored (the real import matched both addresses)
Symptom: reviewer pass 1 showed that `secrets:import-lab` wrote a key before comparing its address with the carried-over wallet, and a later correct import would then be refused.
Cause: check after write.
Fix: the address is checked before anything is written; the other two names are validated too (PR #3, with tests).
Prevention: helpers that write secrets validate first, write second; the reviewer runs on every helper that touches keys.

### P-identity-1: reads and receipts right after a write fail on the load-balanced Sepolia RPC
When: 2026-11-06 01:45 IST · Activity: identity · Cost: three resumed runs of the real provisioning; no wrong state (every step is idempotent)
Symptom: the real run stopped with "resolve returned no data" right after its first deploy, then with "points at another registry or resolver" right after a registration that had mined. On the anvil fork, viem's `waitForTransactionReceipt` timed out on a transaction that had mined.
Cause: a read seconds after a write can hit a node a block behind (the pack's pitfall 3); my one-shot checks trusted it. viem's receipt wait missed a transaction mined before its block watch started.
Fix: the provisioner's reads retry (`retryingReads`), post-write checks wait for the value (`eventually`), and receipts are polled with `getTransactionReceipt`.
Prevention: never assert state in the same instant as a write; poll until it shows, then fail with the name of what did not show.
## arkiv

### P-arkiv-1: a send that landed but was reported as failed was written a second time
When: 2026-11-06 03:10 IST · Activity: arkiv · Cost: about 25 minutes; the risk was a refusal or quote receipt written twice (no tally was wrong: the mirror's fold guard counts a ref once)
Symptom: Join's mirror (PR #20) saw that after an uncertain send, `recordEdge` sent the same refusal again at a new nonce, giving one ref two edges.
Cause: the recovery checks of `recordEdge`, `createQuote` and the unstreamed ledger read `e.attributes`, but SDK 1.0.1's `getEntity(key)` returns a flat row with the columns under `$attributes` (`dist/index.d.ts`, `FullEntity`). Every "is this ours?" check said no, so the writer took its own transaction for another writer's. With the checks working, the reviewer then found the quote check too weak: one errand's quotes share a `request_id`, so an instance could adopt another instance's quote for a different shop.
Fix: read `e.$attributes ?? e.attributes`; the quote check also matches the shop, agent and price; the recorder also matches the kind and both ends; the ledger compares its first edge's own ref. ArkivSim tests in both directions (an uncertain send lands once; a second instance's quote at the pinned nonce is not adopted), each failing on the code it guards against: https://github.com/Zugzwang-world/graphpay/pull/25
Prevention: every `verifyRecovered` check has an ArkivSim test that goes through the stock SDK client (never a hand-built entity), plus a negative case where another writer's transaction holds the nonce.

### P-arkiv-2: the byte meter lost responses when reads overlapped
When: 2026-11-06 03:40 IST · Activity: arkiv · Cost: about 15 minutes and one benchmark re-run; the risk was wrong byte numbers in the public benchmark report
Symptom: the first full live run showed plain Q2 at 8 requests in flight moving 105.6 KB, against 132 KB at 4, 16 and "all", though at 5 pages all four send the same requests. A repeat gave 78 to 132 KB for identical runs. Call counts and answers were right every time.
Cause: `stats.responseBytes += Buffer.byteLength(await response.clone().text())` in `packages/arkiv-graph/src/transport.mjs`. JavaScript reads the left side before the `await`, so two responses in flight both added to the same old total and one count was lost. Sequential reads were never affected.
Fix: read the body first, then add; an ArkivSim test sends five reads at once and expects five bodies counted (the old code counted one). The benchmark was re-run on the fixed commit (arkiv/bench PR).
Prevention: no `+=` with an `await` on its right side in shared counters; any number from a parallel mode is checked against the same requests sent one at a time before it is reported.

### P-arkiv-3: another instance's transaction at our nonce was returned as ours
When: 2026-11-06 (found by T1's reviewer, fixed by T3) · Activity: arkiv · Cost: no data lost; W_DIRECTORY quote writes failed with `WriteUncertainError` under contention, and a refund request could have been reported written when it was not
Symptom: with several Vercel instances writing as one key, one instance's single-create transaction can take another's nonce; the second instance's write came back with the first one's entity key.
Cause: `sendChunk`'s direct path adopted `res.txHash`, which SDK 1.0.1 takes from `receipt.transactionHash`; viem's `waitForTransactionReceipt` follows a replacement, so the hash was the other transaction's. The create-count check passed (one create each) and `verifyRecovered` was only called on the recovery path.
Fix: `arkivTransport` records the hash of every `eth_sendRawTransaction` it sends (`sentHashes`); the writer treats a returned hash it did not send as a replacement (next nonce, or `NONCE_TAKEN` with a fixed nonce; a pinned resend defers to the recovery path). ArkivSim tests land a transaction from a second transport at the same nonce and fail without the fix.
Prevention: any new place that builds a writer passes `sentHashes` (both `connect` helpers do); the replacement tests stay.

### P-arkiv-4: the Arkiv access key's quota ran out and every production read failed
When: 2026-11-06 about 21:36 IST · Activity: arkiv · Cost: the map and the phones' live state showed nothing until the fix; no data lost
Symptom: `/api/map` answered 502 "the graph did not answer" and `/api/state/customer` 502 "a source did not answer"; chain heads and `eth_chainId` still answered.
Cause: the keyed endpoint's quota was spent (`429 QUOTA_EXCEEDED`, `arkiv-quota-used-percent: 100`) while its `ratelimit` header still showed plenty of per-window room, so the per-second limit looked fine. It was the booth question about the monthly quota (ADR-0044: "unknown, log the header"). We logged `ratelimit` but not the quota header, and a 429 with that body was treated as a plain failure.
Fix: `arkivTransport({ fallbackUrl })` repeats a call refused with `QUOTA_EXCEEDED` on the keyless public endpoint and keeps using it for 10 minutes before trying the key again; `connectArkiv` sets it whenever it has a key; tests in `packages/arkiv-graph/test/quota.test.mjs`. Until the deploy, removing `ARKIV_ACCESS_KEY` from the Vercel production environment has the same effect.
Prevention: the status route should show `arkiv-quota-used-percent`; seeds and benchmark reruns spend the same quota as production, so they should run on the keyless endpoint.

## records

### P-records-1: the worktree sessions' prompt logs land in the main checkout
When: 2026-11-06 01:00 IST · Activity: records · Cost: none yet; the logs are kept, not lost
Symptom: `~/graphpay` shows untracked `prompts/raw/2026-11-06-*.jsonl` files and a modified M0 log; the sessions' worktrees have none, so their PRs do not carry their logs as `CLAUDE.md` asks.
Cause: the hook writes to `$CLAUDE_PROJECT_DIR/prompts/raw/`, and for a session started on `~/graphpay` with the worktree option that is the main checkout, not the worktree.
Fix: 03:20 IST, the hook writes into the session's own checkout (the git top level of its working directory; `logRoot` in `scripts/hooks/prompt-log.mjs`, with tests). The logs already written in the main checkout are swept into records PRs under `<name>.main-checkout.jsonl`, so they never collide with a session's own file. M0's failed step at Thu 23:56 ("fast-forward the main checkout" refused by M0's own appended log) had the same cause; the main checkout was fast-forwarded at 03:14.
Prevention: a hook that writes repo files resolves the checkout from the session's working directory; a test covers a worktree.

### P-records-2: GitHub calls time out on the venue network
When: 2026-11-06 00:49 IST · Activity: records · Cost: about 5 minutes
Symptom: `git fetch` failed with "Could not resolve host: github.com"; `gh` calls failed with "TLS handshake timeout".
Cause: slow venue Wi-Fi: name lookups took 3–7 s, the TLS handshake about 6 s, and pings to 1.1.1.1 184–256 ms; `gh` gives up on a slow handshake.
Fix: retry the same call a few times with a pause; every call has gone through within three tries so far.
Prevention: the ticks retry GitHub calls before reporting a failure; a session whose push fails retries rather than stopping.

### P-records-3: the event sessions started on the wrong model and effort
When: 2026-11-06 01:08 IST · Activity: records · Cost: about 25 minutes of every session at max effort; the weekly plan limit went from 70% to 71%
Symptom: all seven sessions reported Opus 5.5 at max effort, while the plan has Sonnet 5.5 at high for T2, T4 and T5, Opus 5.5 at xhigh for T1, T3 and Join, and Opus 5.5 at high for the Coordinator; the weekly limit was at 70% with 20 hours to its reset.
Cause: a new session takes the model and effort shown in the picker (the last ones used, M0's Opus 5.5 at max); the start lines carry no model.
Fix: at 01:22 the Coordinator set each track session to the plan (`set_session_model`, `set_session_effort`; from each session's next turn) and asked each to end its turn at a natural stop so the change applies.
Prevention: the Coordinator checks every session's model and effort and the plan usage at each tick; a new session's start step sets the picker before the start line is pasted.

### P-records-4: the Mac slept with the lid closed
When: 2026-11-06 02:14–03:01 IST · Activity: records · Cost: about 47 minutes of every session
Symptom: no session made progress and no tick ran from 02:14 to 03:01; `pmset -g log` shows "Entering Sleep state due to 'Clamshell Sleep'" at 02:14:20, dark wakes only, then a lid wake at 03:01:32; the Mac was on battery.
Cause: a closed lid sleeps the Mac whatever the keep-awake holds say (the app's hold and `caffeinate` stop idle sleep only), and it was not on power.
Fix: a push notification to the founder at 03:04 (charger in, lid open); first in "Founder now".
Prevention: the Coordinator checks `pmset -g batt` and the lid state each tick and notifies the founder at once.



### P-identity-2: the watcher saw no event on a fork, then the public RPC refused its log query
When: 2026-11-06 04:00 IST · Activity: identity · Cost: about 30 minutes
Symptom: a watcher fork test saw no `TextUpdated` after a pause (0 events), and a dry run on real Sepolia failed with "Invalid parameters were provided to the RPC method" for the log query.
Cause: (1) viem caches `getBlockNumber` for its polling interval (4 s), so a poll right after a write read the old head; (2) the public Sepolia RPC refuses a `getLogs` with 19 contract addresses and accepts 10; (3) fork tests that kill a name or jump time leave the fork changed for later tests.
Fix: `getBlockNumber({ cacheTime: 0 })`; log queries chunk addresses by 8; each stateful fork test runs between `evm_snapshot` and `evm_revert`.
Prevention: watcher polls never rely on the client's block cache; any new `getLogs` use chunks addresses; a fork test that changes state is wrapped with the snapshot helper.

### P-website-1: the site read the checkout address in a shape the config never had
When: 2026-11-06 05:25 IST · Activity: website · Cost: about 15 minutes (found by the first live read of a route that needs the contract)
Symptom: `/api/status` reported `checkout: null` and noted "waiting for M2 deploy" on the production site after M2 was deployed; the customer state route failed with "the checkout is not deployed".
Cause: `checkoutAddress()` (written in the shell, before M2) looked for a string value under `whitechain.contracts`; the deployment record is `whitechain.contracts.checkout.address`. Its unit tests used a stand-in shape, so nothing failed until a route used the real config.
Fix: read `contracts.checkout.address`, with a test against the real config.
Prevention: a helper that reads a config section is tested against the real config file at least once, not only against the shape its author expected; a first live read of every new route is part of its step.

### P-website-2: conflict markers committed in a CSS file after a merge
When: 2026-11-06 06:45 IST · Activity: website · Cost: about 25 minutes of CI and a red PR
Symptom: PR 55's `ci` and Vercel builds failed with "Parsing CSS source code failed" at `site.css`; the file held `<<<<<<< HEAD` and `>>>>>>> origin/main` lines.
Cause: after `git merge origin/main` I resolved the conflicted docs files only (the ones I expected) and ran `git add -A`, which committed a second conflicted file (`apps/web/app/site.css`, both PRs appended CSS at its end). The checks I ran before the merge were green, and `pnpm check` does not look for conflict markers.
Fix: kept both sides, rebuilt, pushed.
Prevention: after every merge, list the conflicts from `git status` (or `git diff --name-only --diff-filter=U`) before committing, and run `git ls-files | xargs grep -ln '^<<<<<<< '` plus `pnpm build` before pushing; a merge commit is not green until the build is.
