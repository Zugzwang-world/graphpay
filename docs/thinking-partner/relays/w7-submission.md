# Relay: w7-submission (the night Submission stream)

Updated 23:32 IST, Fri 6 Nov, by W7 Submission (`local_abd77623-de22-4fe2-a0a9-865fdd43dba2`). Brief: [`briefs/2258-w7-submission.md`](../briefs/2258-w7-submission.md).

## Plain language

W7 writes what a judge reads, so the founder can paste the ETHGlobal submission from one file and every claim in it links to evidence.

**Landed:** the README ([#154](https://github.com/Zugzwang-world/graphpay/pull/154), 23:24 IST). It says what GraphPay is, gives the live link, carries the fictional-persona sentence, and has a "verify each claim" table where every payment, refund, renewal, ENS action and Arkiv receipt opens on a public explorer. A root MIT `LICENSE` came with it.

**Also landed:** AI_USAGE.md and the five Arkiv files ([#159](https://github.com/Zugzwang-world/graphpay/pull/159), 23:30 IST).

**In this step's PR:**
- **`WHITECHAIN_FEEDBACK.md`**, at the root, as Whitechain's rules ask: what we built, what worked, gas measured on the event build, friction ranked by cost, and docs we would add.
- **`docs/submission/ENS.md`**, the ENS partner note: the namespace, and what ENS decides at pay time, each with its evidence.
- Two README claims made exact: the agent's scoped keys, and where the payee read is recorded.

**Next:** the form text, `docs/submission/ETHGLOBAL.md`. Then a pass after W1's new shop names, W2's race at M and W6's 1.0.0 SDKs.

**The founder must:** review the README; confirm the team list; record the video and paste its link into the form; submit by 08:00 IST.

## Technical

- **Evidence method:** a read-only script read 24 transactions back (Whitechain's Blockscout API for status, method and token transfers; public Sepolia and Rabdi RPCs, chain id first). All succeeded. A link checker now runs over every owned file: relative links must exist, with their anchors; external links must answer. Only npm's pages refuse it (403 to scripts), so the packages are checked through the registry API instead.
- **New friction rows:**
  - #8, the access key's quota: HTTP 429 `QUOTA_EXCEEDED` with `arkiv-quota-used-percent: 100`, while the rate-limit header still showed about 4,900 left. It was fixed by the keyless fallback (#148).
  - #9: `bool(false)` is refused ("bool takes no wrapper"), unlike every other typed literal.
- **reach.md:**
  - It leads with `npm i @graphpay_ethglobal/arkiv-graph`.
  - Its ten-line quickstart was run against the package source and printed `1n` and the exact Arkiv query.
  - It covers the live GraphQL and the MCP server (`claude mcp add --transport http …`, also found through ENS `agent-endpoint[mcp]`).
  - Installs: published 0.1.0 and 0.1.1; npm's download counter has no data yet for a package published today; no feedback issue yet (read 23:25 IST).
  - The roadmap: keyset paging, server-side aggregates, a React kit.
- **why-arkiv.md:**
  - The case: a reputation no platform owns; authorship anyone can check (the owner filter, plus each receipt's `ref` naming its Whitechain transaction); receipts that cannot be edited; expiry as policy; reads for any agent.
  - What it costs, and what stays off Arkiv.
- **how-you-use-arkiv.md:**
  - Presence and hand-offs are now shipped (the live runner writes them).
  - `count()` is live: `ask` with `verify: true` answered `RAW_VERIFIED` for Filter & Fold in 8 calls.
  - The map lists 16 shops, 10 labelled synthetic.
  - New row: the Swarm pointers.
- **swarm.md:** the dosa menus (Filter & Fold v3). The menu's sha-256 equals the row's `content_hash`, and the dish photo's equals its recorded hash (both fetched tonight). The phones' build reads them keyless (`apps/phones/menu-images.mjs`).
- **WHITECHAIN_FEEDBACK.md:**
  - Every gas number is a transaction read back from the explorer.
  - The standard contracts were checked with `eth_getCode` at 23:29 IST: Permit2, Multicall3, EntryPoint v0.7, x402's Permit2 proxy, the deterministic deployer.
  - Friction, by cost: the `eth_getLogs` range caps (10,000 and about 1,000 blocks), getting test USDT, "verified" against "fully verified", the faucet amount, WebSockets on a paid tier.
- **ENS.md:** the payer's resume transaction was verified on Sepolia (23:00 IST, from Vitalik's wallet to the payer's resolver). B7 and B9 are cited as what they are: a fork test, and the payee read recorded in C2.
- **Corrections made:**
  - Explain ids live per server instance (the last 200), so the docs link no fixed explain id.
  - The GraphQL and explorer links now percent-encode their parentheses, so every renderer keeps them whole.
  - The times in #154 were corrected to measured ones.
- **Deviations:**
  - The brief's `why.md` is written as `arkiv/why-arkiv.md`, the name the pack, the master plan and the M17 plan use.
  - The payer's cap is linked live, never quoted: it is 300 tonight (W5's #152).
  - The store is not deployed, so the README says how to run it locally.
- **Open risks:**
  - The shop labels change with W1, the menus and race with W2, the SDK versions with W6.
  - Each is a pass over the README, the Arkiv files and the form text after it lands.
