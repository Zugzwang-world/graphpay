# SPEC: Security and operations

Hard limits that hold even in bypass mode, the repo guardrails the lab used, and the operational rules learned the hard way. Every rule here exists because something broke or nearly broke in the lab.

## 1. Hard limits

- **Testnets only.** Whitechain Sepolia 1874, Ethereum Sepolia 11155111, Arkiv Rabdi 7794095. Never mainnet funds.
- **Never read, print or commit secrets** (`.env*`, keystores, keys, tokens). Generate keys by script straight into `.env` and print addresses only. Environment variables are referred to by name only.
- **Only operate on resources named `graphpay` or `graphpay-*`**: the GitHub repos `graphpay` (the event) and `graphpay-lab`, the Vercel projects `graphpay-event`, `graphpay-store` and `graphpay-lab`. Never list, change or delete anything else in the founder's GitHub, Vercel or Supabase accounts: other live projects exist there.
- **No off-chain database** (ADR-0003): no Supabase, no Redis, no KV. State lives on the Whitechain contract and Arkiv. Vercel only runs code. Secrets live only in the Vercel environment and the local `.env`. No personal data.
- **No code from the lab repo** goes into the event repo (ADR-0002, ADR-0015).
- **Never guess** versions, addresses, chain IDs or API names: verify and record them in `FACTS.md` with source and date.
- Synthetic data is always labelled. No invented numbers. Say "tallies".

## 2. Claude Code guardrails (M0, before anything else)

**Write `.claude/settings.json` first.** Deny rules and hooks take effect mid-session, and from then on `.env` can only be written by scripts. Deny rules block in every mode, including bypass, and a hook cannot override a deny.

Deny rules used by the lab (config values):

| group | rules |
|---|---|
| secrets (read) | `Read(./.env)`, `Read(./.env.*)`, `Read(**/.env)`, `Read(**/.env.*)`, `Read(./keystore/**)`, `Read(**/*.pem)`, `Read(**/*.key)`, `Read(~/.ssh/**)` |
| secrets (shell) | `Bash(cat .env*)`, `Bash(printenv*)`, `Bash(env)`, `Bash(cast wallet new*)`, `Bash(cast wallet private-key*)` |
| force pushes | `Bash(git push --force*)`, `Bash(git push -f*)`, `Bash(git push * --force*)`, `Bash(git push * -f*)`, `Bash(git push *--force-with-lease*)`, `Bash(git push * +*)`, `Bash(git -C * push* --force*)`, `Bash(git -C * push* -f*)`, `Bash(git -C * push* +*)`, `Bash(git push *--mirror*)`, `Bash(git -C * push*--mirror*)` |
| destructive | `Bash(gh repo delete*)`, `Bash(vercel remove*)`, `Bash(vercel rm*)`, `Bash(vercel project rm*)`, `Bash(vercel projects rm*)`, `Bash(supabase projects delete*)` |

Facts about the rules (verified 2026-11-03, Claude Code 2.1.317): a `Read(...)` deny also stops the Write tool and Bash `cat`/`ls`/redirects on matching paths; a script that opens `.env` itself is not blocked (that is how the secret helpers work). Bash rules match the start of each subcommand, so `git push --force*` misses `git push origin --force`; that is why the `* --force*` forms exist. Known gaps: combined short flags (`-uf`) and remote branch deletes; branch protection covers `main`. Settings files reload mid-session. Bypass mode skips prompts for writes to `.claude/`, so Claude could edit its own deny rules: keep the rules in review.

**Prompt log hook** (`UserPromptSubmit`, ADR-0001): appends each founder prompt to `prompts/raw/<date>.jsonl`; prints nothing (stdout would enter the context); skips harness turns (task notifications, system reminders, CI and side-session events); directory mode 0700, files 0600; masks every secret shape, then re-scans the finished line and writes `<withheld: …>` if anything is still found; withholds prompts over 256 KB. Its tests: notifications skipped, each secret shape masked, recovery phrases in quotes, lists and comma forms caught.

**Subagents and skills:** a `reviewer` agent (reads the branch diff, lists blocking issues first; run it on every contract, payment, signature, key, secret or spending-endpoint change) and a `verifier` agent (checks versions, addresses, chain IDs and API names against primary sources). Skills for `ship`, `relay`, `adr`, `problem`, `promote-prompt`. A brand-new `.claude/skills/` folder needs `/reload-skills`; a new `.claude/agents/` folder needs a restart before use.

