# MASTER PLAN (event repo)

The live plan for ETHGlobal Mumbai, kept by main. Sources: `planning/BUILD_SEQUENCE.md` (milestones, estimates, critical path), `planning/EVENT_RUNBOOK.md`, `planning/EVENT_ADDENDUM.md`, and the event's own records: `docs/plan/amendments/`, `docs/plan/ACCEPTANCE_ADDITIONS.md`, `docs/decisions/`. Deadline: **Sat 7 Nov 09:00 IST, no late submissions**; we submit by **Sat 08:00** (ADR-0053); presentation Sat 09:30.

## 1. Where we are (the Coordinator updates this table)

| milestone | session | prompt (`planning/PROMPTS/`) + amendment | depends on | status |
|---|---|---|---|---|
| M0 foundation | main | `00-foundation.md` | — | done (CP0) |
| M1 contract + Foundry tests | T1 Payments | `01-contract.md` | M0 | done (PR #12, 01:51 IST) |
| M2 deploy and verify (the USDT checkout; the stand-in is retired, ADR-0054) | T1 | `02-deploy-verify.md` | M1 | done (PR #15; checkout verified on Whitechain) |
| M3 facilitator, shop API, recorder; part B real lifecycle and the qualifying USDT payment | T1 | `03-facilitator-shop.md` + `amendments/M5-ens.md` §2, `amendments/M7-arkiv.md` §5 | M1 (part B: M2, M5, M6) | done (PR #42 part A, #45 part B: the first real payment 04:14 IST) |
| M4 hosted on Vercel | T1 | `04-hosted-vercel.md` | M2, M3, M6 | in progress (T1) |
| M5 ENS namespace | T2 Identity | `05-ens-namespace.md` + `amendments/M5-ens.md` | M0 | done (PR #18) |
| M6 gate, kill, watcher | T2 | `06-ens-gate-kill-watcher.md` + `amendments/M5-ens.md` §3 | M5 | done (PR #34 gate, #40 watcher) |
| M7a model, writer, ArkivSim (the generic SDK and GraphPay's layer, ADR-0057) | T3 Arkiv | `07a-graph-model-writer.md` + `amendments/M7-arkiv.md` | M0 | done (PR #14, 01:51 IST) |
| M7b engine, GraphQL, explain, MCP (+ hosted `/api/mcp`) | T3 | `07b-graph-engine-graphql-mcp.md` + `amendments/M7-arkiv.md` §6, §8 | M7a | done (PR #21) |
| M8 city generator; seed **S only** tonight (M waits for the locked story, ADR-0049) | T3 | `08-city-and-seeding.md` + `amendments/M7-arkiv.md` §3, §8 | M7a | done: S seeded on Rabdi (PR #21); M waits for the locked story |
| M9 live benchmark at S (reads, not speed: ADR-0042; M when seeded) | T3 | `09-live-benchmark.md` + `amendments/M7-arkiv.md` §8 | M7b, M8 | done at S (PR #31; D6 passes) |
| M10 agents | T4 Agents | `10-agents.md` + `amendments/M5-ens.md` §2, `amendments/M7-arkiv.md` §5 | M0 | done (PR #11) |
| M11 mirror (one workers process) | Join | `11-mirror.md` + readonly edges (`amendments/M7-arkiv.md` §4) | M1, M7a, M5 | done on the real networks (PR #60; 47 events, each edge exactly once) |
| M12 `e2e:food`, fork then real | Join | `12-e2e-food.md` + payee and quote hooks | M3, M6, M7b, M10, M11 | done (PR #56: A–E as payer; F, E7 and B6 by the kill on disposable-1) |
| M13 `pnpm acceptance` | Join | `13-acceptance.md` + `docs/plan/ACCEPTANCE_ADDITIONS.md` | M4, M9, M12 | 31 pass, 0 fail, 1 blocked (D7), 16 not run (05:12 IST); C2–C6 and F2–F3 wait for M4 hosted |
| M14 records and relay | Coordinator | `14-records-relay.md` | M13 (and every 2 h) | rolling (first relay 01:20 IST) |
| M15 website | T5 Web | `15-website.md` + Friday items 8–13 | M0; wired after M4, M7b, M10 | in progress (shell, phones, race, Open toggle, Pause/Resume merged) |
| M16 checkout kit + demo store (the Operate drop-in: a short snippet, ADR-0032) | T5 | `16-checkout-kit-store.md` | M4 | in progress (a thin layer over @graphpay/agentpay; needs M4) |
| AgentPay SDK (`packages/agentpay`, `examples/agentpay-*`; the Whitechain lane) | T6 AgentPay | the founder's brief (Fri 03:25 IST); `docs/plan/sessions/T6-agentpay.md` when written | T1's and T4's public exports; M3 for the facilitator path | in progress (started 03:25 IST) |
| M17 sponsor files, README, AI usage, video, submission | Submission | `17-submission.md` | M13, M15, M16 | Friday from 13:00 |

**Changes against the pack, all recorded:** everything story-specific comes from `packages/config/story.json` (ADR-0047) and the agents' models are presets there (`testing` active tonight; ADR-0048); test USDT arrived at kickoff (153.75 at FUNDER, distributed; ADR-0045), so the stand-in token is retired (ADR-0054) and C7/E3 no longer wait on supply; the large city waits for the locked story (ADR-0049); the founder's tGLM arrived, so both seed wallets are funded and M seeding can follow S at once; a new directory writer W_DIRECTORY (ADR-0033); the addendum's tonight items are folded into M5 and M7 (`docs/plan/amendments/`); every booth question is closed with the founder's defaults (ADR-0038 to ADR-0044); all names and addresses come from `packages/config/graphpay.config.json` (ADR-0030); the graph package is a generic SDK with GraphPay's payment model in `packages/money-graph`, published on Friday as `@graphpay/arkiv-graph` (ADR-0057; it replaces the pack's `arkiv-graphql`).

## 2. Sessions, worktrees and owned folders

As `planning/BUILD_SEQUENCE.md` §5, plus: **T3 also owns `apps/web/app/api/{graphql,explain,mcp}`** (thin routes over the graph packages; ADR-0037) **and `packages/money-graph`** (`@graphpay/money-graph`: GraphPay's payment model over the generic `@graphpay/arkiv-graph`; ADR-0057); **main owns `packages/config/`** (sessions add their own section in a PR and say so: `whitechain.contracts` by T1, `ens` texts by T2, `arkiv` writer addresses by T3); everyone owns their sections of `docs/thinking-partner/`. **T6 AgentPay SDK** (from Fri 03:25 IST; activity `agentpay`) owns `packages/agentpay` and `examples/agentpay-*`, works on the Whitechain lane only, uses T1's and T4's public exports and never edits their code; the Coordinator tells it when T1's facilitator (M3) merges. The secret helpers (`pnpm secrets:*`, `pnpm wallet:gen --only ROLE`) and the funding script (`pnpm funding`, dry run unless `--execute --real`) are main's; ask main for a top-up.

**Waves.** Wave 1 (T1–T5) starts together as soon as M0 has merged. Wave 2 (Join) starts when M7a has merged. **Seeding (M8) starts as soon as M7a has merged, with size S only** (the test story, for acceptance). Size M waits until the founder locks the final story (ADR-0049).

## 3. Checkpoints (moved to tonight's real start)

M0 began at 21:40 IST and closed about an hour later, so the pack's central times move by about 50 minutes. Core done (CP4) is now expected around **Fri 05:30 IST** (range 04:25–06:35), still well before the Friday programme.

| checkpoint | pass when | pack target | now expected |
|---|---|---|---|
| CP0 | A1–A6, facts re-verified, keys present, wallets funded, Vercel linked, `planning/` and `docs/thinking-partner/` committed | 21:55 | done about 22:45 |
| CP1 | contract tests green; root and owners on Sepolia; one live Rabdi write; agents' mock tests green | 23:00 | about 23:50 |
| CP2 | checkout verified; gate passes all agents; GraphQL on Rabdi S; agents 5 live runs (testing preset); S seeded (M waits for the locked story) | 00:45 | about 01:35 |
| CP3 | `e2e:food` real mode passes A–F | 03:15 | about 04:05 |
| CP4 | `ACCEPTANCE_REPORT.md` committed; relay written | 04:40 | **met 05:15** (31 pass, 0 fail, 1 blocked) |
| CP5 | website live on real data; demo store live; rehearsal 1 | Fri 13:00 | Fri 13:00 |
| freeze | feature freeze (ADR-0053) | — | **Fri 18:00** |
| CP6 | sponsor files, README, AI usage, video; rehearsals; submission checklist green | Fri 21:00 | Fri evening; **submit by Sat 08:00** (hard deadline 09:00) |

## 3b. Timeline and cut order (ADR-0053)

Acceptance tests Fri 05:00–06:00 IST; the demo product Friday daytime; **feature freeze Fri 18:00**; rehearsals Friday evening; the video in the founder's own voice, a Mac screen recording at real speed; submit by **Sat 08:00** (hard 09:00); presentation Sat 09:30.

**Cut order if short:** Swarm, map heartbeats, the renewal, package polish. **Never cut:** the real USDT payment, the live kill switch and the refused cap change, the 48-against-2 race, both phone views, the sponsor files, the video.

## 3c. The large city (ADR-0049)

| item | value | source |
|---|---|---|
| tGLM for one M seeding | about 6.3–8.5 (merged model); W_SEED_M_EVENT already holds 8.5; a second seeding needs another faucet claim (FUNDER keeps 0.76) | `planning/WALLETS.md` §2; lab G-5 (pre-merge M: 4.622 graph + 1.704 plain = 6.33 tGLM) |
| wall-clock for one M seeding | about 100–130 minutes (lab: 79.2 graph + 20.5 plain = 99.7 minutes before the merged columns, plus about 30%) | `planning/FACTS.md` §4; `planning/BUILD_SEQUENCE.md` §2 |
| latest safe start | **Fri 14:00 IST**: 130 minutes of seeding, 30 minutes for the M benchmark and the race check, and 60 minutes of margin before the 18:00 freeze | arithmetic on the rows above |
| story fields the seed reads | `syntheticCity` (seed, days, sizes, popularity, amounts, subscriptions, the re-registered shop), the cast (`persona`, `shops` with their scenario rates, `buyerAgents`), `products`, `renewal`, `locations` (neighbourhoods and coordinates), `city` | `packages/config/story.json`; `planning/PROMPTS/08-city-and-seeding.md` |
| seed the background city before the cast is final? | **No.** The pack's generator places the cast shops at popularity ranks 1–3 and writes the persona's recent purchases, so M depends on the featured cast; a cast-free background city would need a different generator and would break the benchmark's questions. The founder decided to wait | `planning/PROMPTS/08-city-and-seeding.md` |

## 4. Friday plan (addendum A6–A11, C, D)

The core comes first and is never delayed: M11 → M12 → M13 → M14 (CP4). A session takes a Friday item only after its own milestones have merged; before CP4, changes to packages the core uses are additive with no-op defaults.

| # | item | owner | depends on | earliest | estimate | shaped by |
|---|---|---|---|---|---|---|
| 0 | Core M11 → M12 → M13 → M14, with tonight's amendments (readonly edges, quotes, payee from ENS) | Join, then main | as in the pack | Thu 23:00 (CP1) | 3.8–5.3 h (`BUILD_SEQUENCE.md` §2) | M5 and M7 amendments |
| 1 | Entities and queries: `shop_open` (`shop_key`, `open_until`; mutable; 15 min); `agent_presence` (`agent_ens`, `owner_ens`, `role`, `session` = run id; readonly, renewed by extend; 15 min); `handoff` (`request_id` = run id, `from_agent`, `to_agent`, `step` = explainer lane; readonly; 30 min). Queries: `shops(openNow)`, agents online, handoffs by request. `arkiv/schema.md` rows. A renewal never pushes expiry past now + 15 min (read `$expiresAt` first) | T3 | M7b | Fri 02:30 (after M9 at S) | 45–60 min | A6–A8; D1 (conventions, index rule); D7 (W_DIRECTORY writes) |
| 2 | Agent hooks `presence(start, renew)` and `handoff(from, to, step)`, optional, no-op by default | T4 | M10 | Thu 23:30 | 20–30 min | A7, A8; D6 (names from the config) |
| 3 | Live hooks: presence and handoffs written by W_DIRECTORY, batched per phase, never blocking an agent step | Join | 1, 2, CP4 | Fri 04:40 | 30–45 min | D7; the route-nonce rule (M7 amendment §2) |
| 4 | Swarm probe: upload one file through the public gateway from the server and read it back | T3 | — | Fri 03:00 | 20–30 min | D1c (gateway first, ADR-0039) |
| 5 | Swarm entities: `menu` (`shop_key`, `shop_ens`, `version`, `swarm_ref` of 64 hex) per cast shop; `refund_evidence` (`order_id`, `shop_key`, `buyer_key`) with the photo uploaded encrypted, its 128-hex reference AES-wrapped and stored base64url; the writer refuses any 128-hex run; a regex test. main generates the wrapping key as a secret (env.example, Vercel) | T3; main (secret) | 4 passes | Fri 03:30 | 60–90 min | addendum C; D7 (`menu` by W_DIRECTORY); `refund_evidence` by W_SYNC (ADR-0039) |
| 6 | **Demo cast (D6):** add `cast.demo` to the config and select it; provision its ENS names (the M5 script), its policies (the setup script), the mirror's bootstrap and cast history, its `shop` rows; re-run B1, B2, B8, B9 | main (config); T2, T1, Join, T3 | the founder's names; CP4 | Fri 08:30 | 90–150 min | D6; E-14 wallet binding (risks below) |
| 7 | M16 checkout kit and demo store (pack milestone): the ~20-line snippet | T5 | M4 | Fri 04:40 | 60–90 min | D4 (Operate drop-in; no track wording in code) |
| 8 | Race mode: the result is each side's reads, ticking per call, plus bytes; no timer as the result; the table under the race without time columns | T5 | M9 | Fri 08:30 | 30 min | D2 (ADR-0042) |
| 9 | Open toggle: the merchant's "Open shop" tap also starts the `shop_open` heartbeat through a passcode-gated route under `/api/merchant`, renewed every 5 min while on; turning it off stops renewing | T5 | 1, M15 | Fri 09:00 | 30–45 min | A6; D7 |
| 10 | Mumbai map: our own static SVG of the neighbourhoods (no third-party tiles, `WEBSITE_SPEC.md` §1 rule 5); dots from `shops`; open shops and live agents glow, then fade when they lapse; every dot and receipt opens its explorer entity page; key queries as explorer "run this query" links (UNVERIFIED that the explorer offers them; fallback: a keyless one-command query in the README) | T5; T3 (link builder) | 1, 3, 9 | Fri 09:30 | 90–120 min | A9; D5 (synthetic dots labelled) |
| 11 | Vitalik's phone: request card with budget chip and deadline countdown; feed with ENS name, action, status chip and decline reason; spending pass (payee, cap, used and remaining, expiry; state Active, Used up, Expired, Paused or Revoked, from AgentPolicy and ENS); receipt links; refund request with photo (Requested; Accepted once the merchant's refund is sent; Refunded on `Refunded`); Pause toggle (M6's owner action on `graphpay.status`) | T5 | M15, M6, 5 | Fri 10:00 | 120 min | addendum D; D6 |
| 12 | Kesar Kingdom's phone: order pop-up (buyer agent's ENS name, Arkiv reputation, risk verdict); Dispatch; full or partial refund with the evidence photo; accountant CSV; in-page notifications | T5 | M15, 5 | Fri 11:00 | 90 min | addendum D; D4 |
| 13 | Explainer lanes Ask → Check → Check back → 402 quote → Pay, from the run log, the `handoff` and `quote` entities and the `pay` edge; every chip opens its explorer page | T5 | 3, M15 | Fri 11:30 | 60 min | addendum D; A8 |
| 14 | Friday acceptance checks D11–D14 (`pnpm acceptance --friday`), and B8, B9 for the demo cast | Join | 3, 5, 9–13 | Fri 12:30 | 45 min | acceptance additions |
| 15 | `arkiv/` files: `friction.md` (only gaps reproduced at the event, none of our own slow-query shapes; the unanswered booth questions as open questions); `how-you-use-arkiv.md` with the table filters → discovery, expiry → open, online and quotes, readonly → receipts that cannot be edited, owner → who may write; `reach.md`; `why-arkiv.md`; `swarm.md` (the seven items of addendum C) | T3 drafts friction, how-you-use and swarm; main finishes in M17 | 5; the measured items | T3 Fri 05:00; main 13:00 | 90 min | A11; D1d; D2 (reads) |
| 16 | M17: README, sponsor files, `AI_USAGE.md`, video, submission | main | M13, M15, M16 | Fri 13:00 | the afternoon | D2 (benchmark headline in reads); D4 (track wording only in sponsor files and the submission text); D9 (full AI disclosure, ADR-0028) |
| 17 | Stretch: ERC-8004 and ENSIP-25 | T2 | — | if time | — | ADR-0044 |
| 18 | **Publish the graph SDK** as `@graphpay/arkiv-graph` on npm (ADR-0057): generic, with developer-defined nodes, edges and totals; GraphPay's model stays in `packages/money-graph`. A README quickstart (install, define a graph, write, query, explain), an API reference, one small non-payments example (a leaderboard), tests (the boundary test included), and credit to the unscoped `arkiv-graph` project with how ours differs; links from `arkiv/reach.md` and `arkiv/how-you-use-arkiv.md`. Before publishing: re-check the name, `npm publish --dry-run`, a reviewer pass on the tarball (testnet values only, no secrets or keyed URLs), then the founder's npm login and go-ahead | T3 (package, docs, example, tests, the `how-you-use-arkiv.md` link); the Coordinator (name check, dry run, publish); Submission (the `reach.md` link) | CP4's acceptance run; M7b; the founder's npm login | Fri 06:00 | T3 60–90 min; publish 15 min | the Arkiv booth's request; reach (`planning/SPONSOR_CHECKLIST.md`) |

**Targets.** Items 1–9 before rehearsal 1 (12:00, CP5); items 10–15 before the video (18:00); item 18 after CP4's acceptance run and before the 18:00 freeze. Item 6 before rehearsal 1 if the founder's names arrive by 08:30, otherwise before the video.

**Risks, settled by main (22:30 IST):**
- **Demo cast (item 6).** If the demo cast keeps the test cast's labels, nothing changes. If its labels differ, its paying agents get fresh wallets, one role per run, because a wallet stays bound to its test-cast node (E-14; ADR-0030); the synthetic cities keep the test names, labelled synthetic. The founder's names are needed by 08:30 for rehearsal 1.
- **Swarm (items 4–5).** Public gateway only; never a postage batch bought with mainnet funds (hard limit: testnets only). If the gateway refuses, a Bee node on Swarm's testnet is the fallback, otherwise the bonus is dropped and `arkiv/swarm.md` says so (ADR-0039). `menu` by W_DIRECTORY, `refund_evidence` by W_SYNC; main generates the wrapping key (a new secret) on request.
- **W_DIRECTORY routes (items 3, 9).** Create-only or extend-only, the confirmed nonce, a retry on a clash; no local W_DIRECTORY script while the site is live (ADR-0033).
- **Booth questions.** None pending (ADR-0044).

## 5. Acceptance

`planning/ACCEPTANCE_TESTS.md` plus `docs/plan/ACCEPTANCE_ADDITIONS.md` (A7, B8, B9, D8–D10 tonight; D11–D14 on Friday; amended A5, B1–B4, C2, D6, D7, E2, F2). `pnpm acceptance` (M13) is the definition of done for the core.
