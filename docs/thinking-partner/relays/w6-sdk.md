# Relay: w6-sdk (W6 SDK), 00:12 IST, Sat 7 Nov

## In plain words

- W6 takes both SDKs from 0.1.1 to **1.0.0**, with no new features: `@graphpay_ethglobal/arkiv-graph` (the graph layer over Arkiv) and `@graphpay_ethglobal/agentpay` (agent payments on Whitechain).
- **No tester feedback arrived:** GitHub has no issues, and both `FEEDBACK.md` logs were empty. So W6 ran its own review: two independent audits of each README against its code, then a reviewer pass on every fix.
- **arkiv-graph 1.0.0 is merged** ([#174](https://github.com/Zugzwang-world/graphpay/pull/174)). It fixes five bugs:
  - reads stopped early after a row that did not fit the schema;
  - totals expired 30 days after creation, even while still written;
  - a split write that failed part-way could lose or repeat counts;
  - a batch the SDK refused hung for about 3 minutes;
  - long `in` filters failed at the node.

  The live site runs on this package. Its reads are unchanged unless the SDK skips a row, and every live test passed before the merge.
- **agentpay 1.0.0 is in its PR.** It fixes seven bugs:
  - `subscribe()` skipped most spending guards;
  - the refund limit could be split into small refunds, or raced;
  - `accept()` ignored reputation;
  - a settled payment could stay counted twice;
  - a bad request could stop a `node:http` merchant;
  - renewals were reported twice;
  - the MCP server gave the wrong version.

  The reviewer's first pass caught a regression in W6's own fix: a retry after the deadline would have paid twice. It is fixed and tested, and the second pass found nothing blocking. The live errand does not use this package.
- **Both READMEs start with the quickstart**, the shipped example word for word, and document every export. Both link the live demo (https://graphpay-event.vercel.app) and its source as the reference app. agentpay's section on GraphPay now says only what GraphPay's code really does.
- **Next:** the publish, once this PR is merged. It needs the founder at the browser for about 10 minutes: the npm sign-in, then the web approval, each link valid for about 5 minutes.

## Technical

- arkiv-graph:
  - `read.mjs` pages by what each page covered (`entities + skipped`). When a page holds only skipped rows, it re-anchors with a page of keys alone and re-reads that stretch, and skipped rows count against `cap`.
  - `store.mjs` extends a patched row once half its lifetime has passed (`$expiresAt` from `load()`). It sends split writes as groups of whole events, halving a group on a 413. It refuses a `days` the SDK cannot set and a filter over 64 predicates.
  - `writer.mjs` throws the SDK's 15 pre-send errors at once. Tests: 54.
- agentpay:
  - `spendGuards` is shared by `check` and `subscribe`. Under a mandate, every cycle of a plan must fit it, and the first charge counts from signing until the chain or a definite refusal clears it.
  - The pending sweep skips the request being paid. Refunds run one at a time and are checked against a local running total.
  - `accept()` reads `payerNode` from `OrderCreated` (cached) and refuses when it is missing. Renewals are deduplicated by `renewalOrderId`, and `quoteTtlSeconds` is at most 600.
  - Tests: 67 offline and 21 fork. The README fragments type-check against `index.d.ts`.
- In each package, `test/docs.test.mjs` checks that the README quickstart equals the example and that every export is documented and typed.
- Clean room, before the publish: `pnpm pack` from merged main, install each tarball in an empty folder, run every example. The same check runs on the registry afterwards.
- Publish: `npm publish <tarball> --access public`, both packages one after the other in one approval window. Then the FACTS and VERSIONS rows, and both versions frozen until judging ends.

## State

- **Running:** this session (brief `briefs/2300-w6-sdk.md`).
- **Blockers:** the npm sign-in and approval (the founder), once this PR is merged.
- **Open:** W7's README and `arkiv/reach.md` still say 0.1.1; W6 tells the Coordinator when 1.0.0 is live.
