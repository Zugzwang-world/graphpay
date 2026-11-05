# Relay: foundation (M0)

Updated 23:05 IST, Thu 5 Nov. **CP0 holds:** acceptance A1 to A6 pass, the facts are re-verified, the keys are in place, every wallet is funded, Vercel is linked, and `planning/` and this folder are committed.

## In plain words

The event repo exists and is safe to build in. It is public at github.com/Zugzwang-world/graphpay and its first commit is the pre-event pack, unchanged, as `planning/`. `main` is protected: nothing lands without a pull request and a green check, and merges happen on their own once CI passes.

Secrets never leave the Mac's git-ignored `.env`. The helpers print names and public addresses only.

- **Keys:** FUNDER and OPERATOR came from the lab, and every other wallet was created tonight.
- **Funding:** every wallet is funded on all three testnets.
- **Test USDT** arrived just before 22:00. The Whitechain payment can therefore be the real token from the start, not a stand-in, and the qualifying payment no longer waits on anyone.
- **tGLM:** the founder's tGLM also arrived, so the larger synthetic city (M) can be seeded tonight.

The rules were checked at kickoff (deadline Sat 09:00 IST). The organiser's answer on AI was "go all out", and we keep full disclosure.

The addendum's tonight items are folded into the ENS and Arkiv milestones. Every booth question is closed with the founder's defaults, and every decision is an ADR.

**What the founder does next:** start the five wave-1 sessions with the lines in `docs/plan/prompts/session-lines.md`. Also grant Vercel's GitHub app access to the repo (grant only), and paste the Ankr URL when convenient. Nothing is blocked on either.

## Technical

**Repo and CI.** The pack was committed as `847f96a`, and `diff -r` against `~/Downloads/GraphPay-ThinkingPartner/handover/` shows it is identical. A secret-shape sweep ran before the first public push and found nothing. Two direct commits then went to `main`:

- the bootstrap: deny rules, the prompt-log hook, `CLAUDE.md`, the reviewer and verifier agents, the five skills, this folder;
- the CI bootstrap: the pnpm workspace with pnpm 10.34.9 and Node 22.23.4; `pnpm check`, the secret scan plus hygiene plus the address-literal rule, with its pre-commit hook; tests; a placeholder Foundry project; and CI with jobs `ci` and `contracts`.

Both jobs were green on `main` before protection went on at 22:01. Protection: the `ci` check is required, admins are included, history is linear, force-push and deletion are blocked, and merges are squash-only auto-merge with the branch deleted on merge.

**A1 to A6:**
- **A1:** `ci` and `contracts` succeed on `main`.
- **A2:** `pnpm check` is clean. A negative test (a key-shaped string built at run time) is flagged by its label and exits 1.
- **A3:** every deny rule in `SPEC/SECURITY_AND_OPS.md` §2 is present (plus guards against project listing). The self-check is below.
- **A4:** auto-merge is on, squash only, delete-on-merge on. PR #1 merged by auto-merge at 22:13, with no manual merge.
- **A5:** `pnpm wallets:addresses` reports 19 role addresses. FUNDER and OPERATOR match `planning/WALLETS.md`. None is a lab wallet and no two are the same. The import moved exactly the four allowlisted names.
- **A6:** `planning/` is identical to the pack, its README starts with the honest line, this folder exists, and it holds about 3,000 words.

**A3 self-check.** An empty `.env` was created by a script (a direct write is refused once the deny rules load). The `Read` of `.env` was refused with: `File is in a directory that is denied by your permission settings.` The shell `cat .env` was refused with: `Permission to use Bash with command cat .env has been denied.` This is Claude Code 2.1.318; the wording differs from the pack's, but the block holds.

