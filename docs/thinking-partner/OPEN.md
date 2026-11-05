# OPEN

The founder's to-dos and open questions. Each item says what, where, why and what we recommend. "Founder now" is kept by the Coordinator; every session keeps its own section below.

## Founder now (Coordinator only)

1. **Plug in the charger and keep the lid open, now.** Why: the lid closed at 02:14 and the Mac slept until 03:01 ("Clamshell Sleep" in `pmset -g log`), so every session lost about 47 minutes; it also runs on battery (100%, discharging). A closed lid always sleeps, and an empty battery stops every session and the mirror. Recommendation: charger in, lid open, the app open, until Saturday's pitch.
2. **Plan usage: 76% at 03:36 IST, resets Fri 21:30 IST; extra usage is off.** At about 3.75 points an hour with seven sessions, the remaining 24% runs out around 10:00 IST. Done by the Coordinator: the track sessions run the planned models (01:22); fresh starts at milestone boundaries; at 03:37 the four Opus sessions (T1, T3, Join, T6) went from xhigh to high. T2 stays at high because M6 is the security-sensitive kill switch. That still may not last to 21:30. Still yours: (a) **extra usage with a cap** (Claude account settings → usage), the only change that rules out a full stop before the freeze; (b) the Coordinator at Opus 5.5 high in its model menu. Recommendation: turn on extra usage with a cap you accept. Otherwise, at the next shortfall the Coordinator pauses the sessions whose work is blocked, keeping T1, T2, T3 and Join running.
3. **Send ETHGlobal the written pre-event disclosure, if not sent yet.** Where: the Hacker Dashboard or an organiser; paste-ready text in `docs/plan/DISCLOSURE_MESSAGE.md`. Why: the rules require written disclosure of pre-existing work.
4. **Lock the final story config** (the story-config brief goes to the Coordinator). Why: the demo cast, products, prices, places and demo steps come only from it (ADR-0047), and the large city is seeded only from the locked story (ADR-0049). When: by **Fri 08:30 IST** for rehearsal 1; at the latest **Fri 13:00**, because the M seeding's latest safe start is 14:00.
5. **Optional, before Friday's publish: claim the npm organisation `graphpay`.** Where: npmjs.com, signed in with your account → Add Organization → `graphpay`, free plan (public packages). Why: only the scope's owner can publish `@graphpay/arkiv-graph` (ADR-0057); the scope is unclaimed at 01:05 IST and anyone could take it before Friday. Recommendation: do it when convenient; the Coordinator asks for the npm login itself when the package is ready (Friday item 18).

**Closed tonight:** the six track sessions and the Coordinator started (00:44–00:46 IST); the Ankr session's worktree and branch (removed at 23:09), the Vercel GitHub link (connected 22:42 IST; checks in `NOW.md`), the personal Ankr URL (stored, verified 22:51 IST: chain 1874, HTTPS), test USDT (150 arrived 21:54 IST; distributed, ADR-0045) and tGLM (FUNDER held 12.86; every planned wallet funded).

## Funding check (main, 22:43 IST; nothing new since the M0 funding)

