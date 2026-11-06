# ADR-0068: The team's site, with T5 as reviewer and integrator; the live runner runs on the server
Status: accepted · Date: 2026-11-06 09:55 IST · Decided by: founder · Source: the founder's message to the Coordinator (Fri morning); PR #70 (the team's site, confirmed as theirs); Join's PRs #85 and #88

## Decision
The founder's team has finished its own website (PR #70). **T5 stops building screens in `apps/web`.**
- **Review first:** T5 reviews the team's PR for CI, `pnpm check`, the secret scan, no key or story name hard-coded in browser code, and the passcode on every spending action. The reviewer agent checks anything that spends. T5 reports what to fix or merge.
- **Then integrate:** after the merge, T5 builds on the team's site and connects it to the live routes and the errand runner through the adapter contract.

**The live errand runner is option B:**
- it runs on the server only;
- it uses the live preset only;
- every guardrail stays on;
- its keys are only on Vercel.

Both sites use it.

## Why
- The team built its UI in parallel (ADR-0065). One integrator keeps the hosted routes, the passcode and the secret rules intact across both sites.
- The runner signs payments, so its keys must never reach a browser.

## Consequences
- **T5's review of #70 says: do not merge yet.** The team's fixes:
  - (a) move it into `apps/demo-ui` as a pnpm workspace app, with no npm lockfile;
  - (b) read the story and the explorer links from `@graphpay/config`;
  - (c) no middle dots or uppercase labels;
  - (d) the passcode in the adapter contract;
  - (e) a CI step for `demo-ui`.
- **The runner:**
  - Join's #88 (`/api/agents/run`) builds on #85 (option A, D11's presence watcher). The reviewer found no blockers.
  - The live preset is now Kimi (ADR-0067). `KIMI_API_KEY` and `PAYER_PRIVATE_KEY` are on Vercel Production.
  - The runner limits itself to one errand at a time per instance and 6 an hour. Kimi's prepaid balance caps spending across all instances.
- **This amends ADR-0065.** "T5 keeps `apps/web`; nothing changes for T5" no longer holds for new screens. The founder still compares the two UIs.
