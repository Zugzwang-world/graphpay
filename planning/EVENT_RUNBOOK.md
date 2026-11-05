# EVENT RUNBOOK (Thu 5 Nov 21:00 IST → Sat 7 Nov 09:30 IST)

Who does what, hour by hour. **Claude** = the Claude Code sessions (unattended, bypass mode). **Founder** = only what software can't do (logins, faucets, wallets, account settings, recording, submitting). Times are central estimates from `BUILD_SEQUENCE.md`; the core (everything through acceptance) is expected done **Fri 04:40 IST (range 03:35–05:45)**.

## 0. Before 21:00 (Thursday afternoon)

| when | founder step | where | why |
|---|---|---|---|
| 16:00 | ENS workshop: ask about ENSv2 on Sepolia being stable through Saturday, ERC-8004/ENSIP-25 for the agents bonus, and whether a reserved wildcard (`sim`) counts as "own subname registry" | Room 1 (from research; check the schedule) | answers can change `SPEC/IDENTITY_ENS.md` §11 |
| 16:30 (Workshop Room 2, from research) | **Whitechain workshop: ask how to get test USDT** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (ask for 80 to FUNDER `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65`); ask whether one project can win Operate and Scale; whether Blockscout "verified" (not "fully verified") is enough | workshop | the qualifying payment needs it; nobody outside Whitechain can mint |
| any time | **Get at least 9 tGLM** to FUNDER `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65` on Rabdi (the Arkiv booth first; the faucet's amount per claim is unknown); ask the booth about the access key's monthly quota | the Arkiv booth, or https://hub.arkiv.network/faucet | the M city costs about 6.3–8.5 tGLM and the mirror about 2.0; FUNDER holds 2.86 after the sweep (`WALLETS.md` §3) |
| by 20:45 | Confirm `gh` (account `Zugzwang-world`) and `vercel` are logged in on this Mac; the lab's `.env` is at `~/graphpay-lab/.env` (M0 imports only FUNDER, OPERATOR, the Arkiv key and the Anthropic key from it); the empty folder `~/graphpay` exists (or Claude creates it); **laptop on power, sleep off, lid open, on the internet until Saturday's pitch** | Terminal | M0 needs both CLIs and those four values; the mirror runs as one process on this Mac from about 01:00 |
| by 20:45 | **Read the event rules** (`FACTS.md` §6; done once by the lab on 2026-11-05): the deadline is **Sat 7 Nov 09:00 IST, no late submissions**; AI is allowed if documented, but "AI should assist, not create the entire project"; on the Classic track prior project-specific code, designs or assets are barred and pre-existing work must be disclosed **in writing to ETHGlobal**. At the 21:00 kickoff, send the written disclosure and ask an organiser the four questions in `DISCLOSURE.md` | ETHGlobal Mumbai pages; an organiser; the Hacker Dashboard | these rules can change the plan; M0 stops if they forbid it |

## 0b. The exact 21:00 start

1. On the Mac, open the Claude desktop app → Code, and start a new session in the empty folder `~/graphpay` (the lab created it, empty, on 2026-11-05; create it again in Finder if it is gone). Model **Opus 5.5, High**, bypass mode.
2. Attach `~/Downloads/GraphPay-ThinkingPartner/handover/PROMPTS/00-foundation.md` and say: *"Build M0. The pack is in ~/Downloads/GraphPay-ThinkingPartner/handover. The lab's .env is at ~/graphpay-lab/.env. Go."*
3. Claude checks the event rules first, then creates `Zugzwang-world/graphpay`. At about 21:10 it asks for the Vercel link (the 21:10 row below).
4. From then on, the thinking partner reads `docs/thinking-partner/` in the public repo (`NOW.md` first). Each brief the founder attaches is saved in `docs/thinking-partner/briefs/`.

## 1. Thursday night

| time (IST) | Claude | founder | checkpoint |
|---|---|---|---|
| 21:00 | **Kickoff, before any code:** read the ETHGlobal Mumbai event page for the submission deadline and the AI and pre-work rules, record both in `docs/thinking-partner/OPEN.md`, and adjust the plan if the rules require anything new. Then start M0 in the main checkout (`PROMPTS/00-foundation.md`): create the empty **public** repo **`Zugzwang-world/graphpay`**; the **first content commit copies the pack into `planning/`**; `docs/thinking-partner/`; settings, CI, protection, secret tooling | Start the session in `~/graphpay`: attach `PROMPTS/00-foundation.md` and say "go". If Claude cannot read the rules, ask an organiser and tell Claude | — |
| 21:10 | Repo exists; asks for the Vercel link | **Only grant access, do not import:** vercel.com → Hrizzup → Settings → Git → Adjust GitHub App Permissions → add `Zugzwang-world/graphpay`. Say "done". (Claude creates the `graphpay-event` project itself; an import would make a second project named `graphpay`) | — |
| 21:15 | Imports **only** FUNDER, OPERATOR, the Arkiv access key and the Anthropic key (allowlist, names only); generates **fresh keys for every other role**, one role per run, addresses only (`WALLETS.md` §1); re-verifies every 9 pm fact | Say the path of the lab's `.env` if it is not the default | — |
| 21:40 | Funding from FUNDER on all three networks (WBT, Sepolia ETH, tGLM): dry run, then for real (`WALLETS.md` §3). The M city's tGLM waits for the founder's tGLM | — | — |
| 21:55 | **CP0**: A1–A6, facts re-verified, keys present (two imported, the rest fresh), wallets funded, Vercel linked, `planning/` and `docs/thinking-partner/` committed | Read `docs/thinking-partner/NOW.md` (one page) | **CP0** |
| 21:55 | Starts the five parallel sessions in their worktrees (§1b): T1 `PROMPTS/01`, T2 `05`, T3 `07a`, T4 `10`, T5 `15` | Only if Claude cannot start them: open each session from §1b by hand | — |
| 22:00–23:00 | M1 contract; M5 ENS namespace (fork rehearsal, then real); M7a model and writer; M10 agents on the mock model; M15 shell | none | — |
| 23:00 | | — | **CP1**: contract tests green; root and owners on Sepolia; one live Rabdi write; agents' mock tests green |
| 23:00–00:45 | M2 deploy, verify and set up (stand-in); M3 facilitator, shop and recorder; M6 gate and kill; M7b engine, GraphQL, MCP; M8 generator, then **seeding S, then M, in the background**; M10 live on Haiku | If tGLM for M has not arrived, decide: skip M (race at S only) or keep trying | — |
| 00:45 | | — | **CP2**: checkout verified; gate passes 13 agents; GraphQL on Rabdi S; agents 5 live runs; S seeded, M seeding |
| 00:45–01:35 | M3 part B (real-chain lifecycle and subscription, once M5 and M6 have merged); M11 mirror started as **the one workers process on this Mac** (first live Rabdi writes); M9 benchmark at S; M4 hosted on Vercel | Leave the Mac on and online | — |
| 01:15–03:15 | M12 `e2e:food`, fork first, then real networks | none | — |
| 03:15 | | — | **CP3**: the real-mode `e2e:food` run passes its assertions A–F (`SPEC/INTEGRATION_AND_MIRROR.md` §5) |

## 1b. The parallel sessions (started by main at 21:55; Join at CP1)

Main starts each one with the desktop app's start-session tool, in its own worktree, with the prompt file attached and the sentence below. If that tool is not available, the founder opens a new Code session per row (folder `~/graphpay`, the app's worktree option on), sets the model, attaches the file and says the sentence.

