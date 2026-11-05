# DISCLOSURE

We say plainly what happened before the event and what happens at it. Nothing in this pack hides or denies the lab.

## The README line (put it near the top of the event repo's README)

> **How this was built:** before the hackathon we did research and built throwaway prototypes in a separate private lab repo to test our assumptions (for example how Arkiv handles repeated writes, and how ENSv2 behaves when an agent's name is revoked). We brought only knowledge to the event: research notes, written specs, verified facts, decisions, prompts and acceptance tests, all in `planning/`. **All code in this repo was written during the hackathon**, by us with Claude Code; see `AI_USAGE.md`. Pre-event items we reused, all disclosed here: two testnet wallets (a funding wallet holding faucet tokens, and the wallet that owns the ENS name), two credentials (an Arkiv access key and an Anthropic API key; no code), and the bare ENS name `graphpay.eth`, registered on Sepolia before the event with no records or subnames. Every other wallet was created at the event.

## The `planning/` line (first line of `planning/README.md`)

> Prepared before the event: research, specs, decisions, prompts and acceptance tests. All code in this repository was written during the hackathon.

The pack's own `README.md` already starts with this line, so copying the pack unchanged into `planning/` puts it in place. The README line above points to `planning/`.

## Check the event's rules first (read on 2026-11-05; re-check at kickoff)

ETHGlobal's pages (`FACTS.md` §6) say, in short: on the Classic track all work begins after the start, and prior project-specific code, designs or assets are barred unless they are public libraries or starter kits; pre-existing work must be **disclosed in writing to the ETHGlobal team**; version control during the event is required and "large single commits or missing histories may be disqualified"; AI is "generally permitted" if documented, but should assist, "not to create the entire project"; spec-driven work is allowed if "all spec files, prompts, and planning artifacts" are in the repo; the video must not use an AI voiceover.

What we do about it:
- `planning/` holds every spec, prompt and planning artifact, as the rules ask; it is one labelled docs-only commit, and all code arrives afterwards in small reviewed PRs.
- The founder sends ETHGlobal the written disclosure (the README line and the table below) at kickoff, through the Hacker Dashboard or an organiser.
- `AI_USAGE.md` says honestly how the work was split: the founder chose the product, wrote the briefs and design, took every decision and reviewed every milestone; Claude Code wrote the code from those specs.
- If the rules require more, change the root `README.md`, `AI_USAGE.md` and the submission text. **Never edit `planning/`**: it stays the exact pre-event copy.
- If an organiser says the written website design is a barred design, M15 builds the behaviour from `WEBSITE_SPEC.md` §1–§8 and designs the visuals at the event (not from §9). Stop the build only if an organiser bars the pack itself or AI-written code.

**Questions for an organiser at kickoff** (record the answers in `docs/thinking-partner/OPEN.md`):
1. Our specs, prompts and a written website design were prepared before the event; no code. Is that allowed on the Classic track if it is committed and disclosed, or does the written design count as a barred "design"?
2. All code is written at the event by Claude Code under the founder's direction, from those specs. Does that meet "AI should assist, not create the entire project"?
3. We reuse two testnet wallets, an Arkiv access key and a bare ENS name registered before the event. Is a written disclosure enough?
4. Is the first commit (the planning pack, docs only) a problem under the commit-history rule?

## What existed before the event (and what we did with it)

| item | before the event | at the event |
|---|---|---|
| research | three research reports on Arkiv, Whitechain + x402, and ENSv2 | read as background |
| lab prototypes | a private lab repo with throwaway prototypes and experiments on testnets (contracts, a facilitator, an ENS identity layer, an Arkiv graph layer, agents, an integration run, a benchmark) | **not copied**; not merged; not referenced by path from the event code |
| knowledge pack | specs (behaviour, interface signatures, schemas, event definitions), verified facts, decisions, acceptance tests, prompts, pitfalls (this folder) | committed to `planning/` as the first content commit, as reference; no code |
| testnet wallets | lab role wallets generated and funded with test WBT, Sepolia ETH and tGLM; on 2026-11-05 their spare test tokens were swept into the funding wallet | **two reused**: FUNDER (the funding wallet) and OPERATOR (owns `graphpay.eth`), keys imported into `.env` by script, never committed. **Every other wallet is new**, generated at the event and funded from FUNDER |
| `graphpay.eth` | registered bare on Ethereum Sepolia on 2026-11-04 (no resolver, records or subname registry) | resolver, registries, owners and agents created at the event |
| lab contracts and Arkiv data | a stand-in token and a checkout on Whitechain Sepolia; two synthetic cities on Arkiv Rabdi (expire about 18 Nov) | **not used**; the event deploys and seeds its own |
| the pitch deck brief | a written brief | the deck and the website are built at the event |

## AI_USAGE.md (outline for the event repo)

1. **Summary.** Built with Claude Code (Anthropic) running unattended in parallel sessions; the founder directed by voice and did logins, wallets and recording. Planning help from Claude on the web.
2. **Models and tools.** Claude Code version; the models used per session (for example Opus for payments, Arkiv and integration; Sonnet for identity, agents and the website); the agents' runtime model (`claude-haiku-5-5` via the Anthropic API), and Grok if used.
3. **What AI wrote.** All code, tests, contracts, scripts and docs in this repo were written by Claude Code during the hackathon from the specs in `planning/` and the founder's instructions; humans reviewed decisions and the demo.
4. **What the product's AI does at runtime.** The buyer and shop agents (AI SDK, MCP tools over Graph Arkiv); the rule "the model proposes, code disposes": money and limits are decided by code, never by a prompt.
5. **Prompts.** The prompt log (`prompts/raw/`, redacted) and the milestone prompts used (`planning/PROMPTS/`).
6. **Human review.** Reviewer subagent passes on every contract, payment, key and spending change; the founder's rehearsals.
7. **Pre-event work.** One paragraph pointing to the README line, `planning/README.md` and this disclosure table; say which two wallets were reused and that every other wallet was created at the event.
8. **Data.** All demo data is synthetic and labelled; no personal data is collected; every token is a testnet token.
