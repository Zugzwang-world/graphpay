# AI usage

How AI was used to build GraphPay at ETHGlobal Mumbai (5–7 November 2026). ETHGlobal asks every team to document this; an organiser told the founder at kickoff to "go all out" with AI, and we disclose all of it here.

## 1. Summary

GraphPay was built with **Claude Code** (Anthropic), running mostly unattended in parallel sessions, one per track. The founder directed the work by voice and text: chose the product, wrote the briefs and the design, took every decision (each one recorded as an ADR in `docs/decisions/`), did everything that needs a person (logins, faucets and funding, account settings, organiser and sponsor questions), reviewed every milestone, rehearsed the demo and recorded the video in their own voice. Planning help came from Claude on the web, which reads `docs/thinking-partner/` in this repo.

## 2. Models and tools

| where | what |
|---|---|
| M0 session (foundation), Thu 21:35–23:58 IST | Claude Code 2.1.318, Opus 5.5 at max effort (the app's session metadata) |
| track sessions T1 Payments, T2 Identity, T3 Arkiv, T4 Agents, T5 Web and Join, from Fri 00:44 IST | started on Opus 5.5 at max effort; at 01:22 IST the Coordinator switched them to the plan (`docs/plan/sessions/README.md`), each from its next turn: Sonnet 5.5 at high for identity, agents and the website, Opus 5.5 at xhigh for payments, Arkiv and integration (to protect the weekly plan limit; FACTS records rows) |
| Coordinator (records, merges, story lock, top-ups), from Fri 00:46 IST | Opus 5.5 at max effort as started (the plan: high; only the founder can change a session's own setting, in its model menu) |
| Submission (M17), from Fri 13:00 IST | planned: Sonnet 5.5 at high |
| subagents | a **reviewer** (reads each branch's diff, blocking issues first) and a **verifier** (checks versions, addresses, chain ids and API names against primary sources), defined in `.claude/agents/` |
| the product at runtime | the buyer and shop agents run on `claude-haiku-5-5` through the Anthropic API with the Vercel AI SDK (ADR-0011, ADR-0019); Grok only if a session switches to it, and then it is recorded here |

## 3. What AI wrote

All code, tests, contracts, scripts and docs in this repository were written by Claude Code **during the hackathon**, from the specs in `planning/` and the founder's instructions. Nothing was copied from the private pre-event lab (ADR-0002, ADR-0015). Humans reviewed the decisions and the demo; the reviewer subagent reviewed the code.

## 4. What the product's AI does at runtime

The buyer agents (concierge, scout, analyst, payer) and the shop agents (storefront, risk, dispatch) ask the Arkiv money graph through MCP tools before they pay, and pay over x402 on Whitechain. **The model proposes, code disposes** (ADR-0019): limits come from the human's words, rankings are recomputed in code, the payer is bound to the approved order and the payee is read from ENS at pay time; money and limits are never decided by a prompt.

## 5. Prompts

- The redacted prompt log: `prompts/raw/` (one file per session and day; secrets masked by the hook; ADR-0029).
- The milestone prompts the sessions ran: `planning/PROMPTS/` plus the event amendments in `docs/plan/amendments/`.
- The founder's briefs: `docs/thinking-partner/briefs/`.

## 6. Human review

- **The founder's decisions**, each an ADR, among them: fresh event wallets (ADR-0024), one config file for every name and address (ADR-0030), the Whitechain RPC rule (ADR-0031), the Whitechain track and drop-in (ADR-0032), and the defaults for every sponsor-booth question (ADR-0038 to ADR-0044).
- **Reviewer passes** on every contract, payment, signature, key, secret or spending-endpoint change. Example: the first pass on the secret helpers (PR #3) found one blocking issue and eleven smaller ones; all were fixed before merge.
- **Rehearsals** of the full demo by the founder on Friday, with Claude Code watching the logs.

## 7. Pre-event work

See the "How this was built" line in `README.md`, `planning/README.md` and the disclosure table in `planning/DISCLOSURE.md`. In short: research, throwaway prototypes in a private lab repo, and a knowledge pack (specs, facts, decisions, prompts, acceptance tests; no code) committed unchanged as `planning/`. Reused: two testnet wallets (FUNDER, the funding wallet, and OPERATOR, which owns `graphpay.eth`), two credentials (an Arkiv access key and an Anthropic API key) and the bare ENS name `graphpay.eth`. **Every other wallet was created at the event** (`docs/technical/WALLETS.md`).

## 8. Data

All demo data is synthetic and labelled as such. No personal data is collected. Every token is a testnet token (Whitechain Sepolia, Ethereum Sepolia, Arkiv Rabdi).