| session | worktree, branch prefix | model | attach (`planning/PROMPTS/`) | say | when |
|---|---|---|---|---|---|
| T1 Payments | `wt-payments`, `pay/*` | Opus 5.5 High | `01-contract.md` | "Build M1, then M2, M3 and M4 (prompts 02–04 in planning/PROMPTS). M3 part B and M4 need M5 and M6: check every 10 minutes whether they have merged (or wait for main's message) and do other work meanwhile. Go." | 21:55 |
| T2 Identity | `wt-identity`, `ens/*` | Sonnet 5.5 High | `05-ens-namespace.md` | "Build M5, then M6 (prompt 06). Go." | 21:55 |
| T3 Arkiv | `wt-arkiv`, `arkiv/*` | Opus 5.5 High | `07a-graph-model-writer.md` | "Build M7a, then M7b, M8 and M9 (prompts 07b, 08, 09). Go." | 21:55 |
| T4 Agents | `wt-agents`, `agents/*` | Sonnet 5.5 High | `10-agents.md` | "Build M10. Go." | 21:55 |
| T5 Web | `wt-web`, `web/*` | Sonnet 5.5 High | `15-website.md` | "Build the M15 shell now and wire it live as the routes land; then M16 (prompt 16). Go." | 21:55 |
| Join | `wt-join`, `join/*` | Opus 5.5 High | `11-mirror.md` | "Build M11, then M12 and M13 (prompts 12, 13). Go." | CP1 (M7a merged) |