## 3. Secrets tooling (knowledge, rebuild fresh)

| helper | behaviour |
|---|---|
| `pnpm secrets:set NAME` | prompts in a real terminal with keystrokes hidden, writes `.env`, prints the name and a status only. For keys copied from a web console (`ANTHROPIC_API_KEY`) |
| generate a random secret | `NAME [--bytes 32]` → base64url into `.env` (`DEMO_PASSCODE`, `FACILITATOR_AUTH_TOKEN`, `RECORDER_TOKEN`, `CRON_SECRET`); at least 24 characters |
| set from stdin | `<command> \| set-from-stdin NAME`: stores another tool's output without echoing it |
| env status | lists every name in `env.example` as set or missing; never values |
| wallet generator | creates **one named role at a time** (`--only ROLE`) straight into `.env` and prints the address only. A generator that fills every missing role minted clashing keys twice in the lab |
| Vercel env push | copies values from `.env` to the pinned `graphpay-*` project on stdin as Sensitive; pin `--project <id>` and `--scope <team>`; drop `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` overrides |
| **git-based env loader** | worktrees have no `.env`. Use this checkout's `.env` if present; otherwise the **main checkout's**, found through `git rev-parse --git-common-dir`, **only if git ignores it there**; `ENV_FILE` overrides both and must also be git-ignored. Every script and service loads secrets through this one lookup |

