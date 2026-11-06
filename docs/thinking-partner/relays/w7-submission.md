# Relay: w7-submission (the night Submission stream), final

Updated 01:35 IST, Sat 7 Nov, by W7 Submission (`local_abd77623-de22-4fe2-a0a9-865fdd43dba2`). Brief: [`briefs/2258-w7-submission.md`](../briefs/2258-w7-submission.md).

## Plain language

**The brief is done.** The founder can paste the ETHGlobal submission from one file, [`docs/submission/ETHGLOBAL.md`](../../submission/ETHGLOBAL.md). Every claim in it links to evidence that answered at the close: a public explorer page, a live endpoint, or a record in this repo.

**What exists, all on main:**
- **README:**
  - what GraphPay is, the live link and the fictional-persona sentence;
  - a "verify each claim" table;
  - a keyless Arkiv query and a viem check of the ENS records;
  - the Whitechain, ENS and Arkiv sections, the SDKs, the limitations and the team;
  - a root MIT `LICENSE`.
- **AI_USAGE.md:**
  - Claude Code wrote the code; Claude helped plan; Kimi makes the agents' three judgment calls; the Grok desk made the assets, and all images are AI-generated;
  - the team's apps list GitHub Copilot as co-author;
  - every session is listed with its model.
- **The Arkiv files:** friction, reach, why Arkiv, how we use it, Swarm.
- **The partner notes:** `WHITECHAIN_FEEDBACK.md` and `docs/submission/ENS.md`.
- **The form text, the video shot list and the checklist.**

**The final pass matches the close** (the founder's word through the Coordinator, about 01:30 IST):
- race mode stays at size S, and no number at size M is claimed;
- both SDKs are 1.0.0 on npm (arkiv-graph at 00:34 IST, agentpay at 01:30 IST);
- the acceptance report is cited without totals until W5 regenerates it.

**Live with their links:**
- the label flip, and the first errand under the new name;
- the kill on production;
- the limits;
- subscriptions;
- the re-order;
- the owner's cap change;
- self-healing;
- the refund decline;
- W4's three errands in a row (47.4 s, $0.027).

**The founder must** (OPEN, `w7-submission`):
- review the README;
- confirm the team list;
- record the video from the shot list;
- send the disclosure if not sent;
- submit from `ETHGLOBAL.md` by 08:00 IST.

## Technical

- **PRs:** #154, #159, #161, #164, #166, #170, #178, #180, #187, #193, #195, #196, #198, #199, #205, #208, #211, and this final one. Each was small, docs only and auto-merged.
- **How claims were checked:**
  - **Transactions:** about 45, each read back before it was cited. Whitechain through the Blockscout API (status, method, token transfers); Sepolia and Rabdi through public RPCs, with the chain id checked first.
  - **Arkiv entities:** read with a keyless `arkiv_query` until the keyless budget refused this Mac (`ANON_COST_LIMITED`, friction row 10). After that, no direct Rabdi reads, to keep the mirror's budget.
  - **Swarm files:** fetched and compared with their recorded sha-256.
  - **ENS records:** read with stock viem.
  - **Links:** a checker runs over every owned file, and every URL in the form text answered 200 at the close. npm's pages refuse scripts (403), so the packages are checked through the registry API.
- **The independent audit** (a fresh reviewer given only the files) found 17 problems, all fixed in #178. Examples:
  - the kit payment ran by script;
  - the first facilitator payment was misdated;
  - receipts lapse after 30 days;
  - the Swarm photo is stored, not shown.
- **Deviations:**
  - The brief's `why.md` is `arkiv/why-arkiv.md`, the name the pack and the plans use.
  - The payer's pass is linked live, not quoted as a number (300 tonight).
  - The store is not deployed, so the README gives its local run.
  - The decline's only live link is an explain id that expires with its server instance, so the README cites W3's relay.
- **Left open:**
  - the founder's items above;
  - the video's Swarm timestamp (`arkiv/swarm.md` item 6);
  - the regenerated acceptance report, if W5 lands it before 08:00 IST.
