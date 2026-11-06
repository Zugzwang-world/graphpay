# Coordinator handover: for a fresh Coordinator session

Written Fri 6 Nov, 22:49 IST, by the outgoing Coordinator (`local_3b893898-fa05-4265-93ee-e9090aeee49f`, "GraphPay Coordinator takeover", Opus 5.5). Its context is nearly full. Read this file first.

## 1. Your role

You are the GraphPay Coordinator, activity `records`.
- **You own:**
  - the records: NOW and OPEN top sections, LOG roll-ups, `relays/records.md`, TRACKER;
  - merges;
  - `packages/config/` (the story and the infrastructure config);
  - root config, `.github/`, `scripts/`;
  - funding and top-ups;
  - the Vercel keys, by helper only;
  - the session roster.
- **You build no track's features.** Route bugs to their owners.
- **Fixed deadlines:** the submission is **Sat 7 Nov 09:00 IST**, and the presentation is **09:30 IST**. Nothing else has a target time (ADR-0066).

**Read, in this order:**
1. `CLAUDE.md`;
2. this file;
3. `docs/thinking-partner/NOW.md`, `TRACKER.md` and `OPEN.md`;
4. `docs/plan/sessions/coordinator.md` (the role);
5. `docs/sessions/records/resume.md` (history; its 21:45 section);
6. the briefs from `2225-full-sync.md` on.

## 2. Start

1. `request_keep_awake` (until: session_idle).
2. A session-only cron tick on `4,14,24,34,44,54 * * * *`. Its prompt: time; keep-awake; usage; PRs; the live site check `GET /api/state/customer`; the W_DIRECTORY fallback; the sessions; NOW by small docs PRs.
3. The outgoing Coordinator deletes its own tick when you confirm you have started. Only one Coordinator ticks.
4. Run the first tick. Tell the founder you have taken over.

## 3. Rules that bite

- **CLAUDE.md's hard limits:**
  - testnets only (chain 1874, 11155111, 7794095);
  - never print or commit secrets;
  - only resources named graphpay*;
  - no off-chain database.
- **Usage:**
  - the guardrails are off tonight (ADR-0062, amendment 3);
  - every session runs on Opus 5.5 at max;
  - the window resets Fri 13 Nov;
  - still report usage in NOW.
- **PRs:**
  - squash only, auto-merge, never on red;
  - the reviewer agent on any contract, payment, key or spending change;
  - write PR bodies to a file;
  - merge a stalled green PR by hand;
  - resolve a docs conflict in an idle session's PR in a separate worktree, keeping every line;
  - a team PR (ajatshatru01) is reviewed by T5, then squash-merged credited to its author.
- **Messages:**
  - the app allows 10 cross-session messages until the founder types again;
  - a message he sends mid-turn does not reset the count;
  - never message a session while it is clearing;
  - take the time from `date`.
- **Secrets:**
  - only the helpers: `pnpm -s secrets:set`, `secrets:vercel`, `wallet:gen`, `funding` (dry run first, then `--execute --real`; never pipe it into `head`);
  - record every transfer in `docs/technical/WALLETS.md` §2b.
- **Never remove `ARKIV_ACCESS_KEY` from Vercel.** `LIVE_RUNNER_NEEDS` (`integration/src/live-runner.mjs:29`) requires it; without it every errand stops.
- **Builds:** `apps/web/vercel.json` `ignoreCommand` builds a commit only if it touches apps/web, packages, integration, frontend, apps/phones, the root manifests, the lockfile, .node-version, tsconfig.base.json or .vercelignore.

## 4. The live system (22:49 IST)

- **Power:** the Mac was on battery at 22:49 IST (78%, about 5 h 20 min). The founder is asked to plug it in. Check `pmset -g batt` on every tick.

- **The site:** https://graphpay-event.vercel.app is the stage.
  - The deck sits in the middle, and the team's two live phones drive it (ADR-0074). One screen.
  - Public access: no passcode, no private links, no ceilings for visitors (ADR-0069 and its amendment). The keys between our servers stay.
