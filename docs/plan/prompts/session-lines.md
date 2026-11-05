# Session-start lines (an unattended night)

How to start each session (`planning/EVENT_RUNBOOK.md` §1b, with tonight's changes). In the Claude desktop app → Code, open a **new session on `~/graphpay` with the worktree option on**, set the model and effort, and paste the line as the first message. No attachment is needed: every line points at files in the repo.

**All six start together, as soon as main says M0 has merged:** T1, T2, T3, T4, T5 and Join. Join starts with the others and waits for M7a by polling. **Seeding (M8)** starts inside T3 as soon as M7a has merged: **size S only**, with the test story. Size M waits until the founder locks the final story (ADR-0049); its latest safe start is Fri 14:00 IST.

| session | model | effort (recommended; you pick it in the app) | worktree / branch prefix | why that effort |
|---|---|---|---|---|
| T1 Payments | Opus 5.5 | **xhigh** | `wt-payments`, `pay/` | money, contracts and signatures; long unattended work |
| T2 Identity | Sonnet 5.5 | high | `wt-identity`, `ens/` | well-specified provisioning, mostly real-chain waiting |
| T3 Arkiv | Opus 5.5 | **xhigh** | `wt-arkiv`, `arkiv/` | the critical path (writer, engine, seeding) |
| T4 Agents | Sonnet 5.5 | high | `wt-agents`, `agents/` | guards in code are specified; mock tests first |
| T5 Web | Sonnet 5.5 | high | `wt-web`, `web/` | screens to a written spec; wiring as routes land |
| Join | Opus 5.5 | **xhigh** | `wt-join`, `join/` | the critical path on real networks (mirror, e2e, acceptance) |

## Rules every line carries (the night runs without the founder)

1. **Keep going.** When a task is done and merged, start your next unblocked task: your prompt's next milestone, then your Friday items in `docs/plan/MASTER_PLAN.md` §4. Never end a turn to wait.
2. **Never wait on the founder.** Write the question in your own section of `docs/thinking-partner/OPEN.md` (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and continue. Only logins, funding, secrets and irreversible steps wait for him. Main reads OPEN.md every 10 minutes.
3. **Dependencies by polling.** Check `gh pr list --state merged --limit 30` every 10 minutes for the PRs you wait on, and do independent work meanwhile. Main also messages you when one lands.
4. **Small PRs, auto-merge, docs promptly.** Your thinking-partner update rides in each step's PR. Docs-only commits do not trigger a Vercel build.
5. **Secrets.** Run the helpers as `pnpm -s secrets:…`, because pnpm echoes its arguments. Never print or paste a secret. Ask main for top-ups.

## The lines

**T1 Payments**
```text
You are T1 Payments (activity "payments", branches pay/*). Follow docs/plan/prompts/session-lines.md "Rules every line carries": keep going, never wait on the founder (questions go to your OPEN.md section with a safe default), poll merged PRs for dependencies. Read CLAUDE.md and planning/README.md, then build M1 from planning/PROMPTS/01-contract.md, then M2, M3 and M4 (prompts 02 to 04), applying docs/plan/MASTER_PLAN.md, docs/plan/amendments/M5-ens.md §2 (the payee comes from ENS at pay time) and docs/plan/amendments/M7-arkiv.md §5 (quotes). Test USDT is already in the payer wallets and the stand-in token is retired (ADR-0054): M2 deploys only the USDT checkout, fork tests use the real token on a Whitechain fork, and the qualifying payment runs once as the acceptance agent in M3 part B. Prices, products, the renewal plan and every name come from packages/config/story.json; contract addresses go into packages/config/graphpay.config.json (whitechain.contracts). Live events poll over HTTPS (ADR-0055). Server secrets go to Vercel as Sensitive values, never NEXT_PUBLIC_; server-side fetches use the production domain or relative paths, never VERCEL_URL. M3 part B and M4 need M5 and M6: poll for them and do other work meanwhile. Go.
```

**T2 Identity**
```text
You are T2 Identity (activity "identity", branches ens/*). Follow docs/plan/prompts/session-lines.md "Rules every line carries": keep going, never wait on the founder (questions go to your OPEN.md section with a safe default), poll merged PRs for dependencies. Read CLAUDE.md and planning/README.md, then build M5 from planning/PROMPTS/05-ens-namespace.md together with docs/plan/amendments/M5-ens.md (the amendment wins where they differ: ENSIP-26 records, the Whitechain address record, two key-limited setter grants per agent, x-graphpay-accepts instead of ENSIP-31), then M6 from planning/PROMPTS/06-ens-gate-kill-watcher.md, then your Friday items. Every name comes from packages/config/story.json (the test story tonight) and every address and URL from packages/config/graphpay.config.json; the site and MCP URLs use https://graphpay-event.vercel.app. Sepolia gas is about 23 wei, so the real run is clear. Go.
```

**T3 Arkiv**
```text
You are T3 Arkiv (activity "arkiv", branches arkiv/*). Follow docs/plan/prompts/session-lines.md "Rules every line carries": keep going, never wait on the founder (questions go to your OPEN.md section with a safe default), poll merged PRs for dependencies. Read CLAUDE.md and planning/README.md, then build M7a from planning/PROMPTS/07a-graph-model-writer.md together with docs/plan/amendments/M7-arkiv.md (the amendment wins where they differ: conventions, W_DIRECTORY, readonly edges, the shop directory, quotes, the box query, arkiv/schema.md), then M7b, M8 and M9 (prompts 07b, 08, 09), then your Friday items. Code against the installed SDK types (docs/technical/FACTS.md, Arkiv SDK API notes). Every city parameter, name and location comes from packages/config/story.json. As soon as M7a has merged, seed size S only, with the test story, in the background; never seed size M until main says the founder has locked the final story (ADR-0049). You also own apps/web/app/api/{graphql,explain,mcp}. Go.
```

**T4 Agents**
```text
You are T4 Agents (activity "agents", branches agents/*). Follow docs/plan/prompts/session-lines.md "Rules every line carries": keep going, never wait on the founder (questions go to your OPEN.md section with a safe default), poll merged PRs for dependencies. Read CLAUDE.md and planning/README.md, then build M10 from planning/PROMPTS/10-agents.md, applying docs/plan/amendments/M5-ens.md §2 (resolve the payee from ENS before signing; PAYEE_MISMATCH, PAYEE_UNRESOLVED) and docs/plan/amendments/M7-arkiv.md §5 (refuse a missing or expired quote and re-quote once), then your Friday items. The model and effort of every agent role come from the story config's presets through agentPreset(role) (ADR-0048; testing = claude-opus-5-5 at xhigh is active), never from code; AGENT_PRESET replaces the pack's AGENT_MODEL. Read only the final text block of each reply and handle an empty reply or a max_tokens stop. Every test run records the seconds and the API cost (apiCostUsd) of each full errand as a row in the preset calibration table of docs/thinking-partner/OPEN.md. Every agent and shop name, the request text and the order come from packages/config/story.json. Go.
```

**T5 Web**
```text
You are T5 Web (activity "website", branches web/*). Follow docs/plan/prompts/session-lines.md "Rules every line carries": keep going, never wait on the founder (questions go to your OPEN.md section with a safe default), poll merged PRs for dependencies. Read CLAUDE.md and planning/README.md, then build the M15 shell from planning/PROMPTS/15-website.md in apps/web (a placeholder page exists; T1 owns apps/web/app/api/{shop,facilitator,recorder} and T3 owns apps/web/app/api/{graphql,explain,mcp}), wire it live as those routes land, then M16 from planning/PROMPTS/16-checkout-kit-store.md (the Operate drop-in is a short code snippet in the separate graphpay-store app, ADR-0032), then your Friday items. Every name, product, price, location and demo step comes from packages/config/story.json; the demo link, both phone views and every QR code use https://graphpay-event.vercel.app, never VERCEL_URL; live events poll over HTTPS (ADR-0055); race mode shows reads, not speed (ADR-0042); wording per ADR-0052. Go.
```

**Join**
```text
You are Join (activity "integration", branches join/*). Follow docs/plan/prompts/session-lines.md "Rules every line carries": keep going, never wait on the founder (questions go to your OPEN.md section with a safe default), poll merged PRs for dependencies. Read CLAUDE.md and planning/README.md, then build M11 from planning/PROMPTS/11-mirror.md, then M12 and M13 (prompts 12 and 13; acceptance is planning/ACCEPTANCE_TESTS.md plus docs/plan/ACCEPTANCE_ADDITIONS.md). M11 needs M7a (the writer), M1 (the ABI and events) and M5 (the cast on ENS): until they merge, poll every 10 minutes and build the parts that do not need them (the event decoding from planning/SPEC/PAYMENTS_WHITECHAIN.md, the bootstrap, the checkpoint and heartbeat logic, tests on fakes). Every edge is created readonly (docs/plan/amendments/M7-arkiv.md §4). Run the one workers process under caffeinate -ims -w <its pid> and prove it resumes from its last processed block after a network drop (D15, ADR-0056). Every e2e run records the seconds and the API cost of each full errand in the preset calibration table of docs/thinking-partner/OPEN.md (E8). D7 stays blocked until the founder locks the story. Go.
```

## Overnight coordination (main)

Main stays open as the coordinator. A scheduled check runs every 10 minutes while main's session is idle; it lives only in main's session, so keep it open and the Mac awake. Each check:

- watches PRs: it merges a green PR whose auto-merge stalled, and resolves conflicts in the shared docs and the lockfile;
- relays dependencies: it tells T1 when M5 and M6 have merged, and the Arkiv session when the story is locked;
- reads every session's OPEN.md section and answers what it can;
- refreshes the top of `NOW.md` and `OPEN.md` through small docs PRs.

M14 (records and relay) runs every 2 hours: about 00:45, 02:45, 04:45, 06:45. If main stops, the sessions keep working on their own and their PRs still auto-merge.

## When the founder is needed

| when (IST) | what | why |
|---|---|---|
| now (about 23:30) | start the six sessions; send the disclosure (`docs/plan/DISCLOSURE_MESSAGE.md`) | the night's work; the rules |
| before you sleep (about 01:00) | nothing to do: leave the Mac on power, lid open, app open | the mirror and the sessions run overnight |
| Fri 05:30 | nothing (the daily caps reset) | — |
| Fri 08:30 | read `NOW.md` and `OPEN.md`; lock the final story (the story-config brief) | rehearsal 1 with the demo cast; the large city |
| Fri 12:00 | rehearsal 1 | CP5 |
| Fri 13:00 at the latest | the story locked, if it was not at 08:30 | the M seeding must start by 14:00 |
| Fri 18:00 onward | freeze; the video in your own voice; rehearsal 2; submit by Sat 08:00 | ADR-0053 |
| only if it happens | a login expires (`gh`, `vercel`) or a second M seeding needs tGLM | the only things a session cannot do |
