# ADR-0057: arkiv-graph is a generic SDK, published as @graphpay/arkiv-graph

Status: accepted; the package name and the timing are superseded by ADR-0063 (published as `@graphpay_ethglobal/arkiv-graph` by 13:00 Friday) · Date: 2026-11-06 01:10 IST · Decided by: founder (chat, 00:48 IST) · Source: `docs/thinking-partner/briefs/0048-arkiv-graph-sdk.md`; the Arkiv booth asked for a developer SDK for our graph layer

## Decision

`packages/arkiv-graph` is a generic Arkiv graph SDK: its public API lets a developer define the nodes, the edges and the totals (views), and nothing payment-specific lives in it. GraphPay's money graph is an app layer, `packages/money-graph`, that uses the package only through its public API. On Friday, after the acceptance run, the package is published to npm as `@graphpay/arkiv-graph` once the name is checked free, with a README quickstart, an API reference, one small non-payments example (a leaderboard), tests, and links from `arkiv/reach.md` and `arkiv/how-you-use-arkiv.md`.

## Why

The Arkiv booth asked for a developer SDK. Reach is one of Arkiv's four judging parts (`planning/SPONSOR_CHECKLIST.md` item 5, from research), and a package that other projects can install, shown with an example outside payments, makes the graph layer useful beyond GraphPay. Holding the boundary from M7a on means nothing has to be pulled apart on Friday.

## Consequences

- **T3** (told 01:04 IST, adopted in M7a): the workspace package is named `@graphpay/arkiv-graph` with an `exports` map; a boundary test keeps payment words and GraphPay entity names out of its source. The payment model (the `graphpay.*.v1` entities, edge kinds, the tally counters, reputation, the GraphQL types and the MCP tools) lives in `packages/money-graph` (`@graphpay/money-graph`, private), which T3 owns. T1's recorder and Join's mirror import the GraphPay writer from `@graphpay/money-graph`. M7a still ships first; any generic polish left over goes to Friday.
- **Friday item 18** (`docs/plan/MASTER_PLAN.md` §4): T3 writes the README quickstart, the API reference, the leaderboard example and the tests; the Coordinator re-checks the name, runs a dry run and a reviewer pass on the tarball, and publishes with the founder's npm login, asked for when ready. T3's `how-you-use-arkiv.md` draft and Submission's `reach.md` link to the package.
- It takes the place of the pack's planned `arkiv-graphql` package (`planning/SPONSOR_CHECKLIST.md`, the `reach.md` row and the publish row): one package, installed with `npm i @graphpay/arkiv-graph`. The live GraphiQL URL and the hosted MCP server stay as planned.
- Name check, 01:02 IST: `@graphpay/arkiv-graph` is not on the registry and nobody owns the npm scope `graphpay` yet. The unscoped `arkiv-graph` is a different Arkiv project, which our README credits and tells apart (`docs/technical/FACTS.md`). Publishing under `@graphpay` needs the founder's npm account to own the scope (a free npm organisation `graphpay`).
- npm allows an unpublish only within 72 hours and only without dependents, so the publish is treated as irreversible: testnet values only in the examples, no secrets or keyed URLs in the tarball, and the founder's go-ahead at publish time.
