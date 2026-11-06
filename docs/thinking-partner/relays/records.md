# Relay: records (the Coordinator), 11:55 IST, Fri 6 Nov: the integration audit, npm 0.1.1, the first production purchase

## In plain words

**The integration audit is done** (`docs/plan/integration-audit.md`). It is read-only: three sub-agents read the team's fork, our code and the production site, and nothing was changed.

- **The team's two phones:** they build cleanly and their 40 tests pass. They run on mock data only: there is no live connection and no passcode step yet. PR #70 is still open, not merged.
- **Our back end:**
  - live and working: customer state, the merchant feed, shops, the agents' errand and the renewal job;
  - wired but never run on production: refund, re-order, pause, the Open toggle;
  - not built: subscriptions and the kill.
- **Recommendation:** serve the team's phones as static pages on our domain, inside T5's stage, with the explainer in the middle. Their folder stays theirs. Our own adapter connects the phones to the live back end, and the story still comes from our single story file.

**The first real purchase through the production site** came at 11:11 IST: the live runner on Kimi paid 4.80 to Kesar Kingdom.

**Both SDKs are now 0.1.1 on npm.** Each was installed from the registry and checked.

**What the founder does next:**
1. Choose the hosting option. I record it as an ADR.
2. Lock the story, including the paying agents' daily caps. The stage payer's cap is spent until Sat 05:30 IST.
3. Check the Kimi balance. A production errand costs $0.71 to $3.55.
4. OK the CLAUDE.md model line.

## Technical

- **The audit's sources:**
  - the fork at `bef8862`;
  - `main` at `29daec5`;
  - GET-only probes of production;
  - the 18 Vercel Production variable names;
  - the read-only balances.
- **The sub-agents** ran on Sonnet and used about 1.0M tokens together.
- **The bugs found** go to T5:
  - the merchant feed keeps 50 incoming edges and holds 46 (`lib/merchant-feed.server.ts:17`);
  - `export.csv`'s 100-row cap keeps only the synthetic history.
- **npm:**
  - arkiv-graph 0.1.1: published 06:04:22 UTC, shasum `28232f41…`. The quickstart and the leaderboard ran from the registry.
  - agentpay 0.1.1: published 06:05:55 UTC, shasum `a03f4295…`. The sweet shop paid 4.80 and the cab 3.20 on a local fork, and the manifest's only devDependency is `@x402/core`.
  - Both are recorded in FACTS, the README and the Arkiv file.
- **Re-order's real proof needs a person.** T5 can't send a payment or enter the passcode, and neither can I. On `/customer`: unlock, then tap "Re-order 3" (1.20).
- **The Arkiv clash:** no write has failed since #96, #97 and #93. The separate-wallet fallback stays unused.

## Problems

- None new. The feed and export bugs are T5's to fix, before any integration.