`.env` rules: never `JSON.parse` a value (Node's parse error quotes its input); refuse values `.env` cannot hold safely (quotes, backslash, `$`, backtick, newline) with a name-only error; write atomically with fsync, leave no temp copy; parse CRLF files.

**Importing from the lab** (`DECISIONS.md` E-7, fresh event wallets): a script copies only a fixed allowlist from the lab's `.env` into the event repo's `.env`: `FUNDER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ANTHROPIC_API_KEY`. It refuses any other name, prints names only, and refuses to overwrite a different existing value. Every other role key is new: the wallet generator makes it with `--only ROLE`, one role per run, through the setter's write path, and prints the address only.

## 3b. Environment names (the one list for `env.example`)

| group | names |
|---|---|
| role keys (one per role in `WALLETS.md` §1) | `<ROLE>_PRIVATE_KEY`: `FUNDER_`, `OPERATOR_` (imported); `DEPLOYER_`, `FACILITATOR_`, `RENEWER_`, `POLICY_WRITER_`, `W_SYNC_`, `W_LEDGER_`, `W_SEED_EVENT_`, `W_SEED_M_EVENT_`, `VITALIK_`, `SHOP_KESAR_`, `SHOP_JAMUN_`, `SHOP_SYRUP_`, `PAYER_`, `DEAL_HUNTER_`, `REHEARSAL_PAYER_`, `ACCEPTANCE_PAYER_` (fresh); `DISPOSABLE_<n>_PRIVATE_KEY` (one per kill, `n` = 1, 2, …) |
| imported credentials | `ARKIV_ACCESS_KEY`, `ANTHROPIC_API_KEY`; optional `XAI_API_KEY` |
| generated secrets (≥ 24 characters) | `DEMO_PASSCODE`, `FACILITATOR_AUTH_TOKEN`, `RECORDER_TOKEN`, `CRON_SECRET` |
| networks | `WHITECHAIN_RPC_URL` (**the one name for the Whitechain RPC**, in scripts and services alike; default `https://rpc.ankr.com/whitechain_testnet`, backup `https://rpc.testnet.whitechain.io`; FACTS), `SEPOLIA_RPC_URL`, `ARKIV_RPC_URL` (a local Arkiv node only), `ALLOW_REAL_NETWORK` |
| contract and token | `GRAPHPAY_CONTRACT`, `GRAPHPAY_TOKEN`, `GRAPHPAY_TOKEN_NAME`, `GRAPHPAY_TOKEN_VERSION`, `DEPLOY_BLOCK`, `CONFIRMATIONS` |
| facilitator and shop | `ALLOWED_MERCHANTS`, `SHOP_MERCHANTS`, `MAX_SETTLE_GAS`, `GAS_BUDGET_DAILY_WBT`, `MIN_RELAYER_BALANCE_WBT`, `RECORDED_FAILURES_PER_DAY`, `RECEIPT_TIMEOUT_MS`, `FACILITATOR_URL`, `ATTEMPTS_URL` |
| ENS | `GRAPHPAY_ROOT_ENS` (**the one name for the root**, `graphpay.eth`), `ENS_ALLOWED_ROOTS`, `ENS_GATE_TTL_MS` |
| Arkiv and mirror | `ARKIV_BACKEND`, `MIRROR_SYNTHETIC`, `BOOTSTRAP_FILE`, `DELIVERY_PROMISE_S`, `RECORDER_OWNER` |
| agents and e2e | `AGENT_MODEL`, `AGENT_MODE`, `AGENT_PROVIDER`, `E2E_BUYER`, `E2E_MODEL`, `E2E_KILL`, `E2E_NETWORK`, `E2E_HISTORY_SCALE` |

The services' tables (`SPEC/PAYMENTS_WHITECHAIN.md` §9, `SPEC/INTEGRATION_AND_MIRROR.md` §7) say which service reads which name. The env status helper lists every name above as `set` or `missing`.

## 4. Secret scan (CI and pre-commit)

- A `prepare` script runs `git config core.hooksPath .githooks`; the pre-commit hook scans the **staged snapshot**, reports unreadable staged files, and scans files of any size.
- Shapes detected (labels): Anthropic API key, xAI API key, JWT, hex private key next to a key word (the words `private key`, `priv key`, `secret key` or `signer key`, in any of the forms `private_key`, `private-key`, `privatekey`, followed within 16 spaces by an optional `:` or `=`, an optional quote and 64 hex digits; a bare 64-hex value alone is flagged **only in prompt logs**, so public transaction hashes and `key` columns in `planning/` pass; the lab's scan found nothing in this pack), PEM private key, **Arkiv access key inside a Rabdi RPC URL**, GitHub classic and fine-grained tokens, database URL with a password, recovery phrase (12–24 consecutive lowercase BIP-39 words, in quotes or as a list, after a key word such as MetaMask's "Secret Recovery Phrase" or "seed words"; ordinary prose after the key word is not a phrase, and the tests include this line and `SPONSOR_CHECKLIST.md`'s "writing down a seed phrase, or knowing what chain…" as must-pass cases), and in prompt logs any 64-hex value (possible key). Placeholders like `${VAR}`, `<key>` and `[YOUR-PASSWORD]` pass.
- Never write key-shaped literals in tests: build them at run time.
- Also checked in CI: `env.example` holds names only; no `.env*` is tracked.

## 5. Repo, CI and merge settings

- Public repo `graphpay`, created empty at the event. Protected `main`: required check `ci` (exactly that name, no path filters so docs PRs report it), admins included, linear history, no force-push, no deletion. Repo: auto-merge on, delete branch on merge on, squash only. (Branch protection and auto-merge on a **private** repo need GitHub Pro; a public repo works on Free.)
- CI jobs: `ci` (install with frozen lockfile, syntax check scripts, repo hygiene and secret scan, tests, lint, typecheck, build) and `contracts` (Foundry toolchain v1.9.0, install contract libraries, `forge build --sizes`, `forge test` on a pinned-block fork of Whitechain). Fork tests that need anvil plus a Sepolia RPC run locally, not in CI. Checkout without persisted credentials. A package `test` script must not call `forge` (the Node runner lacks it).
- Pins (re-verify): `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `foundry-rs/foundry-toolchain@v1.9.2`.
- Auto-merge took about 4 minutes after green in the lab and twice did not fire; if a PR is green and `CLEAN` for several minutes, merge it directly with squash. Never merge on red or pending. `gh pr merge --auto` right after a push can fail with "Base branch was modified": run it again once CI has started.
- **Force-push is denied.** Rebase only before the first push; afterwards merge `origin/main` into the branch. Keep lockfile-touching changes in one early PR (parallel sessions conflict on `pnpm-lock.yaml`; resolve by taking main's lockfile and re-running `pnpm install`).
- A combined `git push … && gh pr create` with a heredoc body was refused by the permission layer: write the body to a file and run the commands separately.

## 6. Vercel

- Project `graphpay-event` (a `graphpay-*` name, as the hard limits require): framework `nextjs`, root `apps/web`, Node `22.x` (Vercel's default is 26.x; pin `engines.node` and `.node-version`), pnpm via `packageManager`. A second project `graphpay-store` for the demo store.
- **Right after `gh repo create`, the founder grants the Vercel GitHub app access to the new repo.** Without it `vercel git connect` fails (`Failed to connect … Make sure there aren't any typos and that you have access to the repository if it's private`). Meanwhile deploy from the CLI.
- Add `.vercelignore` with `.env*`, keystores, `*.pem`, `*.key`, `.claude/`, `prompts/raw/` before any CLI deploy. `vercel link` writes `.env.local` (an OIDC token) and appends to `.gitignore`.
- Production deployment URLs sit behind Vercel Authentication (HTTP 302); the production domain is public.
- Secrets go in as Sensitive (list as Secret/Hidden); public config as plain values. CLI 65.10.0: `vercel env add NAME --environment production --force --yes --sensitive --project <id> --scope <team>` reads the value on stdin; `vercel deploy --prod --yes --project <id>`.
- Deploy only commits on `origin/main` (upload the commit as committed, so no ignored file can ship).
- Cron on Pro: once per minute. Function default timeout 300 s; bodies up to 4.5 MB; streaming (SSE) works on the Node runtime.
- GraphQL for browsers: `GET` with `Cache-Control: s-maxage=5, stale-while-revalidate=10`. Spending and settling endpoints: `no-store`. Race mode: uncached.

## 7. Spending protection (no database, so the bounds are on-chain)

| bound | where | value |
|---|---|---|
| demo passcode on every spending endpoint | shop API, website server routes | header `X-Demo-Passcode`, at least 24 characters |
| bearer token on `/verify`, `/settle` and the recorder routes | facilitator, recorder | `FACILITATOR_AUTH_TOKEN`, `RECORDER_TOKEN`, constant-time compare |
| per-agent daily cap | AgentPolicy (contract) | 6.00 per UTC day for `payer.vitalik` and `acceptance.vitalik`, 30.00 for `rehearsal.vitalik` (each its own wallet); 1.00 for `scout.vitalik` and disposable agents |
| relayer-balance floor | facilitator (reads the chain) | refuse below 0.3 WBT |
| gas cap per settle | facilitator | 450,000 |
| recorded failures | facilitator (per instance) | 20 per day |
| rate limits | facilitator (per instance) | 60/min, 10/min per payer, 30/min per payee |
| relayer key holds only WBT | wallet | the only call the facilitator ever encodes is `settleOrder` |

In-memory limits are per Vercel instance; only the on-chain bounds hold for the whole deployment.

## 8. Redaction rules (each one was a real leak path)

1. **viem error messages contain the RPC URL**, and the Arkiv access key (and any keyed RPC) is in the URL. Wrap every real transport so errors are redacted and keep the JSON-RPC `code` and `data`.
2. Every script installs one error boundary that redacts every `.env` value from any uncaught error, child-process output and transcript line. Test it with a fake RPC that answers the chain id and then HTTP 500.
3. **Redact before you truncate** (a key spanning the cut survived in a lab HTTP log).
4. Never print a start-up RPC error.
5. Logs keep host, status, time and the `ratelimit` header, never full URLs or bodies with secrets.
6. Agent and tool errors are scrubbed of `sk-`/`xai-` shapes and configured keys before tracing.
7. anvil forks from a keyed upstream go through a local read-only forwarder; the key stays in process memory, never in argv.

## 9. Operations

- **Records kept current during the build** (the event repo's own): `docs/plan/MASTER_PLAN.md`, `docs/thinking-partner/` (`NOW.md`, `relays/`, `LOG.md`, `OPEN.md`, `briefs/`; there is no `docs/plan/NOW.md`), `docs/decisions/`, `docs/problems/PROBLEM_LOG.md`, `docs/technical/FACTS.md`, `VERSIONS.md`, `AI_USAGE.md`, the founder's to-dos in `docs/thinking-partner/OPEN.md`.
- **Founder to-dos:** anything only the founder can do goes in your activity's section of `docs/thinking-partner/OPEN.md` (what, where, why, a recommendation); keep working on everything else. There is no `OPERATOR_QUEUE.md` in the event repo.
- **One relayer key per writer of nonces:** the hosted facilitator and scheduled renewals use different relayer keys (E-1). Never run local scripts with the hosted relayer key while the demo is live.
- **Real chains lag:** the public Sepolia RPC is load balanced (a read right after a write can be a block behind); Whitechain receipts usually arrive within seconds (1 s blocks); Rabdi takes about 5–8 s per write end to end.
- **Pending records before sends:** record a deployment's predicted address and nonce before sending; a dropped, replaced or reverted deploy is detected, never repeated.
- **Fork versus real:** probe with `anvil_nodeInfo` and check `eth_chainId` before every signing script; `--rpc` overrides are loopback-only.
- Don't edit a shell script while bash is running it.
