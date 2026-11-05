# OPEN

The founder's to-dos and open questions. Each item says what, where, why and what we recommend. "Founder now" is kept by main; every session keeps its own section below.

## Founder now (main only)

1. **Start the wave-1 sessions (T1–T5).** Where: Claude desktop app → Code → new session on `~/graphpay` with the worktree option on; the model and the line to paste for each are in `docs/plan/prompts/session-lines.md`. Why: the tracks run in parallel; nothing else blocks them. Recommendation: start all five together now. Join comes later, when M7a has merged (main will say).
2. **Grant Vercel's GitHub app access to the repo.** Where: vercel.com → team Hrizzup → Settings → Git → Adjust GitHub App Permissions → add `Zugzwang-world/graphpay`. **Grant only, do not import a project** (that would create a second project; `graphpay-event` already exists). Why: preview deployments per PR (CLI deploys work meanwhile). Then say "done".
3. **Your personal Ankr testnet URL.** Where: the hidden prompt open in the app's Terminal panel (tab "Ankr URL (hidden)"); paste, then Enter. Why: higher RPC limits; the public URLs stay as fallbacks, so nothing waits on it. Recommendation: paste it when convenient.
4. **Send ETHGlobal the written pre-event disclosure** (the README line and the table in `planning/DISCLOSURE.md`). Where: the Hacker Dashboard or an organiser. Why: the rules require written disclosure of pre-existing work to the ETHGlobal team. If you can, ask organiser questions 1, 3 and 4 at the same time (question 2, AI, is answered).
5. **Laptop on power, sleep off, online until Saturday's pitch.** Why: the mirror runs as one process on this Mac from about 01:00.

Closed tonight: **test USDT** arrived (150 at 21:54 IST; distributed, ADR-0045) and the **tGLM** arrived (FUNDER held 12.86; the M city and the mirror are funded).

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

- Nothing waiting on the founder beyond "Founder now" items 2 and 3.

## payments

## identity

## arkiv

## agents

## integration

## website

## records

## submission
