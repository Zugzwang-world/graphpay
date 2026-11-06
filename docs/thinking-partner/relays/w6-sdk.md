# Relay: w6-sdk (W6 SDK), 23:50 IST, Fri 6 Nov

## In plain words

- W6 takes both SDKs from 0.1.1 to **1.0.0** with no new features: `@graphpay_ethglobal/arkiv-graph` (the graph layer over Arkiv) and `@graphpay_ethglobal/agentpay` (agent payments on Whitechain).
- **No tester feedback arrived.** GitHub has no issues, and both `FEEDBACK.md` logs were empty. So W6 ran its own review: two independent audits of each README against its code, then a reviewer pass on every fix.
- **The review found real bugs, and all are fixed with tests that fail on the old code:**
  - arkiv-graph had five. Reads stopped early after a row that did not fit the schema. Totals expired 30 days after creation even while still written. A split write that failed part-way could lose or repeat counts. A batch the SDK refused hung for about 3 minutes. Long `in` filters failed at the node.
  - agentpay had seven. `subscribe()` skipped most spending guards. The refund limit could be split into small refunds. `accept()` ignored reputation. A bad request could stop a `node:http` merchant. A settled payment could stay counted twice. Renewals were reported twice. The MCP server gave the wrong version.
- **Each README now starts with the quickstart**, which is the shipped example file word for word. Each documents every export. Each links the live demo (https://graphpay-event.vercel.app) and its source as the reference app. agentpay's section on GraphPay now says only what GraphPay's code really does.
- **The live site:** arkiv-graph runs under the live site, so its read fix changes nothing unless the SDK skips a row. The money graph, mirror, city, web and integration tests all pass. agentpay is not used by the live errand.
- **Next:** two PRs merged green, then the publish. That needs the founder's npm login and the web approval (about 5 minutes) at the browser.

## Technical

- Audits: arkiv-graph found 5 bugs and 11 doc gaps; agentpay found 7 bugs and 14 doc gaps. 38 and about 150 claims were checked and hold.
- arkiv-graph:
  - `read.mjs` pages by what each page covered (`entities + skipped`) and steps over an all-skipped page by offset; `engine.mjs` does the same and warns.
  - `store.mjs` extends a patched row once half its lifetime has passed, using `$expiresAt` from `load()` (an extension never moves an expiry earlier). It validates `days` (above 0, at most 182). Split writes go out as groups of whole events, each with its checkpoint. A filter over 64 predicates is refused before sending.
  - `writer.mjs` throws the SDK's 15 pre-send validation errors at once, except on a pinned resend. `filter.mjs` takes exact u64 values only.
  - The types cover every export. Tests: 51.
- agentpay:
  - `spendGuards` is shared by `check` and `subscribe`. The pending sweep confirms settled entries.
  - `maxRefundMicro` caps the per-order total. `accept()` reads `payerNode` from `OrderCreated`.
  - `node()` and `express()` answer 400 or 413 to a request they cannot read. Renewal events are deduplicated by subId and cycle.
  - In `index.d.ts`, `Merchant.node` is the listener (the shop node is `nodeOf(name)`). Tests: 63 offline, plus the fork suite.
- `test/docs.test.mjs` in each package: the README quickstart equals the example, every export is in the API reference and the types, and the CHANGELOG starts with the version.
- The arkiv-graph lane test now exempts only the README's "Reference app" section (ADR-0057, ADR-0076).
- Publish plan: `pnpm pack`, install both tarballs in empty folders and run every example, then `npm publish <tarball> --access public` for each in one approval window. Then install from the registry and run the quickstarts. The FACTS rows follow, and both versions stay frozen until judging ends.

## State

- **Running:** this session (brief `briefs/2300-w6-sdk.md`); the reviewer on both diffs; agentpay's fork suite.
- **Blockers:** the npm login and approval (the founder), when both PRs are green.
- **Open:** nothing else.