Every session reads `planning/README.md` and its prompt's inputs first, and ends each step with the thinking-partner update in the same PR. Main keeps the top summaries of `docs/thinking-partner/NOW.md` and `OPEN.md` and runs M14 every 2 hours.

## 2. Friday early morning (founder asleep from about 01:00 to 08:30)

| time (IST) | Claude | checkpoint |
|---|---|---|
| 03:15–04:30 | M13 `pnpm acceptance` on the real networks; `ACCEPTANCE_REPORT.md` | — |
| 04:30–04:40 | M14 records and relay (`docs/thinking-partner/relays/records.md`, copied to `~/Downloads/GraphPay-ThinkingPartner/relays/`) | **CP4**: core done |
| **05:30** | **Daily caps reset (00:00 UTC).** `payer.vitalik`'s 6.00 is fresh again | — |
| 04:40–08:30 | M15 website wired to the live routes; M16 checkout kit and demo store; M9 at M once seeded; fix any `fail` in the report | — |

## 3. Friday day

| time (IST) | Claude | founder | checkpoint |
|---|---|---|---|
| 08:30 | Morning relay: what passed, what is blocked, what needs the founder (`docs/thinking-partner/NOW.md` and `OPEN.md`) | Read `NOW.md` and do the `OPEN.md` to-dos | — |
| 09:00–12:00 | Website polish; race mode at the largest seeded city; the demo store's ~20 lines | **If test USDT arrived:** send it to FUNDER and say "done" → Claude runs `usdt-ready --go --yes` once: the single 4.80 payment as `acceptance.vitalik` is the evidence for C7 and E3 | — |
| 12:00–13:00 | | **Rehearsal 1** on the website (both phones), Claude watching the logs | **CP5** |
| 13:00–18:00 | M17: sponsor files, README, `AI_USAGE.md`, `WHITECHAIN_FEEDBACK.md`, Arkiv files, video shot list; fixes from rehearsal 1 | Review the README and the sponsor files | — |
| 18:00–20:00 | Provision a fresh disposable agent; check balances and floors | **Record the video** from the website (`WEBSITE_SPEC.md` §11) **in your own voice: the rules forbid text-to-speech or an AI voiceover** | — |
| 20:00–21:00 | Final relay; submission checklist | **Rehearsal 2** | **CP6** |
| **by 21:30 Friday** (hard deadline **Sat 7 Nov 09:00 IST**, no late submissions) | Submission text, links and the AI and pre-work disclosure ready | **Submit** on the Hacker Dashboard (title, description, repo link; up to 3 partner prizes) | — |

## 4. Saturday

