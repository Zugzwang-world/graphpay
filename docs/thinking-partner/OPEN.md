# OPEN

The founder's to-dos and open questions. Each item says what, where, why and what we recommend. "Founder now" is kept by main; every session keeps its own section below.

## Founder now (main only)

1. **Grant Vercel's GitHub app access to the repo.** Where: vercel.com → team Hrizzup → Settings → Git → Adjust GitHub App Permissions → add `Zugzwang-world/graphpay`. **Grant only, do not import a project** (an import would create a second project; Claude creates `graphpay-event` itself). Why: preview deployments per PR. Then say "done".
2. **Your personal Ankr testnet URL.** Where: a hidden prompt Claude opens in the app's Terminal panel (keystrokes are not shown, and the value goes only to the git-ignored `.env`). Why: a keyed RPC gives the facilitator higher limits; the public URLs stay as fallbacks. Recommendation: paste it when the prompt appears.
3. **Send ETHGlobal the written pre-event disclosure** (the README line and the table in `planning/DISCLOSURE.md`). Where: the Hacker Dashboard or an organiser. Why: the rules require written disclosure of pre-existing work to the ETHGlobal team. Ask organiser questions 1, 3 and 4 there (question 2, AI, is answered below).
4. **At least 9 tGLM to FUNDER** `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65` on Arkiv Rabdi. Where: https://hub.arkiv.network/faucet. Why: the M city (about 8.5) and the mirror's second 0.5. By 23:30 IST, when M seeding should start; otherwise we race at size S only.
5. **Test USDT** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: at least 5, ideally 80, to FUNDER on Whitechain Sepolia. Where: Whitechain's team (Discord or booth). Why: the qualifying payment. Until then the demo runs on a labelled stand-in token.
6. **Laptop on power, sleep off, online until Saturday's pitch.** Why: the mirror runs as one process on this Mac from about 01:00.

## Kickoff findings (main, read 21:44 IST, Thu 5 Nov)

| rule | what it says | source |
|---|---|---|
| deadline | "All projects must be submitted by Saturday, November 7th 2026 at 09:00 am IST." "Late submissions won't be accepted." Submit on the Hacker Dashboard (title, description, repo link); up to 3 partner prizes; a partner's several tracks count as one | https://ethglobal.com/events/mumbai/info/start, https://ethglobal.com/events/mumbai/info/details |
| AI use | "generally permitted"; "clearly document in your submission where and how AI tools were used"; AI should "assist your development process, not to create the entire project"; submissions relying entirely on AI "without meaningful contributions from team members" may lose partner and finalist eligibility | https://ethglobal.com/events/mumbai/info/details |
| spec-driven work | permitted; "all spec files, prompts, and planning artifacts" must be in the repo | same page |
| pre-event work | Classic track: work begins at kickoff; prior project-specific code, designs or assets are not allowed unless public libraries or starter kits; disclose pre-existing work "in writing to the ETHGlobal team"; "clearly distinguish between what's new and what's reused"; large single commits or missing histories may be disqualified | https://ethglobal.com/rules, details page |
| video | no text-to-speech or AI voiceover | details page |

**Organiser's answer on AI (founder, in chat, about 21:40 IST): "go all out, use AI the best you can".** Closed: we keep full AI disclosure (`AI_USAGE.md`, the README line, the submission text) and describe the founder's own part honestly, which also answers the "meaningful contributions" sentence above. ADR-0028.

## Closed tonight (founder's defaults, about 21:42 IST; no booth answers are coming)

| question | decision | ADR |
|---|---|---|
| Arkiv: how the explorer tags a schema | our own naming convention: `project`, `type`, `schema_v` on every entity | ADR-0040 |
| Arkiv: stored vs indexed attributes | index only queried fields if the SDK allows it, otherwise index all | ADR-0041 |
| Arkiv: key quota, create-if-absent, `HandleInvalid` | no answer: watch the `ratelimit` header, rely on the write anchors, note the rest as friction | ADR-0044 |
| race mode | shows reads needed, not speed | ADR-0042 |
| Swarm: shared batch, public gateway | try the public gateway first | ADR-0039 |
| ENS: ENSIP-31 key format | skip ENSIP-31; the Whitechain address record plus a text record | ADR-0038 |
| Whitechain: one prize or two | Operate, with a short code snippet as the drop-in; the product stays a general payments solution | ADR-0032 |
| Whitechain: is the Blockscout "verified" badge enough | treat it as enough; Standard JSON verification only if asked | ADR-0044 |
| ENS workshop items (Sepolia stability, `sim` wildcard, ERC-8004) | assume stable; the wildcard counts; ERC-8004 only if Friday has time | ADR-0044 |
| synthetic city | seeded straight into Arkiv, labelled synthetic, no real payments | ADR-0043 |

## foundation

- Nothing waiting on the founder beyond "Founder now" items 1 and 2.

## payments

## identity

## arkiv

## agents

## integration

## website

## records

## submission
