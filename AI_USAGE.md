# AI usage

How AI was used to build and run GraphPay at ETHGlobal Mumbai (5–7 November 2026). ETHGlobal asks every team to document this; at kickoff an organiser told the founder to "go all out" with AI (ADR-0028), and we disclose all of it here.

## 1. Summary

- **Claude Code (Anthropic) wrote the code:** every contract, package, script, test, website route and record in this repo, during the hackathon, in parallel sessions, one per track, mostly unattended; the one exception is the team's phone apps (below).
- **Claude helped with planning:** Claude on the web, the founder's "thinking partner", reads `docs/thinking-partner/` and writes the briefs that start each session ([`docs/thinking-partner/briefs/`](docs/thinking-partner/briefs/), older ones in [`docs/archive/thinking-partner-briefs/`](docs/archive/thinking-partner-briefs/)).
- **Kimi (Moonshot AI) makes the agents' judgment calls at runtime:** on the live site three agents make one Kimi K3.1 Pro call each per errand: the concierge chooses the shop (high effort), the analyst ranks the shops and the shop's risk agent judges the buyer (low effort). The other agents' routine steps run in code under their own names (ADR-0067, ADR-0078).
- **A Grok bot desk made the assets:** the agents' figurines, the dish, shop and moment photos, the b-roll and the story copy. Its prompts and deliveries are kept in [`assets/grok/`](assets/grok/) (ADR-0075).
- **All images are AI-generated.** The Grok desk's photos were generated with Grok Imagine; its agent figurines began as Imagine art and were then masked and retouched, and their SVG versions and short loops were authored as code (`assets/grok/part2/agents/provenance.json`; [`assets/grok/part2/README.md`](assets/grok/part2/README.md)). The fox mascot is an SVG written as code in the team's `frontend/`.
- **The team's phone apps** in `frontend/` were written by ajatshatru01 from their own account; the squash commit of #70 (`8abe39a`) lists GitHub Copilot as a co-author.
- **The humans:** the founder chose the product, wrote the briefs with the thinking partner, took every decision (each one an ADR in [`docs/decisions/`](docs/decisions/)), did everything that needs a person (logins, faucets and funding, account settings, organiser and sponsor questions), reviewed the milestones, rehearsed the demo, and records the video in their own voice.

## 2. Models and tools