- **The story:** masala dosa near BKC (ADR-0073), on screen only. The ENS labels and the Arkiv category are still the test cast's.
- **Proven live today:**
  - the errand: 4.80 paid, for example [0x89ac…b990](https://explorer.testnet.whitechain.io/tx/0x89acd9521341763f6f6a37893eec921c9548d7a0b5984597d56088a5f5d5b990);
  - the Open switch;
  - the refund request and the merchant refund (#129);
  - the re-order (#131);
  - pause and resume.
- **The payer:** `payer.vitalik.graphpay.eth`, with a pass of 100 test USDT a day, on-chain and in ENS (#107, ADR-0071). The pass resets at 05:30 IST.
  - It has been **PAUSED since 21:24 IST**: someone pressed the public Pause.
  - The founder was asked whether to resume it and make Pause/Resume presenter-only (recommended). He has not answered yet.
- **Arkiv:**
  - The access key's **quota is exhausted** (since about 21:36 IST).
  - #148 falls back to the keyless endpoint, so reads work.
  - The founder is asked for a quota reset or a new key. A new key needs: `secrets:set`, then `secrets:vercel`, then a redeploy, then Join restarts the mirror.
- **The mirror:** `pnpm workers` on this Mac, from Join's worktree, pid 34797, under `caffeinate -w`. It was restarted on #148 at 21:58 IST and has caught up.
  - Proving that it writes a new event waits for the payer to be ACTIVE.
- **The SDKs:** both are 0.1.1 on npm (arkiv-graph, agentpay). They freeze from submission until judging ends.
- **Acceptance** (read-only at 22:40 IST): 35 pass, 8 fail, 1 blocked, 4 not run.
  - B1, B2: the pause, and a test agent's spent cap.
  - C3, D4, E1, D8: evidence from before the story swap.
  - C7, E3: a runner bug, Join's to fix.
  - The run used a guard that blocks every send. B8 is left out, because its script POSTs to `/api/mcp`.
- **The deadline window:** no errand can buy between about 23:14 IST and midnight (the 11:59 pm deadline, and 45 minutes to deliver).
- **The mirror** stalled from 22:02 until at least 22:31 IST, then recovered by 22:39. Ask Join and T3 why.
- **Wallets** (22:27 IST), in test USDT:
  - FUNDER 54.14 (also 2.59 WBT, 0.257 Sepolia ETH, 15.08 tGLM);
  - PAYER 58.2;
  - SHOP_KESAR 118.81;
  - VITALIK 10, with 0.02 Sepolia ETH;
  - REHEARSAL_PAYER 40;
  - ACCEPTANCE_PAYER 20.
  - FACILITATOR holds 0.774 WBT (floor 0.3).
  - DISPOSABLE_2 and DISPOSABLE_3 are unfunded.
  - W_SEED_M_EVENT holds 8.5 tGLM for the big city.
- **Vercel Production** (18 names): KIMI_API_KEY, PAYER, FACILITATOR, RENEWER, SHOP_KESAR, SHOP_JAMUN, SHOP_SYRUP, VITALIK, W_DIRECTORY and W_SYNC private keys, WHITECHAIN_RPC_URL, ARKIV_ACCESS_KEY, ANTHROPIC_API_KEY, CRON_SECRET, DEMO_PASSCODE, FACILITATOR_AUTH_TOKEN, RECORDER_TOKEN, ALLOW_REAL_NETWORK.

## 5. Sessions (all idle at 22:40 IST)

| session | id | next |
|---|---|---|
| T1 Payments | `local_16ccf7cf-ca9a-497a-bfce-d8bb3415cd92` | caps, subscriptions, decline and the 0.80 re-order SKU, when asked |
| T2 Identity | `local_8ec48e25-b5c3-442f-b70d-a258266170ba` | ENS names for the dosa shops, and the kill, when asked |
| T3 Arkiv | `local_949a2091-02b7-4f63-9c71-efebf8fe215a` | the history move and the category; the big city at M; the W_DIRECTORY split only on a trigger |
| T4 Agents | `local_0a83861b-1aaa-424f-abb4-cd36290807d2` | Kimi tuning, when asked |
| T5 Web | `local_e34793ca-bfc1-4489-8340-07a90fc9b703` | reviewer of team PRs; the read-limit ceiling (ADR-0069 amendment) |
| Join | `local_e67c2aa7-36f4-43ff-bee9-578ad5a1d519` | prove the mirror's new write once the payer is ACTIVE; owns the mirror |
| T6 AgentPay | `local_be1a1d1c-53bd-4570-b242-09a41617ce01` | feedback only; the version is frozen |
| Integration | `local_7268b4b1-7f52-4fe6-9652-329b9a9c97de` | phases 1 to 4 done; idle |
| Booth | `local_ffc009c6-4d90-4c88-a063-8453a1e2f37b` | done (#135 to #141) |
| Booth Sync | `local_f5b061ec-e506-4ee5-a6e7-143e068a9851` | done (#142 to #145) |
| Submission | none | **start it now** (`docs/plan/sessions/submission.md`) |

Retired: the first Coordinator (`local_d1ca442e-…`) and M0 (`local_3320a408-…`). The outgoing Coordinator retires once you confirm.

## 6. Open items, by owner

The full table is in `docs/thinking-partner/TRACKER.md`; the founder's list is in OPEN "Founder now".

- **Founder:**
  - plug in the charger (the Mac is on battery);
  - start the Submission session;
  - the payer: resume it, and decide whether Pause/Resume become presenter-only;
  - the Arkiv key's quota;
  - the demo scope: on-chain ENS names for the dosa shops, the big city, caps, the kill, subscriptions;
  - the video, in his own voice;
  - the Kimi balance;
  - the ETHGlobal disclosure, and team members registered;
  - charger in, lid open.
- **T2 and T3:** move the dosa shops on chain (names, history, category), if the founder wants it.
- **T1:** the 0.80 coffee re-order (`reorder.sku`), and subscribe/cancel/run-next if wanted.
- **T5:** the ceiling decision; check the deck's other slides.
- **Join:** the mirror write proof.
- **Submission:** the README (its persona note is in), AI_USAGE (Kimi and the Grok desk are in), the sponsor files, the form.
- **The Coordinator:**
  - top up PAYER before the pitch if it falls under about 25 test USDT (FUNDER has 54.14);
  - fund a disposable wallet if the kill is demoed;
  - keep NOW within the hour.

## 7. Next steps, in order

1. Take over: steps 1 to 4 of §2.
2. Get the founder's answers: the payer, the Submission session, the Arkiv key. Act on each at once.
3. Once the payer is ACTIVE, ask Join for the mirror proof errand.
4. Keep the stage demo-ready through the night: the payer ACTIVE, the shop open, `/api/state/customer` answering 200.
5. Before 07:00 IST, run the pre-flight (`planning/EVENT_RUNBOOK.md` §4) and a read-only acceptance run.
6. Freeze the SDK versions at submission.
