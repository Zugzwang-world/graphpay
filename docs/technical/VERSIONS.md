# VERSIONS (event repo pins)

Every version the event code pins, with how it was checked. Each track adds the versions it installs (after `npm view`) in its own section. Pack values: `planning/FACTS.md` §5.

## M0 (main, checked 2026-11-05 21:58 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| Node | 22.23.4 (`.node-version`, `engines.node` 22.x) | `fnm exec --using=22.23.4 node --version` → v22.23.4 (the shell default on this Mac is v24.21.0); the newest 22.x on nodejs.org (verifier) | verified |
| pnpm | 10.34.9 (`packageManager`) | `pnpm install` reports "using pnpm v10.34.9" (the global pnpm is 10.33.2; pnpm switches to the `packageManager` version) | verified |
| viem | 2.57.16 (root devDependency, M0 scripts) | installed from the registry; lockfile | verified |
| Foundry | v1.9.0 (CI `foundry-toolchain` `version:`) | `forge --version` → 1.9.0 (Homebrew) | installed |
| forge-std | v1.9.7, commit 77041d2 | `install-libs.sh` clones the tag and checks the commit prefix; the latest release is v1.17.0 (2026-09-30), the pin still resolves and the lab's tests passed on it | verified (not the newest; M1 may move it with a note) |
| solc | 0.8.30, EVM prague, optimizer 200, via IR | `foundry.toml`; matches the Blockscout verification settings in `planning/FACTS.md` §2 | decided |
| `actions/checkout` | v7 | tag `v7` → `3d3c42e5aac5` = v7.0.1, the latest release (verifier, 21:56) | verified |
| `actions/setup-node` | v7 | tag `v7` → `949feb2413d6` = v7.1.0, the latest release (verifier, 21:56) | verified |
| `pnpm/action-setup` | v6 | tag `v6` → `73e46992e05b` = v6.1.1, the latest release (verifier, 21:56) | verified |
| `foundry-rs/foundry-toolchain` | v1.9.2 | tag `v1.9.2` → `dba66c27052e`, the latest release (verifier, 21:56) | verified |
| BIP-39 English wordlist | `scripts/lib/bip39-english.txt` from bitcoin/bips | SHA-256 `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`, 2,048 words; a test compares it with viem's copy | verified |

## M0 web placeholder (`apps/web`, main, checked 2026-11-05 22:20 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| next | 16.4.5 | `npm view next version` (npm `latest`, published 2026-11-03); the pack pinned 16.4.4 (published 2026-11-02); `next build` passes on Node 22.23.4 | changed from the pack (newest patch of the same minor) |
| react, react-dom | 19.3.1 | `npm view`; matches the pack | verified |
| typescript | 5.9.3 | the pack's pin (npm `latest` is 7.0.2; Next's template major is 5) | verified |
| @types/react, @types/react-dom | 19.3.0 | `npm view` (latest 19.x) | verified |
| @types/node | 22.20.5 | `npm view @types/node@22` (latest 22.x, matching Node 22) | verified |

## M0 agent preset probe (`m0/story-config`, checked 2026-11-05 23:37 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| `@anthropic-ai/sdk` | 1.5.0 (root devDependency, used by `pnpm agents:probe`) | `npm view @anthropic-ai/sdk dist-tags` → `latest` 1.5.0 (published 2026-11-04 20:29 UTC); installed from the registry, lockfile. The client takes its base URL from the config (`models.apiBaseUrl`), so a shell `ANTHROPIC_BASE_URL` is never read | verified |

## Versions the tracks install (re-check with `npm view` before pinning)

The M0 verifier's snapshot of every package in `planning/FACTS.md` §5 is in `docs/technical/FACTS.md` (Results). Changes since the pack: x402 2.30.0 is `latest` (move all four `@x402/*` packages together or keep 2.29.0); `ai` 7.0.163, `@ai-sdk/anthropic` 4.0.97, `@ai-sdk/mcp` 2.0.91; graphql 16.15.0 is the newest 16.x (`latest` is 17.1.0; keep one major); sigma `latest` is 4.0.4 (3.0.3 is the newest 3.x). Each track adds its pins here under its own heading.

## M1 payments (`pay/contract`, T1, checked 2026-11-06 01:00 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| OpenZeppelin Contracts | v5.7.0, commit `cab19933c33c` | `install-libs.sh` clones the tag and checks the commit; M0 verifier: latest release | verified |
| Permit2 (interfaces only) | commit `cc306b601f172c51bc04334a109e98340456620b` | `gh api repos/Uniswap/permit2/git/refs/tags`: the repo's only tag, named after the canonical deployed address, points to this commit (2022-11-17); `install-libs.sh` fetches the commit and checks it | verified |
| forge-std | v1.9.7 (`77041d2`), kept | has every cheatcode the suite uses (`getBlockTimestamp`, `snapshotState`, `keyExistsJson`, `deployCodeTo`) | verified |
| viem (in `@graphpay/contracts`) | 2.57.16 | same as the root pin | verified |
