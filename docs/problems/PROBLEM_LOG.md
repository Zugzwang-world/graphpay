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