FUNDER holds **2.6427 WBT, 0.2749 Sepolia ETH, 15.7583 tGLM** (after the founder's 15 tGLM at about 23:05) and **31.75 test USDT**. Every role in the plan is at its target (`docs/technical/WALLETS.md`).

| asset | shortfall | detail |
|---|---|---|
| **Sepolia ETH** | **none at today's gas** | base fee about 21 wei plus a 3 wei tip. OPERATOR's 0.095 ETH covers the namespace (about 80M gas) up to about 1.1 gwei; the owners' 0.002 each and ACCEPTANCE_PAYER's 0.001 cover their few transactions many times over. If gas goes above 0.5 gwei, main sends 0.1 ETH from FUNDER (which holds 0.27) to OPERATOR, so no faucet trip is needed |
| WBT | none | FACILITATOR 0.8 (about 300 payments before the 0.3 floor); FUNDER keeps 2.64 for top-ups and disposable agents (0.005 each) |
| tGLM | none | S city 0.9, mirror 2.0, recorder 0.2, directory 0.5; the M city's 8.5 waits in W_SEED_M_EVENT; FUNDER's 15.76 covers a second M seeding or a larger final city |
| test USDT | none | payers hold 102, the good shop's refund float 20, FUNDER 31.75 (disposable agents take 1 each) |

## Preset calibration (seconds and API cost per full errand; every test run adds a row)

Agents (T4) and Join add one row per full errand run, so the presets can be calibrated on Friday (ADR-0048). Cost comes from `apiCostUsd` and the prices in the config.

| time (IST) | run | preset | model, effort | seconds per errand | API cost per errand | notes |
|---|---|---|---|---|---|---|
| 22:54 | M0 probe (one-word reply, not an errand) | testing | `claude-opus-5-5`, xhigh | 2.2 | $0.0005 | accepted |
| 22:54 | M0 probe (one-word reply, not an errand) | video | `claude-opus-5-5`, xhigh | 1.6 | $0.0006 | accepted |
| 22:54 | M0 probe (one word, then three short turns) | live | `claude-haiku-5-5`, xhigh | 0.9; turns 0.9 / 0.9 / 1.9 | under $0.0002 in all | accepted; no empty reply, no `max_tokens`; once the same answer in two text blocks (read the final block) |
| 01:29 | T4 M10 live run 1 (mock services) | testing | `claude-opus-5-5`, xhigh | 94.1 | $0.2857 | paid the good shop; 19 calls, 47,456 tokens; risk reply over the strict schema |
| 01:31 | T4 M10 live run 2 | testing | `claude-opus-5-5`, xhigh | 73.2 | $0.3050 | paid the good shop; 20 calls, 51,639 tokens |
| 01:33 | T4 M10 live run 3 | testing | `claude-opus-5-5`, xhigh | 85.1 | $0.3049 | paid the good shop; 20 calls, 50,916 tokens |
| 01:34 | T4 M10 live run 4 | testing | `claude-opus-5-5`, xhigh | 139.5 | $0.2903 | paid the good shop; 19 calls, 46,989 tokens |
| 01:36 | T4 M10 live run 5 | testing | `claude-opus-5-5`, xhigh | 321.0 | $0.2965 | paid the good shop; 19 calls, 47,287 tokens; one slow model call (range 73 to 321 s) |

## Kickoff findings (main, read 21:44 IST, Thu 5 Nov)

| rule | what it says | source |
|---|---|---|
| deadline | "All projects must be submitted by Saturday, November 7th 2026 at 09:00 am IST." "Late submissions won't be accepted." Submit on the Hacker Dashboard (title, description, repo link); up to 3 partner prizes; a partner's several tracks count as one | https://ethglobal.com/events/mumbai/info/start, https://ethglobal.com/events/mumbai/info/details |
| AI use | "generally permitted"; "clearly document in your submission where and how AI tools were used"; AI should "assist your development process, not to create the entire project"; submissions relying entirely on AI "without meaningful contributions from team members" may lose partner and finalist eligibility | https://ethglobal.com/events/mumbai/info/details |
| spec-driven work | permitted; "all spec files, prompts, and planning artifacts" must be in the repo | same page |
| pre-event work | Classic track: work begins at kickoff; prior project-specific code, designs or assets are not allowed unless public libraries or starter kits; disclose pre-existing work "in writing to the ETHGlobal team"; "clearly distinguish between what's new and what's reused"; large single commits or missing histories may be disqualified | https://ethglobal.com/rules, details page |
| video | no text-to-speech or AI voiceover | details page |

**Organiser's answer on AI (founder, in chat, about 21:40 IST): "go all out, use AI the best you can".** Closed: we keep full AI disclosure (`AI_USAGE.md`, the README line, the submission text) and describe the founder's own part honestly, which also answers the "meaningful contributions" sentence above. ADR-0028.

**Open questions with defaults (no answer needed to proceed):**

| question | default | where it shows |
|---|---|---|
| Organiser questions 1, 3, 4 (pre-event specs and design; reused wallets, key and name; the docs-only first commit) | go on with full written disclosure | founder to-do 4 |
| Booth layout: the start page says partners judge at booths; the details page says a booth visit is optional | plan for both: a short booth demo per partner | M17 (Friday) |
| How many Whitechain prizes a project can win (no limit on the public pages) | enter Operate (ADR-0032); the product stays general | submission |

## Closed tonight (founder's defaults, about 21:42 IST; no booth answers are coming)

| question | decision | ADR |
|---|---|---|
| Arkiv: how the explorer tags a schema | our own naming convention: `project`, `type`, `schema_v` on every entity | ADR-0040 |
| Arkiv: stored vs indexed attributes | index only queried fields (the SDK supports it per column) | ADR-0041 |
| Arkiv: key quota, create-if-absent, `HandleInvalid` | no answer: watch the `ratelimit` header, rely on the write anchors, note the rest as friction | ADR-0044 |
| race mode | shows reads needed, not speed | ADR-0042 |
| Swarm: shared batch, public gateway | public gateway first; never a mainnet postage batch | ADR-0039 |
| ENS: ENSIP-31 key format | skip ENSIP-31; the Whitechain address record plus the text record `x-graphpay-accepts` | ADR-0038 |
| Whitechain: one prize or two | Operate, with a short code snippet as the drop-in; the product stays a general payments solution | ADR-0032 |
| Whitechain: is the Blockscout "verified" badge enough | treat it as enough; Standard JSON verification only if asked | ADR-0044 |
| ENS workshop items (Sepolia stability, `sim` wildcard, ERC-8004) | assume stable; the wildcard counts; ERC-8004 only if Friday has time | ADR-0044 |
| synthetic city | seeded straight into Arkiv, labelled synthetic, no real payments; its shops listed by the directory writer | ADR-0043 |
| Whitechain faucet amount (docs say 0.5 WBT a day) | the founder's 2 WBT a day is confirmed on-chain (FUNDER rose by 2 WBT at 22:12) | FACTS |

## foundation

- Nothing waiting on the founder beyond "Founder now".

## payments

- **For the Coordinator (CI):** only `ci` is a required check, so the `contracts` job (forge build, ABI check, fork tests) does not gate a merge. Recommendation: an aggregator job named `ci` that needs every job and fails unless all succeeded (`needs` alone passes on a skipped job). Until then T1 enables auto-merge on contract PRs only after `contracts` is green.
- Nothing for the founder from M1. Gas: a recorded failure is paid by the relayer; the facilitator refuses doomed payments before sending (M3), so FACILITATOR's 0.8 WBT covers hundreds of payments.

## identity
- **Nothing needs the founder.** Defaults taken: non-paying agents publish a zero cap in ENS (ADR-0059; recommendation: keep). `agent-endpoint[mcp]` points at `https://graphpay-event.vercel.app/api/mcp` (B8's MCP call is next, now that T3's M7b is merged).
- **For T1 (the gate):** `createEnsGate({ client, expectedEpoch, policyCapMicro, spentToday })` from `@graphpay/ens`; `ensCheck` for the risk agent. Policies: read node, epoch and wallet from `docs/sessions/identity/namespace.md`. A killed label is never provisioned again.
- **For the Coordinator (funding, only when a new disposable agent is needed):** `disposable-2` has a key (`DISPOSABLE_2`, generated, unfunded) and is not yet on Sepolia. Before provisioning it for real: 0.005 WBT and 1 test USDT to its address (`pnpm funding`). Recommendation: do it only when the kill demo needs a fresh label; `disposable-1` is the first kill target.
- **Decision for the founder (low stakes):** `ens_check` says ACTIVE for any status other than `paused`, as `planning/SPEC/AGENTS.md` §5 says, while the gate refuses anything but exactly `active`. Recommendation: keep the spec wording; the gate is the authority.

## arkiv

- **What:** the story's re-registered shop epoch. **Where:** `packages/config/story.json` `syntheticCity.reRegisteredShop.epoch` (2). **Why:** fresh ENSv2 names start at epoch 0 and a re-registration goes up by one (`planning/SPEC/ARKIV_GRAPH.md` §8), so 1 would match the spec; 2 copies the lab. The S city uses the story's value; nothing is wrong by identity either way. **Recommendation:** the Coordinator sets it to 1 in the final story before M.
- **What:** T3 added two blocks to the story config. **Where:** `story.json` `syntheticCity.generator` (generator inputs; the spec's values, the rest labelled as T3's choices) and `locations.neighbourhoods` (8 OpenStreetMap places with links). **Why:** ADR-0047 says every city parameter and place lives there. **Recommendation:** the Coordinator keeps them when the final story replaces the cast.
- **What:** the SDK's publish prep. **Where:** `packages/arkiv-graph`. **Why:** the engine is in now, but there is no README, API reference or example yet. **Recommendation:** Friday item 18, as ADR-0057 says.
- **What:** where race mode gets its truth. **Where:** `apps/web/app/api/race` (T5) calling `raceQuestion` from `@graphpay/money-graph`. **Why:** the "correct" badge needs the generator's truth, which comes from `@graphpay/city` (pure, a few milliseconds at S); the web app does not depend on it yet, and adding it changes the lockfile. **Recommendation:** T5 adds the workspace dependency in its next dependency PR (usage in `docs/sessions/arkiv/README.md`, "Race mode"); until then the race still shows reads and bytes, with `correct: null`.
- **What:** wiring the activity rows. **Where:** the Open toggle (T5's merchant route) calls `openShop` every few minutes while on and `closeShop` when off; the agent run route passes `hooks: activityHooks(directoryConn)` to `runErrand` (T4/T5); usage in `docs/sessions/arkiv/README.md` ("Activity"). **Why:** the rows exist only when something writes them; acceptance D11 reads them. **Recommendation:** the Coordinator asks T5 and T4 to wire them before CP6; both are additive and no-op until called.
- **What:** acceptance D7 (the benchmark at size M). **Where:** `bench/run.mjs` refuses M. **Why:** M waits for the founder's final story (ADR-0049). **Recommendation:** after the M seed, run `node bench/run.mjs --size M --end <date>` once the size guard is lifted; T3 does it.
- **What:** Graph Arkiv's bytes on window questions. **Where:** `packages/arkiv-graph/src/engine.mjs` reads every column (`select('*')`). **Why:** Q1's 90-day window adds up one day-tally row per active day (70 rows, about 107 KB, against plain's 1.3 KB); the reads are equal (3 against 3), and reads are the result (ADR-0042). **Recommendation:** leave it for the event; projections in the engine's reads would cut it, after the Friday items if time allows.
- **What:** two writer limits the reviewer noted (no action needed tonight). **Where:** `packages/arkiv-graph/src/writer.mjs`. **Why:** a foreign transaction of another shape at a pinned nonce stops the write loudly (`WriteUncertainError`) rather than being judged not ours; `writeShop` passes no ownership check, which is safe only while W_DIRECTORY scripts never run with the site live (ADR-0033). **Recommendation:** keep ADR-0033's rule; T3 revisits it after the Friday items if time allows.
- Closed: the explorer's entity page (`/entity/<key>`, verified by the website session; `arkiv/schema.md` updated); Join's `$attributes` finding (PR #25); the W_DIRECTORY top-up (it holds 0.50 tGLM); the i32 box (ADR-0058).

## agents

- Nothing waiting on the founder. Open for Join: the config's `whitechain.contracts` is empty, so the payer refuses every real 402 (`UNKNOWN_CONTRACT`) until T1's checkout address is in the config (recommendation: T1 adds it at M2; the payer reads every address in that section).

## integration

Updated 03:36 IST, Fri 6 Nov. Nothing for the founder now: the live mirror needs no login or funding. W_LEDGER holds 1.51 test GLM after the history (0.49 spent); one mirrored payment costs about 0.002 (the lab figure, `planning/SPEC/INTEGRATION_AND_MIRROR.md` §6).

- **Keep the lid open (watch).** What: the workers process runs on this Mac under `caffeinate -ims`. Where: this Mac. Why: caffeinate stops idle sleep but not a closed lid (it slept 02:14–03:01 IST). A closed lid stops the mirror; it resumes from Arkiv on wake by design (D15), but the website's scores lag until then. Recommendation: keep the lid open and the charger in until Saturday's submission.
- **Ask of T3: the reputation's synthetic label (open, sent to the Coordinator 03:29 IST).** What: `Reputation.synthetic` in `packages/money-graph/src/graphql.mjs` (line 323) comes from the node row only. The cast nodes are real, so the scores built from the labelled history say `synthetic: false`, although the stored tally rows say `true`. Why: synthetic data must always be labelled, on the site and in the agents' answers. Recommendation: `synthetic` is true when the node or any tally row the answer read is synthetic.
- **Network drops (watch).** What: this Mac's DNS stopped answering at 00:50 and 01:15 IST. Why: the mirror must keep up during the live runs. Recommendation: if it recurs, switch to a phone hotspot; the mirror catches up from its Arkiv checkpoint (2-minute freeze tested: 127 blocks caught up in under 5 s).
- **Closed 03:13 IST:** the checkout's address and deploy block (M2, PR 15) and the cast on ENS (M5, PR 18) arrived. Every name is epoch 0 and the 16 hand-off nodes match the cast (`docs/sessions/identity/namespace.md`).

## website

- **Founder to-dos:** none now. Friday: the final story config goes to the Coordinator, as before.
- **Ask of the Coordinator:** `DEMO_PASSCODE` (at least 24 characters) must be set in Vercel Production before any spending button works; without it every spending route answers 503 "spending is off". Why: the shell fails closed. Recommendation: set it with the other generated secrets (`pnpm secrets:gen`, then `pnpm secrets:vercel`).
- **Question (default taken):** the phone screens scale to fit the screen height (up to 390 × 844) rather than a fixed 844 px, so both phones fit one laptop screen. Recommendation: keep.
- **Ask of T3 (default taken):** the GraphQL `Edge` has no Arkiv entity key, no Arkiv transaction and no `payload` (item, order kind), so the merchant stream sends them as `null` and the accountant CSV has no "item", "kind (one-off, re-order, renewal)" or "Arkiv entity key" column; the settlement tx comes from the edge ref. Why: `WEBSITE_SPEC.md` §4 lists them. Recommendation: add `entityKey` and an `orderKind` to `Edge` if cheap; the CSV and pop-up pick them up with a one-line change. Not needed for the demo to work.
- **Note:** the CSV and the stream read the live dataset only; one query returns at most 100 edges each way (the engine's list cap), enough for the demo.

## agentpay

## records

- **npm login for the Friday publish (ADR-0059, item 18).** What: your npm login and go-ahead when the package is ready, after CP4 and T3's item 18. Where: a Terminal-panel tab the Coordinator opens; npm's sign-in and any one-time code happen there and Claude never sees them. Why: publishing needs your account, and a publish cannot be undone after 72 hours. Recommendation: nothing now; the Coordinator asks.
- **Prompt logs land in the main checkout** (P-records-1). What: the prompt-log hook writes every session's log to `~/graphpay/prompts/raw/`, not to the session's worktree, so track PRs do not carry their logs. Recommendation: the Coordinator changes the hook to write into the session's own checkout and sweeps the logs written so far into a records PR. No founder action.

## submission
