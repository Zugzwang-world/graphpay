# Session-start lines (wave 1 and wave 2)

How to start each parallel session (`planning/EVENT_RUNBOOK.md` §1b, with tonight's changes): in the Claude desktop app → Code, open a **new session on `~/graphpay` with the worktree option on**, set the model, and paste the line as the first message. No attachment is needed: every line points at files in the repo. Each session reads `CLAUDE.md` first, owns only its folders and its own sections of `docs/thinking-partner/`, and ships through PRs with auto-merge.

**Wave 1 starts together, as soon as M0 has merged:** T1, T2, T3, T4, T5. **Wave 2 (Join)** starts when M7a has merged. **Seeding (M8)** starts in T3 as soon as M7a has merged, **size S only** with the test story; size M waits until the founder locks the final story (ADR-0049). Every story value comes from `packages/config/story.json` (ADR-0047).

| session | model | worktree / branch prefix | when |
|---|---|---|---|
| T1 Payments | Opus 5.5, High | `wt-payments`, `pay/` | wave 1 |
| T2 Identity | Sonnet 5.5, High | `wt-identity`, `ens/` | wave 1 |
| T3 Arkiv | Opus 5.5, High | `wt-arkiv`, `arkiv/` | wave 1 |
| T4 Agents | Sonnet 5.5, High | `wt-agents`, `agents/` | wave 1 |
| T5 Web | Sonnet 5.5, High | `wt-web`, `web/` | wave 1 |
| Join | Opus 5.5, High | `wt-join`, `join/` | when M7a has merged |

**T1 Payments**
```text
You are T1 Payments (activity "payments", branches pay/*). Read CLAUDE.md and planning/README.md, then build M1 from planning/PROMPTS/01-contract.md, then M2, M3 and M4 (prompts 02 to 04), applying docs/plan/MASTER_PLAN.md, docs/plan/amendments/M5-ens.md §2 (the payee comes from ENS at pay time) and docs/plan/amendments/M7-arkiv.md §5 (quotes). Test USDT is already in the payer wallets and the stand-in token is retired (ADR-0054): M2 deploys only the USDT checkout, fork tests use the real token on a Whitechain fork, and the qualifying payment runs once as the acceptance agent in M3 part B. Prices, products, the renewal plan and every name come from packages/config/story.json; contract addresses go into packages/config/graphpay.config.json (whitechain.contracts). Server secrets go to Vercel as Sensitive values, never NEXT_PUBLIC_; server-side fetches use the production domain or relative paths, never VERCEL_URL. M3 part B and M4 need M5 and M6: check every 10 minutes whether they have merged (or wait for main's message) and do other work meanwhile. Go.
```

**T2 Identity**
```text
You are T2 Identity (activity "identity", branches ens/*). Read CLAUDE.md and planning/README.md, then build M5 from planning/PROMPTS/05-ens-namespace.md together with docs/plan/amendments/M5-ens.md (the amendment wins where they differ: ENSIP-26 records, the Whitechain address record, two key-limited setter grants per agent, x-graphpay-accepts instead of ENSIP-31), then M6 from planning/PROMPTS/06-ens-gate-kill-watcher.md. Every name comes from packages/config/story.json (the test story tonight) and every address and URL from packages/config/graphpay.config.json; the site and MCP URLs use the production domain https://graphpay-event.vercel.app. Sepolia gas is about 23 wei, so the real run is clear. Go.
```

**T3 Arkiv**
```text
You are T3 Arkiv (activity "arkiv", branches arkiv/*). Read CLAUDE.md and planning/README.md, then build M7a from planning/PROMPTS/07a-graph-model-writer.md together with docs/plan/amendments/M7-arkiv.md (the amendment wins where they differ: conventions, W_DIRECTORY, readonly edges, the shop directory, quotes, the box query, arkiv/schema.md), then M7b, M8 and M9 (prompts 07b, 08, 09). Code against the installed SDK types (docs/technical/FACTS.md, Arkiv SDK API notes). Every city parameter, name and location comes from packages/config/story.json. As soon as M7a has merged, seed size S only, with the test story, in the background; do not seed size M until main says the founder has locked the final story (ADR-0049). You also own apps/web/app/api/{graphql,explain,mcp}. Go.
```

**T4 Agents**
```text
You are T4 Agents (activity "agents", branches agents/*). Read CLAUDE.md and planning/README.md, then build M10 from planning/PROMPTS/10-agents.md, applying docs/plan/amendments/M5-ens.md §2 (resolve the payee from ENS before signing; PAYEE_MISMATCH, PAYEE_UNRESOLVED) and docs/plan/amendments/M7-arkiv.md §5 (refuse a missing or expired quote and re-quote once). The model and effort of every agent role come from the story config's presets through agentPreset(role) (ADR-0048; testing = claude-opus-5-5 at xhigh is active), never from code; replace the pack's AGENT_MODEL with AGENT_PRESET. Read only the final text block of each reply and handle an empty reply or a max_tokens stop. Every test run records the seconds and the API cost (apiCostUsd) of each full errand and adds a row to the preset calibration table in docs/thinking-partner/OPEN.md (agents section). Every agent and shop name, the request text and the order come from packages/config/story.json. Go.
```

**T5 Web**
```text
You are T5 Web (activity "website", branches web/*). Read CLAUDE.md and planning/README.md, then build the M15 shell from planning/PROMPTS/15-website.md in apps/web (a placeholder page exists; T1 owns apps/web/app/api/{shop,facilitator,recorder} and T3 owns apps/web/app/api/{graphql,explain,mcp}), wire it live as those routes land, then M16 from planning/PROMPTS/16-checkout-kit-store.md (the Operate drop-in is a short code snippet in the separate graphpay-store app, ADR-0032). Every name, product, price, location and demo step comes from packages/config/story.json; the demo link, both phone views and every QR code use the production domain https://graphpay-event.vercel.app, never VERCEL_URL; race mode shows reads, not speed (ADR-0042); wording per ADR-0052 ("decentralized, secure and verifiable", never "hidden"). The Friday UI items are in docs/plan/MASTER_PLAN.md §4. Go.
```

**Join** (when M7a has merged)
```text
You are Join (activity "integration", branches join/*). Read CLAUDE.md and planning/README.md, then build M11 from planning/PROMPTS/11-mirror.md (every edge is created readonly: docs/plan/amendments/M7-arkiv.md §4), then M12 and M13 from prompts 12 and 13 (acceptance is planning/ACCEPTANCE_TESTS.md plus docs/plan/ACCEPTANCE_ADDITIONS.md). Run the one workers process under caffeinate -ims -w <its pid> and show that it resumes from its last processed block after a sleep or a network drop (ADR-0056). Every e2e run records the seconds and the API cost of each full errand in the preset calibration table in docs/thinking-partner/OPEN.md. D7 stays blocked until the founder locks the story. Go.
```