**Secrets (PR #3).** The secret helpers of §3, plus the one config file `packages/config/graphpay.config.json` (ADR-0030), which holds:
- every name, with the pack's cast as tonight's test cast and the demo cast added Friday;
- every address and URL;
- the wallet roles;
- `resolveRpc`.

`resolveRpc` tries the personal Ankr URL (a server-only secret), then public Ankr, then `rpc.testnet.whitechain.io`, and refuses any chain but 1874 (ADR-0031). The scan flags Ankr keys inside Ankr URLs.

Reviewer pass 1 found one blocking issue and eleven smaller ones. The blocking one: the lab import wrote a key before checking its address. All twelve are fixed, and pass 2 is checking the fixes. The real import matched both addresses, so tonight's `.env` was never affected.

**Wallets and funding (PR #4; addresses and transactions in `docs/technical/WALLETS.md`).** There are 17 fresh role keys, including the addendum's directory writer W_DIRECTORY (ADR-0033), and four generated secrets.

The funding script runs a dry run first, then `--execute --real`. It estimates gas for every transfer and picks the RPC with the chain check. There were 29 transfers:
- 12 in WBT;
- 5 in Sepolia ETH, each 204,600 gas to a new account, as the lab warned;
- 6 in tGLM, which covers both the M0 plan and the later plan;
- 6 in test USDT: ACCEPTANCE_PAYER 20, PAYER 30, SHOP_KESAR 20, VITALIK 10, REHEARSAL_PAYER 40, DEAL_HUNTER 2 (ADR-0045).

FUNDER keeps 2.64 WBT, 0.276 ETH, 1.06 tGLM and 31.75 USDT. One Sepolia send was refused once because a load-balanced RPC answered a stale nonce. The script now counts nonces locally, and nothing was double-sent (P-foundation-2).

**Facts (`docs/technical/FACTS.md`).** Every 9 pm row was re-verified, and nothing blocks a track.
- **Sepolia gas:** base fee about 20 wei plus a 3 wei tip, far below the 0.5 gwei stop.
- **ENS:** all 12 ENSv2 addresses are unchanged, and `graphpay.eth` is still bare under OPERATOR.
- **Versions:** Next.js 16.4.5 (a security release, pinned), x402 2.30.0, AI SDK patch releases, graphql 16.15, sigma 4.
- **Model:** `claude-haiku-5-5` answered live.
- **API notes:** for ENS, key-scoped `grantSetterRoles`, DNS-encoded names, and a two-hop Universal Resolver. For Arkiv SDK 1.0.1, readonly is `flags: { readonly: true }`, indexing is set per column, i32 values can be negative, and there is no `ne`.

**Vercel.** The project is `graphpay-event` (`prj_I3XDMAm2tg7lU6vPVzcYyouIqV0m`), with root `apps/web`, Next.js and Node 22.x set by API. Production is at https://graphpay-event.vercel.app, deployed from a clean `origin/main` checkout. The first deploy failed because `prepare` needed git; PR #2 fixed it (P-foundation-1). `vercel git connect` waits for the founder's grant.

**Plan and records.**
- `docs/plan/MASTER_PLAN.md`: the milestones, session ownership (T3 also owns `apps/web/app/api/{graphql,explain,mcp}`), the waves, checkpoints moved about 50 minutes later, and the Friday plan.
- `docs/plan/amendments/M5-ens.md` and `M7-arkiv.md`: the addendum folded in, with main's rulings.
- `docs/plan/ACCEPTANCE_ADDITIONS.md`: A7, B8, B9, D8 to D14, and the amended tests.
- `docs/decisions/`: 22 lab ADRs adopted and 23 event ADRs (ADR-0024 to ADR-0046).
- `docs/problems/PROBLEM_LOG.md`, `AI_USAGE.md` and the README with the disclosure line.

**Deviations from the pack, each with a reason:**
- The prompt log writes one file per session and day, so parallel sessions don't conflict.
- Next.js moved to 16.4.5 for the security fixes.
- The demo flow runs on test USDT, since it arrived.
- `x-graphpay-accepts` replaces ENSIP-31, by the founder's default.
- Agents get `agent-context` plus the Whitechain address as their only setters, following the addendum.
- Every `shop` row comes from W_DIRECTORY, so discovery is one query.

## After CP0 (22:42 to 23:05 IST)

- **The founder's rules** are now ADRs:
  - ADR-0047: one story config, and `pnpm check` fails on story values in code.
  - ADR-0048: agent model presets, with seconds and cost recorded per errand.
  - ADR-0049: the big city waits for the locked story.
  - ADR-0050 to ADR-0053: Mumbai realism, tracks, the pitch wording, the timeline and the cut order.
  - ADR-0054: the stand-in token is retired.
  - ADR-0055: live events poll over HTTPS.
  - ADR-0056: the mirror keeps the Mac awake and resumes after a sleep.
- **Vercel:** connected by the founder at 22:42 IST. The ignored-build step is set, only `ci` is required on `main`, and the public link is https://graphpay-event.vercel.app. The full check list is in `NOW.md`.
- **Founder's Ankr URL:** stored; it answers chain 1874 over HTTPS.
- **Presets:** the probe accepted all three; per-errand calibration rows are in `OPEN.md`.
- **Funding:** nothing new had arrived since M0. W_DIRECTORY was topped up to 0.5 tGLM, and there is no shortfall at today's gas.
