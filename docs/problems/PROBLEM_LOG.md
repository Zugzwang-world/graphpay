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

