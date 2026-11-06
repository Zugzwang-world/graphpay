# T2 Identity: resume notes (updated 2026-11-06, after M6, B7 and B9 (a))

Read `docs/plan/sessions/T2-identity.md`, `CLAUDE.md`, then this. Model Sonnet 5.5 at high; keep tool output short.

## Done and merged
- M5 (#18) namespace; M6 gate + owner actions (#34); M6 watcher + policy sink + B8's MCP call (#40, "M6 done"); B7 fork test (#83); B9 (a) payee comparison in `scripts/ens/acceptance.mjs` (#84, check it merged).
- `packages/ens`: `createEnsGate` (`ensGate`, `ensCheck`), `createOwnerActions` (pause, resume, kill), `createEnsWatcher`, `createPolicySink`. Scripts: `owner.mjs` (pause|resume|kill|disposable), `gate-pass.mjs`, `watch.mjs` (dry run), `acceptance.mjs`, `real-run.mjs`, `b3-real.mjs`.
- 47 unit tests (`pnpm --filter @graphpay/ens test`), 12 fork tests (`test:fork`, needs an anvil fork with `disposable-2` and `disposable-3` provisioned: see the header of `test-fork/gate.fork.test.mjs`; `DISPOSABLE_2` and `DISPOSABLE_3` keys exist in `.env`).
- `disposable-1` was killed on real Sepolia (by Join/Coordinator); never provision it again. `disposable-2`/`-3` exist only on forks.

## Waiting / next
- The demo cast's ENS names through `real-run.mjs` (Friday item 6) the moment the story locks: the Coordinator will say. Then re-run `acceptance.mjs` and `gate-pass.mjs`.
- Join hosts the watcher (`createEnsWatcher` + `createPolicySink`) in the workers process; B6/B7/E7 real timings count from the kill's receipt (25 s tolerance).
- B9 (a): re-run `node scripts/ens/acceptance.mjs` when more shops have a settled payment.
- Friday item 17 (ERC-8004, ENSIP-25) only if time.
- A second kill demo needs `DISPOSABLE_2` funded (0.005 WBT + 1 test USDT, Coordinator's `pnpm funding`), then `node scripts/ens/owner.mjs disposable --real`, then `node scripts/whitechain/setup.mjs` (dry run, then `--yes`).

## Gotchas
- Fork: `anvil --fork-url https://ethereum-sepolia-rpc.publicnode.com --fork-block-number <head-10> --auto-impersonate --port 8611`; provision with `node scripts/ens/real-run.mjs --fork http://127.0.0.1:8611 --disposable n --out <scratch file>`. Stateful fork tests run between `evm_snapshot` and `evm_revert`.
- viem caches `getBlockNumber` (use `cacheTime: 0`); the public Sepolia RPC refuses `getLogs` with 19 addresses (use ≤ 8); the Whitechain RPC answers log ranges of 1000 blocks, not 5000.
- `git checkout <branch> -- <path>` overwrites uncommitted edits; commit first. Pushes need retries on this network; write PR bodies to a file; `git push` and `gh pr create` separately. On doc conflicts keep both sides.
- Never read or print `.env`. Pause at 92% weekly usage (Coordinator's rule).
