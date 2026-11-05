# BUILD SEQUENCE

Milestones from an empty public repo (Thu 9 pm IST) to the presentation (Sat 9:30 am IST). Each milestone has a prompt in `PROMPTS/NN-<slug>.md`. Times come from the lab's real session timings (git commit and merge times, session logs); every lab time **includes its reviewer passes**, and so do these estimates.

## 1. Changes against the brief's milestone list (from the lab's evidence)

1. **M7 is split** into M7a (model, writer, emulator: about 1 h) and M7b (engine, GraphQL, explain, MCP). Seeding (M8) needs only M7a, so the long M seed starts about an hour earlier and stays off the critical path.
2. **The website, the checkout kit with the demo store, and the submission files are milestones** (M15, M16, M17). The lab never built a website, and Saturday needs one; the Whitechain Operate prize needs a separate demo store.
3. **M12 budgets a real-network mode that the lab never ran** (the lab's one-command run used a Whitechain fork and the Arkiv emulator), and **M11 is the first time the mirror writes to real Rabdi**.
4. **M2 grants a second relayer** (renewals); **M0 imports only FUNDER and OPERATOR and generates fresh keys for every other role**, funded from FUNDER (`DECISIONS.md` E-1, E-7).
5. **M0 starts with a rules check** (deadline, AI and pre-work rules), **commits the pack as `planning/` first**, and creates **`docs/thinking-partner/`**, which every milestone updates in its own PR (`DECISIONS.md` F-1…F-5).

## 2. Milestones

| M | name | depends on | worktree / branch | estimate | lab evidence for the estimate | model |
|---|---|---|---|---|---|---|
| M0 | Foundation: repo, pnpm workspace, CI (`ci`, `contracts`), secret scan, branch protection, auto-merge, guardrails, prompt log, secret setter, git-based env loader, import of FUNDER and OPERATOR, fresh role keys, funding, `planning/`, `docs/thinking-partner/`, Vercel project, re-verify flagged facts | — | main checkout, `m0/*` | 45–60 min | Step 1 replay: 37 min unattended to the first relay; secret-helper review rounds took another ~80 min (avoidable with the spec) | Opus High |
| M1 | Contract + Foundry tests on a Whitechain fork (roles split, stand-in token, renewal-id fix) | M0 | `wt-payments` | 60–75 min | contract with 2 reviewer passes ≈ 25 min of commits; role split + stand-in + parity suite with 2 passes ≈ 50 min | Opus High |
| M2 | Deploy and verify on Whitechain Sepolia; roles; stand-in token; setup; the USDT dry run (the lifecycle and the USDT payment move to M3 part B) | M1 | `wt-payments` | 30–45 min | deploy, verify, setup and real lifecycle ≈ 37 min | Opus High |
| M3 | Facilitator + shop 402 API (drain protection, passcode, bearer token, start-up checks), ENS gate as an injected dependency; recorder routes; **part B:** real-chain lifecycle, subscription and the USDT payment | M1 (M7a for the recorder; M6 for the real gate; part B: M2, M5, M6) | `wt-payments` | 60–75 min | facilitator + shop + fork e2e ≈ 20 min; real-gate wiring + token by env + start-up checks ≈ 32 min; 2 passes each | Opus High |
| M4 | Hosted on Vercel; recorder and renewal cron; one public payment; 401 checks | M2, M3, M6 | `wt-payments` | 45–60 min | hosted demo with 2 reviewer passes ≈ 47 min | Opus High |
| M5 | ENS namespace under `graphpay.eth` on real Sepolia: root, owners, 13 cast agents plus the rehearsal and acceptance agents, resolvers, scoped roles, payment preference, wildcard, a disposable agent (each paying agent with its own wallet) | M0 | `wt-identity` | 75–90 min | fork build ≈ 70 min; first real run (32 tx) ≈ 45 min; rest of the cast (44 tx) ≈ 20 min | Sonnet High |
| M6 | ENS gate, kill switch (pause and unregister), watcher and the policy mirror | M5 (M2 for `setPolicy` on the real checkout) | `wt-identity` | 45–60 min | gate built with the fork session; facilitator wiring 30 min; text-record mirroring never built (+20 min) | Sonnet High (reviewer pass mandatory) |
| M7a | Graph Arkiv model, ADR-0023 writer, ArkivSim with the 256 KiB limit; one live Rabdi write | M0 | `wt-arkiv` | 60 min | E's emulator + model ≈ 30 min; G's nonce-pinned writer with 12 tests (part of a 1.5 h session) | Opus High |
| M7b | Engine, GraphQL, explain trace, reputation, MCP tools | M7a | `wt-arkiv` | 60–90 min | A's core 30 min; E's engine/GraphQL/MCP ≈ 35 min; F's merge 25 min | Opus High |
| M8 | City generator; seed S and M on Rabdi in the background | M7a | `wt-arkiv` (seeding runs on the founder's Mac) | 45 min + seeding (S 15–20 min, M 100–130 min) | city ≈ 15 min; seeding S 15 min, M 99.6 min (pre-merge model; expect +30%) | Opus High |
| M9 | Live benchmark at S (and M when seeded) | M7b, M8 | `wt-arkiv` | 45–60 min | live benchmark ≈ 50 min | Opus High |
| M10 | Agent teams with guards in code; mock model; live Haiku; model switch | M0 | `wt-agents` | 60–75 min | team on mock tools ≈ 35 min with 2 passes; live fix 15 min | Sonnet High |
| M11 | Mirror as one long-lived workers process: contract events and recorder edges → Arkiv (first live Rabdi run of the write path) | M1 (ABI, events), M7a, M5 (cast) | `wt-join` | 60–75 min | mirror ≈ 35 min with 7 blocking review items; the Rabdi path was never run live (+30 min) | Opus High |
| M12 | `pnpm e2e:food`: fork first, then real networks | M3, M6, M7b, M10, M11 | `wt-join` | 90–120 min | e2e ≈ 70 min with 2 passes; real-network mode never built (+30–45 min) | Opus High |
| M13 | `pnpm acceptance` on real networks, incl. the qualifying USDT payment | M4, M9, M12 | `wt-join` | 60–90 min | new | Opus High |
| M14 | Records and relay | M13 | main | 20–30 min | lab relays took 5–15 min each | Opus High |
| M15 | Website: customer, merchant, explainer, race mode | M0 (interfaces); wired after M4, M7b, M10 | `wt-web` | 180–240 min | not built in the lab | Sonnet High |
| M16 | Checkout kit + separate demo store `graphpay-store` | M4 | `wt-web` | 60–90 min | not built in the lab | Sonnet High |
| M17 | Sponsor files, README, AI_USAGE, video, submission | M13, M15, M16 | main | Friday | — | Sonnet High |

## 3. Dependency graph

```text
M0 ─┬─ M1 ── M2 ──────────────┬── M4 ── M16
    │   └─── M3 ──────────────┤
    ├─ M5 ── M6 ──────────────┤
    ├─ M7a ┬─ M7b ────────────┤
    │      ├─ M8 (seeding, background) ── M9 ─┐
    │      └─ M11 (needs M1, M5) ─────┐      │
    ├─ M10 ───────────────────────────┴─ M12 ─┴─ M13 ── M14 ── M17
    └─ M15 (interfaces first; wired live after M4, M7b, M10) ──────┘
```

## 4. Critical path

**Path:** M0 → M7a → M7b → M11 → M12 → M13 → M14. (M11 can start as soon as M7a and M1 are done, so the binding chain is M0 → M7a + M7b → M12 at central times; the payments chain M0 → M1 → M2 → M3 is about 30 minutes shorter.)

| scenario | M0 | M7 (a+b) | M11 | M12 | M13 | M14 | total | core done (from Thu 21:00) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| fast | 45 | 120 | 60 | 90 | 60 | 20 | 6.6 h | **Fri 03:35** |
| central | 52 | 135 | 67 | 105 | 75 | 25 | 7.7 h | **Fri 04:40** |
| slow | 60 | 150 | 75 | 120 | 90 | 30 | 8.75 h | **Fri 05:45** |

Other chains at central times: payments M0 → M1 → M2 → M3 ≈ 3.7 h (ready 00:45) and M4 ≈ 4.6 h (01:35); identity M0 → M5 → M6 ≈ 3.1 h (00:05); agents M0 → M10 ≈ 2 h (23:00); seeding M ends ≈ 01:40 if funded by 23:30.

**Verdict on the thinking partner's estimate (core plus acceptance in 7–9 h, about 4–6 am Friday): confirmed, slightly tighter.** Central 7.7 h (04:40), range 6.6–8.75 h (03:35–05:45).

**Assumptions:**
1. Lab timings are first builds from research with two reviewer passes per payment, trust or write-path PR; the pack removes most discovery, but every reviewer pass stays (each found real bugs).
2. Real networks from the start: Sepolia about 12 s per transaction, Rabdi 5–8 s per write, Whitechain 1 s. No ENS commit wait (the root is already registered).
3. Five parallel sessions (T1–T5) do not block each other; one early PR owns the lockfile.
4. Founder steps are done on time: Vercel GitHub app access during M0; at least 9 tGLM to FUNDER by 23:30 (the M city and the mirror's second 0.5); test USDT whenever it can be had.
5. Excluded from the core: the website, the demo store, sponsor files, the video (Friday), and the qualifying USDT payment, which depends on external supply.
6. The daily cap: one UTC day runs from Thursday 05:30 to Friday 05:30 IST, and a 6.00 agent is spent by one errand plus a re-order. So the M3 part B lifecycle and every rehearsal pay as `rehearsal.vitalik` (30.00/day), acceptance as `acceptance.vitalik` (6.00/day), and `payer.vitalik` only in the counting M12 run and on stage (`DECISIONS.md` E-15). Each paying agent has its own wallet (E-14).

## 5. Worktree and session plan

| session | worktree / branch prefix | milestones | owns these folders (event repo) |
|---|---|---|---|
| main | main checkout | M0, M14, M17 | root config, `docs/`, `.github/`, `.claude/`; the top summaries of `docs/thinking-partner/NOW.md` and `OPEN.md`, and `LOG.md` roll-ups |
| T1 Payments | `wt-payments`, `pay/*` | M1–M4 | `packages/contracts`, `packages/facilitator`, `packages/shop`, `apps/web/app/api/{shop,facilitator,recorder}`, `scripts/whitechain` |
| T2 Identity | `wt-identity`, `ens/*` | M5, M6 | `packages/ens`, `scripts/ens` |
| T3 Arkiv | `wt-arkiv`, `arkiv/*` | M7a, M7b, M8, M9 | `packages/arkiv-graph`, `packages/city`, `bench/` |
| T4 Agents | `wt-agents`, `agents/*` | M10 | `packages/agents` |
| T5 Web | `wt-web`, `web/*` | M15, M16 | `apps/web` (pages), `packages/checkout-kit`, `apps/store` |
| Join | `wt-join`, `join/*` (started by main when M7a has merged, at CP1) | M11, M12, M13 | `packages/mirror` (the workers process, which also hosts T2's watcher), `integration/`, `acceptance/` |

Rules: one worktree and branch per session; a session edits only its folders plus its own `docs/sessions/<id>/` and **its own sections of `docs/thinking-partner/`** (`NOW.md`, `LOG.md`, `OPEN.md` under its activity heading, and `relays/<activity>.md`); after the last push it watches its PR until merged; small PRs with auto-merge; merge `origin/main` into a pushed branch instead of rebasing (force-push is denied); worktrees have no `.env` and use the git-based loader; a fresh worktree installs the contract libraries before `forge build`. Cross-session interfaces are the SPEC files; if one changes, the owning session updates its SPEC note in `docs/` and messages the others.

## 6. Checkpoints

| checkpoint | target time (central) | pass when |
|---|---|---|
| CP0 | 21:55 | A1–A6 pass; flagged facts re-verified and recorded; FUNDER and OPERATOR imported and every other key fresh (names only); wallets funded from FUNDER; `planning/` and `docs/thinking-partner/` committed; Vercel project linked |
| CP1 | 23:00 | contract tests green on the fork; root and owners exist on real Sepolia; one live Rabdi write through the ADR-0023 writer; agents pass mock tests |
| CP2 | 00:45 | checkout verified on Blockscout; gate passes all 13 agents; GraphQL answers on Rabdi S; agents pass 5 live runs; S seeded, M seeding |
| CP3 | 03:15 | `e2e:food` real mode passes A–F (`SPEC/INTEGRATION_AND_MIRROR.md` §5; F is the kill) |
| CP4 | 04:40 | `ACCEPTANCE_REPORT.md` committed; relay written |
| CP5 | Fri 13:00 | website live on real data; demo store live; first full rehearsal recorded |
| CP6 | Fri 21:00 | sponsor files, README, AI_USAGE, video done; submission checklist green |
