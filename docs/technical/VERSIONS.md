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

## M3 payments (`pay/facilitator`, T1, checked 2026-11-06 03:20 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| `@x402/core` | 2.30.0 (`latest`; only this one of the four `@x402/*` packages is used) | `packages/facilitator`, `packages/shop`; API names read from the installed `dist/esm/*.d.mts` and `.mjs`. They match `planning/SPEC/PAYMENTS_WHITECHAIN.md` §5 (written against 2.29.0) with three notes: `SchemeNetworkClient.createPaymentPayload(x402Version, requirements, context?)` returns only `{ x402Version, payload }` (x402Client adds `accepted`, `resource` and `extensions`) and receives `context.maxAmountPerPayment`, the resolved spend cap, which our client also enforces; `HTTPFacilitatorClient` uses the global `fetch` with `redirect: "follow"`, a timeout, and throws on any non-2xx answer (the shop turns that into a 502); `createAuthHeaders` must return headers keyed by path (`{ verify, settle, supported }`), a flat object throws. `setSpendControls({ allowedAssets: [{ network, asset, maxAmountPerPayment }] })` is required for the token (a test shows the default refuses it) | verified |
| viem, zod | 2.57.16, 4.6.7 | the repo's pins | verified |

## arkiv (T3, M7a, checked 2026-11-06 00:58 IST with `npm view`)

| item | pinned | in | status |
|---|---|---|---|
| `@arkiv-network/sdk` | 1.0.1 (`latest`) | `packages/arkiv-graph`, `packages/money-graph`, `packages/mirror` | verified |
| viem | 2.57.16 (`latest`) | both | verified |
| graphql | 16.14.2 (the pack's pin; 16.15.0 is the newest 16.x, `latest` is 17.1.0) | `packages/money-graph` (M7b) | verified; one major in the repo |
| graphql-yoga | 5.24.6 (newest 5.x; `latest` 6.0.1 avoided) | `packages/money-graph` (M7b) | verified |
| dataloader | 2.2.3 (`latest`) | `packages/money-graph` (M7b) | verified |
| `@modelcontextprotocol/sdk` | 1.32.2 (`latest`, 2026-10-23) | `packages/money-graph` (M7b) | verified (the pack had from-research) |
| zod | 4.6.7 (`latest`; the MCP SDK accepts ^3.25 or ^4) | `packages/money-graph` (M7b) | verified |

## T4 agents (`agents/m10-teams`, checked 2026-11-06 01:30 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| `ai` | 7.0.162 (`packages/agents`) | the lab's pin; still exists per the M0 verifier (`docs/technical/FACTS.md`, `latest` is 7.0.163); installed from the registry tarball, API names read from its shipped `dist/index.d.ts` and `docs/` (`ToolLoopAgent`, `Output.object`, `isStepCount`, `wrapLanguageModel`, `ai/test` `MockLanguageModelV4`) | verified (not the newest patch; the lab's tests ran on it) |
| `@ai-sdk/anthropic` | 4.0.96 | same (`latest` 4.0.97); `providerOptions.anthropic.effort` and native structured output for Opus 5.5 read from its shipped docs | verified |
| `zod` | 4.6.7 | = `latest` (FACTS.md) | verified |
| `graphql` | 16.14.2 | same pin as `packages/arkiv-graph`; the mock MCP runs real graphql-js | verified |

Not installed: `@ai-sdk/mcp` (the live MCP client is Join's wiring in M12, through the `McpLike` interface) and `@ai-sdk/xai` (Grok is optional, not built).

## Website (`apps/web`, web session, checked 2026-11-06 00:30 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| uqr | 0.1.3 (QR codes drawn as SVG; MIT, no dependencies) | `npm view uqr` → `latest` 0.1.3 (modified 2026-04-03); installed; its `.d.ts` read for `encode` | verified |
| viem | 2.57.16 (the root pin, now also a web dependency; not used by code yet) | lockfile | verified |
| next, react, react-dom, typescript | as in the M0 placeholder section above | unchanged | verified |
| Baloo 2 (700, 800), Mukta (400, 600) | via `next/font/google` (self-hosted at build; the spec's fonts) | `next build` fetched both | verified |

## integration (Join, `integration/`, checked 2026-11-06 03:25 IST with `npm view`)

| item | pinned | how checked | status |
|---|---|---|---|
| `@ai-sdk/mcp` | 2.0.90 (published 2026-11-03) | `npm view @ai-sdk/mcp time` and `dependencies`: 2.0.90 depends on `@ai-sdk/provider-utils` 5.0.74 and `@ai-sdk/provider` 4.0.35, the same as `ai` 7.0.162 (T4's pin), so the tools share one copy; `latest` 2.0.91 (2026-11-05) moved to provider-utils 5.0.75 and would install a second one. Live: `connectMcp()` lists `schema, ask, graphql, explain` on the production domain's `/api/mcp` and answers `schema` and `graphql` | verified |
| `ai`, `zod`, `viem` | 7.0.162, 4.6.7, 2.57.16 | the pins already in the lockfile (T4, T3, M0) | verified |
