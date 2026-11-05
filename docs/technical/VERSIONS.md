# VERSIONS (event repo pins)

Every version the event code pins, with how it was checked. Each track adds the versions it installs (after `npm view`) in its own section. Pack values: `planning/FACTS.md` §5.

## M0 (main, checked 2026-11-05 21:58 IST)

| item | pinned | how checked | status |
|---|---|---|---|
| Node | 22.23.4 (`.node-version`, `engines.node` 22.x) | `fnm exec --using=22.23.4 node --version` → v22.23.4; the shell default on this Mac is v24.21.0 | installed; newest 22.x confirmed by the verifier (FACTS) |
| pnpm | 10.34.9 (`packageManager`) | `pnpm install` reports "using pnpm v10.34.9" (the global pnpm is 10.33.2; pnpm switches to the `packageManager` version) | verified |
| viem | 2.57.16 (root devDependency, M0 scripts) | installed from the registry; lockfile | verified |
| Foundry | v1.9.0 (CI `foundry-toolchain` `version:`) | `forge --version` → 1.9.0 (Homebrew) | installed |
| forge-std | v1.9.7, commit 77041d2 | `install-libs.sh` clones the tag and checks the commit prefix | verified |
| solc | 0.8.30, EVM prague, optimizer 200, via IR | `foundry.toml`; matches the Blockscout verification settings in `planning/FACTS.md` §2 | decided |
| `actions/checkout` | v7 | first CI run on `main` | see the CI run |
| `actions/setup-node` | v7 | first CI run on `main` | see the CI run |
| `pnpm/action-setup` | v6 | first CI run on `main` | see the CI run |
| `foundry-rs/foundry-toolchain` | v1.9.2 | first CI run on `main` | see the CI run |
| BIP-39 English wordlist | `scripts/lib/bip39-english.txt` from bitcoin/bips | SHA-256 `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`, 2,048 words; a test compares it with viem's copy | verified |
