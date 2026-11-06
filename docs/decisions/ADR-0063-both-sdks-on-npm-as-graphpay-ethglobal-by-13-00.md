# ADR-0063: Both SDKs on npm under @graphpay_ethglobal by 13:00 Friday

Status: accepted · Date: 2026-11-06 09:30 IST · Decided by: founder (the 09:35 brief, `docs/thinking-partner/briefs/0935-sdk-publish-and-handoff.md`; it replaces his 09:15 message naming `@graphpay`) · Source: that brief

## Decision

`@graphpay_ethglobal/arkiv-graph` (T3) and `@graphpay_ethglobal/agentpay` (T6) are published to npm by about 13:00 IST Friday, under the founder's npm organisation `graphpay_ethglobal`. We don't claim `graphpay`.

Each package needs, before publishing:
- a README quickstart that works in 5 minutes;
- an example: arkiv-graph's is a leaderboard; agentpay's are the sweet shop and a fixed-fare cab ride;
- a CHANGELOG;
- version 0.1.0, `publishConfig.access: public`, a `files` list and the MIT licence;
- no workspace-only dependencies (the checkout ABIs are inlined into agentpay), proved by packing it, installing the tarball in an empty folder and running the quickstart;
- a `FEEDBACK.md` (date, who, what they asked, outcome).

AgentPay V1 refuses any chain but 1874. It never defaults to GraphPay's hosted facilitator or relayer: developers bring their own relayer key, with the anti-drain limits on by default. A reviewer pass is required before publishing.

The founder runs `npm login` in a Terminal tab and approves the prompts. The Coordinator publishes with `pnpm publish --access public`, then installs each package from the registry in an empty folder and runs its quickstart. Versions: 0.1.x for fixes, 0.2.0 for changes. After the submission (Sat 08:00) the published versions are frozen until judging ends.

## Why

The founder will ask developers at the venue to try both packages today, collect their requests and ship new versions. That feedback is also real-usage evidence for the Arkiv and Whitechain judges. The safety rules mean no stranger can spend our gas or break the demo.

## Consequences

- **ADR-0057:** its package name (`@graphpay/arkiv-graph`) and its timing (after acceptance) are superseded. Its generic-SDK boundary and lane rules stand.
- **The names change everywhere:** `package.json`, imports, READMEs, Friday item 18, `OPEN.md` and `FACTS.md`. T3 and T6 rename their packages and the imports that use them.
- **Lane tests:** arkiv-graph keeps its no-payment-words test, and a new test fails if agentpay imports from our Arkiv or ENS packages.
- **GitHub issue labels** `arkiv-graph`, `agentpay` and `feedback` exist (09:2x IST), with an issue template per package in `.github/ISSUE_TEMPLATE/`.
- T3 and T6 run on Sonnet 5.5 at high for this work.
- The full API reference can follow in 0.1.x.
- npm allows an unpublish only within 72 hours, so the tarball's file list is reviewed before publishing.