| where | what |
|---|---|
| M0 session (foundation), Thu 21:35–23:58 IST | Claude Code 2.1.318, Opus 5.5 at max effort (the app's session metadata) |
| track sessions T1 Payments, T2 Identity, T3 Arkiv, T4 Agents, T5 Web and Join, from Fri 00:44 IST | started on Opus 5.5 at max effort; at 01:22 IST the Coordinator switched them to the plan (`docs/plan/sessions/README.md`), each from its next turn: Sonnet 5.5 at high for identity, agents and the website, Opus 5.5 at xhigh for payments, Arkiv and integration (to protect the weekly plan limit); at 03:37 IST one more step for the Opus sessions, to high; from about 04:20 IST every track session at high, on the founder's instruction (ADR-0062) |
| Coordinator (records, merges, story lock, top-ups), from Fri 00:46 IST | Opus 5.5 at max effort as started |
| T6 AgentPay SDK (`packages/agentpay`), from Fri 03:25 IST | Opus 5.5 at xhigh, as the founder started it; high from about 04:20 IST |
| Coordinator, a fresh session from Fri 11:00 IST (the takeover) | Opus 5.5 at max effort as started |
| Integration session (the team's phones on the live back end), from Fri 12:40 IST | Claude Code; its model is not recorded in the repo |
| Booth and Booth Sync sessions (the stage, the deck, the phones driving it), Fri 18:00–20:25 IST | Sonnet 5.5 at high (their briefs) |
| the night run, from Fri 23:02 IST: a night Coordinator and seven streams (W1 Identity, W2 City, W3 Payments, W4 Agents, W5 Ops, W6 SDK, W7 Submission) | every session on Opus 5.5 at max effort, with the usage guardrails off for the night (the founder's decision; [`docs/thinking-partner/briefs/2259-night-coordinator.md`](docs/thinking-partner/briefs/2259-night-coordinator.md)) |
| subagents | a **reviewer** (reads each branch's diff, blocking issues first; run on every contract, payment, signature, key, secret or spending-endpoint change) and a **verifier** (checks versions, addresses, chain ids and API names against primary sources), defined in [`.claude/agents/`](.claude/agents/) |
| planning | Claude on the web (the thinking partner), reading [`docs/thinking-partner/`](docs/thinking-partner/) |
| the product at runtime | the buyer agents (concierge, scout, analyst, payer) and the shop agents (storefront, risk, dispatch) on **Kimi** through Kimi's OpenAI-compatible API with the Vercel AI SDK: `kimi-k3.1-pro` for testing, `kimi-k3.1-pro-highspeed` for the video and the live site, from Fri 10:30 IST (ADR-0067, when the Anthropic API credit ran out). Effort: every role at high until Fri 23:40 IST, then the routine roles at low ([#162](https://github.com/Zugzwang-world/graphpay/pull/162)); since Sat 00:10 IST the routine steps run in code, and only the concierge (high), the analyst and the risk agent (low) call the model, once each ([#182](https://github.com/Zugzwang-world/graphpay/pull/182), ADR-0078). Before that, the test errands ran on `claude-opus-5-5` through the Anthropic API (ADR-0048); the Anthropic presets stay in the story config as fallbacks |
| the assets | the founder's **Grok desk**: six Grok bots (Place Scout, Writer, Pitch Researcher, Food Photographer, Agent Designer, Producer) working from one desk prompt, with images and videos from Grok Imagine |
| the team's phone apps (`frontend/`) | written by ajatshatru01; the #70 squash commit lists GitHub Copilot as a co-author |

## 3. What AI wrote, and what people did

All code, tests, contracts, scripts and docs in this repository were written by Claude Code **during the hackathon**, from the specs in `planning/` and the founder's briefs, except the team's two phone apps in `frontend/`, written by ajatshatru01 (#70, #132). Nothing was copied from the private pre-event lab (ADR-0002, ADR-0015). People reviewed the decisions and the demo; the reviewer subagent reviewed the code.

## 4. What the product's AI does at runtime

The buyer agents ask the Arkiv money graph through MCP tools before they pay, and pay over x402 on Whitechain; the shop agents check the buyer and dispatch. **The model proposes, code disposes** (ADR-0019): limits come from the human's words, rankings are recomputed in code, the payer is bound to the approved order, and the payee is read from ENS at pay time. Money and limits are never decided by a prompt.

Presets, not hard-coded models: `agentModels` in [`packages/config/story.json`](packages/config/story.json) (ADR-0048, ADR-0067). Every test run records its seconds and cost in the calibration table of [`docs/thinking-partner/OPEN.md`](docs/thinking-partner/OPEN.md): on mock services, a full errand on `kimi-k3.1-pro-highspeed` took 56 to 70 s and cost $0.11 to $0.14 (19 model calls, about 28,000 tokens); on the production site, 91 to 171 s (the 23:30 IST baseline: 91.4 s, 19 model calls, $0.1455). With the routine steps in code ([#182](https://github.com/Zugzwang-world/graphpay/pull/182)), an errand on the production site made 3 model calls: 55.5 s, 2,852 tokens and $0.0269, and paid 4.80 ([0x194b…f0e5](https://explorer.testnet.whitechain.io/tx/0x194b7bc4dac70c36e55ca140a7e3ea477853d8938f3885fb94d95bff9c32f0e5), settled Sat 7 Nov 00:25 IST; [#192](https://github.com/Zugzwang-world/graphpay/pull/192)). The models take about 13 s of it; the quote write to Arkiv and the settlement take about 13 s each.

## 5. Assets (the Grok desk)

- **What it made:** for the dosa story (ADR-0073), the agents' figurines (35 states, 28 extra thinking frames, 7 SVGs, 14 short loops), 24 photos (dishes, shop fronts, story moments, hero shots), five b-roll clips, the menus, the phone copy, the place research and seven research notes ([`assets/grok/part2/README.md`](assets/grok/part2/README.md)).
- **In use on the site:** the figurines and the photos, served from `apps/phones/static/grok/` (#140). Not yet used: the b-roll, the captions, the phone text and the research.
- **The proof:** the desk prompt ([`assets/grok/part1/prompts/desk-prompt.md`](assets/grok/part1/prompts/desk-prompt.md)), the founder's additions (`USER-ADDITIONS.md`), each part's checklist and manifest. `.vercelignore` keeps them out of deployments.
- **The persona:** Mr. Vitalik is a fictional persona made for this demo; no real person is depicted or endorses GraphPay. He appears only as his caped smiley agent (ADR-0072).

## 6. Prompts and planning artifacts

ETHGlobal's rules ask spec-driven teams to include every spec, prompt and planning artifact:
- the redacted prompt log of every Claude Code session: [`prompts/raw/`](prompts/raw/) (one file per session and day; secrets masked by the hook; ADR-0029);
- the milestone prompts the sessions ran: [`planning/PROMPTS/`](planning/PROMPTS/) plus the event amendments in [`docs/plan/amendments/`](docs/plan/amendments/) and the session run files in [`docs/plan/sessions/`](docs/plan/sessions/);
- the founder's briefs from the thinking partner: [`docs/thinking-partner/briefs/`](docs/thinking-partner/briefs/) and [`docs/archive/thinking-partner-briefs/`](docs/archive/thinking-partner-briefs/);
- the Grok desk's prompts: [`assets/grok/`](assets/grok/).

## 7. Human review

- **The founder's decisions,** each an ADR, among them: fresh event wallets (ADR-0024), one config file for every name and address (ADR-0030), the prize tracks (ADR-0032, ADR-0051), the defaults for every sponsor-booth question (ADR-0038 to ADR-0044), Kimi for the agents (ADR-0067), public access (ADR-0069), the fictional persona (ADR-0072), the dosa story (ADR-0073), the Grok desk (ADR-0075).
- **Reviewer passes** on every contract, payment, signature, key, secret or spending-endpoint change. Example: the first pass on the secret helpers (PR #3) found one blocking issue and eleven smaller ones; all were fixed before merge.
- **Acceptance checks** written from `planning/ACCEPTANCE_TESTS.md` and run by `pnpm acceptance` ([`ACCEPTANCE_REPORT.md`](ACCEPTANCE_REPORT.md)).
- **Rehearsals** of the full demo by the founder on Friday, with Claude Code watching the logs.

## 8. Pre-event work

See "How this was built" in [`README.md`](README.md), [`planning/README.md`](planning/README.md) and the disclosure table in [`planning/DISCLOSURE.md`](planning/DISCLOSURE.md). In short: research, throwaway prototypes in a private lab repo, and a knowledge pack (specs, facts, decisions, prompts, acceptance tests; no code) committed unchanged as `planning/`. Reused: two testnet wallets (FUNDER, the funding wallet, and OPERATOR, which owns `graphpay.eth`), two credentials (an Arkiv access key and an Anthropic API key) and the bare ENS name `graphpay.eth`. **Every other wallet was created at the event** ([`docs/technical/WALLETS.md`](docs/technical/WALLETS.md)).

## 9. Data

All demo data is synthetic and labelled as such: the cast, the shops and the synthetic city; the shops' tallies include labelled synthetic history. No personal data is collected. Every token is a testnet token (Whitechain Sepolia, Ethereum Sepolia, Arkiv Rabdi).