| time (IST) | who | what |
|---|---|---|
| 00:00–07:00 | — | Freeze. Only fixes for real breakages, each through a PR with green CI |
| 05:30 | — | Daily caps reset again |
| 07:00–08:30 | Claude | Pre-flight (the submission is already in; it closes at 09:00): health of every route; heads of all three chains; the workers process alive and mirror lag 0; top up FACILITATOR to 0.8 WBT from FUNDER, then check it is at least 0.8 (floor 0.3); `payer.vitalik` unspent since 05:30; a fresh disposable label with its own wallet; warm Rabdi connections; `pnpm acceptance --only C6,D5,F2` |
| 08:30–09:15 | founder | Dry run of the pitch with the site open; passcode typed in |
| 09:30 | founder | Presentation |

## 5. Fallbacks

| problem | fallback |
|---|---|
| No test USDT by Friday evening | Demo on the stand-in checkout, labelled "stand-in (not USDT)" everywhere; C7 and E3 `blocked: no test USDT supply`; keep asking Whitechain; the USDT checkout deploy and first payment stay one command |
| ENS addresses changed at 9 pm | Stop T2, update the config from the deployments page, re-run the verifier, regenerate ABIs from Sourcify; other tracks continue |
| `graphpay.eth` lost or not bare | Register a new bare name under the same OPERATOR (commit, 60 s, register; MockUSDC is free) and change `GRAPHPAY_ROOT_ENS` (and the root constant the code derives from it) |
| Sepolia RPC slow or lagging | Keep the 20 s gate cache; read 6 names at a time; set `SEPOLIA_RPC_URL` to a keyed provider if the founder has one |
| Rabdi slow or refusing | The mirror queues and catches up from its checkpoint; the website shows the lag chip; race mode shows the committed event results with their time instead of a live race |
| The workers process stopped (Mac slept, crash) | Restart it (`pnpm workers`); it resumes from its checkpoint. Never start a second one while the first may be alive: it checks the heartbeat row and refuses. After any doubt, run the reconcile command |
| Not enough tGLM for M | Seed S only; race at S and say plainly that S is level with the fastest plain code and the gap grows with size (quote the event's own measurements only) |
| A kill label already used | Provision `disposable-<n+1>` (3 Sepolia transactions, about 1 minute) |
| `payer.vitalik`'s cap spent | Wait for 05:30 IST; rehearse as `rehearsal.vitalik` (30.00/day) meanwhile; never raise the stage cap on the live contract |
| Relayer nonce clash on Vercel | Retry (no double payment is possible); make sure no local script uses the hosted relayer key |
| Relayer near the floor | Top up FACILITATOR from FUNDER (dry run, then `--execute --real`) |
| Haiku's structured output fails | Tune the prompts' JSON tail; if still failing, switch `AGENT_MODEL` to a larger Claude model and record it in `AI_USAGE.md` |
| Vercel GitHub link fails | Deploy from the CLI (`vercel deploy --prod` from `origin/main` only) and post preview URLs in PRs |
| A session falls behind | Its milestone moves to Friday morning; the core order is fixed: M11 → M12 → M13 |

## 6. Founder actions in one list

1. Before 21:00: workshops (test USDT, two prizes, the verified badge); **at least 9 tGLM** to FUNDER on Rabdi; CLIs logged in; read the rules (deadline Sat 09:00 IST; AI and pre-work rules) and ask an organiser the `DISCLOSURE.md` questions; the Mac on power with sleep off.
2. 21:10: grant the Vercel GitHub app access to `graphpay` (grant only, no import).
3. When asked: the path to the lab's `.env` (default `~/graphpay-lab/.env`); only four named values are copied from it.
4. Whenever it arrives: test USDT to FUNDER, then "done".
5. Friday: rehearsals at 12:00 and 20:00, review the README and sponsor files, record the video in your own voice, **submit by 21:30** (closes Sat 09:00 IST); the written pre-event disclosure went to ETHGlobal at Thursday's kickoff.
6. Saturday 08:30: the pitch dry run with the passcode typed in.
