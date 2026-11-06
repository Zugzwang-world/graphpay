# Relay: w7-submission (the night Submission stream)

Updated 23:40 IST, Fri 6 Nov, by W7 Submission (`local_abd77623-de22-4fe2-a0a9-865fdd43dba2`). Brief: [`briefs/2258-w7-submission.md`](../briefs/2258-w7-submission.md).

## Plain language

W7 writes what a judge reads, so the founder can paste the ETHGlobal submission from one file, and every claim in it links to evidence. All four items of the brief now exist; what remains is keeping them true as the other night streams land.

**Landed:**
- **The README** ([#154](https://github.com/Zugzwang-world/graphpay/pull/154)): what GraphPay is, the live link, the fictional-persona sentence, and a "verify each claim" table where every payment, refund, renewal, ENS action and Arkiv receipt opens on a public explorer. It also has a keyless Arkiv query, a viem check of the ENS records, the partner sections, the limitations and the team. A root MIT `LICENSE` came with it.
- **AI_USAGE.md and the five Arkiv files** ([#159](https://github.com/Zugzwang-world/graphpay/pull/159)).
  - AI_USAGE.md: Claude Code wrote the code; Claude helped plan; Kimi runs the agents; the Grok desk made the assets; all images are AI-generated; every session is listed with its model.
  - The Arkiv files: friction, reach, why Arkiv, how we use it, Swarm.
- **The Whitechain and ENS notes** ([#161](https://github.com/Zugzwang-world/graphpay/pull/161)): `WHITECHAIN_FEEDBACK.md` at the root, and `docs/submission/ENS.md`.

**In this step's PR:** [`docs/submission/ETHGLOBAL.md`](../../submission/ETHGLOBAL.md), the form text: name, one-liner (90 characters), description, how it's made, links, and one block for each of the three partner prizes, with a "before you press Submit" list for the founder.

**The founder must:**
- review the README and the partner files;
- confirm the team list;
- record the video and paste its link;
- submit from `ETHGLOBAL.md` by 08:00 IST.

## Technical

- **Evidence method:**
  - A read-only script read 24 transactions back: Whitechain's Blockscout API for status, method and token transfers; public Sepolia and Rabdi RPCs, chain id first. All succeeded.
  - A link checker runs over every owned file: relative links and their anchors must exist; external links must answer. npm's pages refuse scripts (403), so the packages are checked through the registry API.
  - Every URL in the form text answered 200 at 23:38 IST.
- **Live facts gathered tonight** (all cited in the files):
  - Arkiv receipts carry `ref = 1874:<Whitechain tx>:<log>`.
  - `ask` with `verify: true` answers `RAW_VERIFIED` in 8 Arkiv calls.
  - The map lists 16 shops, 10 labelled synthetic.
  - The accountant CSV: 346 rows over 31 days, 105 of them chain rows with explorer links, the rest labelled synthetic history.
  - The Swarm menu and the dish photo match their recorded hashes.
  - On chain 1874, `eth_getCode` finds Permit2, Multicall3, EntryPoint v0.7, x402's Permit2 proxy and the deterministic deployer.
  - The checkout enforces the daily cap itself (`SPEND_CAP` in `_checkPolicy`).
- **Corrections along the way:**
  - Explain ids live per server instance (the last 200), so no fixed explain link is published.
  - URLs percent-encode their parentheses.
  - B7 and B9 are cited as what they are: a fork test, and the payee read recorded in C2.
  - The agent's scoped keys are named exactly: `agent-context` and its Whitechain address.
- **Deviations:**
  - The brief's `why.md` is written as `arkiv/why-arkiv.md`, the name the pack and the plans use.
  - The payer's cap is linked live, never quoted: it is 300 tonight (W5's #152).
  - The store is not deployed, so the README says how to run it locally.
  - My LOG and OPEN heading is now `## w7-submission`, like the other night streams.
- **The final pass:** the form text's last section lists what can still change.
  - W1: the shops' ENS names (today `kesar-kingdom` and the others).
  - W2: the race at size M, and the menus.
  - W6: the SDKs at 1.0.0.
  - W3: newer refund, re-order or renewal links.
  Each is an edit to the README, the Arkiv and ENS files and the form text after it lands.
