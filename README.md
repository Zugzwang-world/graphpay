# GraphPay: ask before you pay

AI agents with ENS names pay shops over x402 on Whitechain through our own facilitator; every payment becomes part of a money graph on Arkiv that any agent can ask, with an explain trace of every read, before it pays. A general Whitechain payments solution, built at ETHGlobal Mumbai (5–7 November 2026). Testnets only.

> **How this was built:** before the hackathon we did research and built throwaway prototypes in a separate private lab repo to test our assumptions (for example how Arkiv handles repeated writes, and how ENSv2 behaves when an agent's name is revoked). We brought only knowledge to the event: research notes, written specs, verified facts, decisions, prompts and acceptance tests, all in `planning/`. **All code in this repo was written during the hackathon**, by us with Claude Code; see `AI_USAGE.md`. Pre-event items we reused, all disclosed here: two testnet wallets (a funding wallet holding faucet tokens, and the wallet that owns the ENS name), two credentials (an Arkiv access key and an Anthropic API key; no code), and the bare ENS name `graphpay.eth`, registered on Sepolia before the event with no records or subnames. Every other wallet was created at the event.

**Status:** being built live. This README grows as the tracks land; the live state is in `docs/thinking-partner/NOW.md` and the plan in `docs/plan/MASTER_PLAN.md`.

## Repository map

| path | what |
|---|---|
| `planning/` | the pre-event knowledge pack, committed unchanged (specs, facts, decisions, prompts, acceptance tests; no code) |
| `packages/config/` | the one config file: every person, shop and agent name, every ENS, Whitechain and Arkiv address and URL (ADR-0030) |
| `packages/contracts/` | the Whitechain checkout contract and its Foundry tests |
| `packages/*` | the facilitator and shop, ENS identity, the Arkiv money graph, agents, the mirror (one package per track) |
| `apps/web/` | the website and the hosted API routes (Vercel project `graphpay-event`, https://graphpay-event.vercel.app) |
| `scripts/` | the secret scan (`pnpm check`), secret helpers, funding and the prompt-log hook |
| `docs/` | the event's own records: `plan/`, `decisions/`, `technical/` (facts, versions, wallets), `problems/`, `thinking-partner/` |
| `prompts/raw/` | the redacted prompt log |

## Develop

Requirements: Node 22 (`.node-version`), pnpm 10.34.9 (`packageManager`), Foundry 1.9.0 for the contracts.

```bash
pnpm install
pnpm check
pnpm test
```

Secrets live only in the git-ignored `.env` (names in `env.example`) and in Vercel as Sensitive values. Helpers print names and addresses, never values: `pnpm secrets:status`, `pnpm secrets:set NAME` (hidden input), `pnpm secrets:gen NAME`, `pnpm wallet:gen --only ROLE`.

## Networks

Whitechain Sepolia (chain 1874), Ethereum Sepolia (11155111) for ENSv2, Arkiv Rabdi (7794095). Addresses and URLs: `packages/config/graphpay.config.json`; verified facts: `docs/technical/FACTS.md`.
