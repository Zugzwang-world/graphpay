# Relay: w6-sdk (W6 SDK), 01:35 IST, Sat 7 Nov

## In plain words

- **Done: both SDKs are on npm at 1.0.0**, with no new features (ADR-0080):
  - [`@graphpay_ethglobal/arkiv-graph`](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph), the graph layer over Arkiv, published at 00:34 IST;
  - [`@graphpay_ethglobal/agentpay`](https://www.npmjs.com/package/@graphpay_ethglobal/agentpay), agent payments on Whitechain, published at 01:30 IST.
- **Checked from the registry:** each was installed into an empty folder and its quickstart and examples ran. Each published file is the exact tarball tested before the publish (same shasum).
- **Frozen:** no new version goes out from the submission until judging ends. A bug found before then is logged in the package's `FEEDBACK.md`, and the fix waits.
- **No tester feedback arrived** (no GitHub issues), so W6 ran its own review: two audits of each README against its code, then the reviewer agent on every fix.
- **arkiv-graph, five bugs fixed** ([#174](https://github.com/Zugzwang-world/graphpay/pull/174)):
  - reads stopped early after a row that did not fit the schema;
  - totals expired 30 days after creation, even while still written;
  - a split write that failed part-way could lose or repeat counts;
  - a batch the SDK refused hung for about 3 minutes;
  - long `in` filters failed at the node.

  The live site runs on this package. Its reads are unchanged unless the SDK skips a row.
- **agentpay, seven bugs fixed** ([#177](https://github.com/Zugzwang-world/graphpay/pull/177)):
  - `subscribe()` skipped most spending guards;
  - the refund limit could be split into small refunds, or raced;
  - `accept()` ignored reputation;
  - a settled payment could stay counted twice;
  - a bad request could stop a `node:http` merchant;
  - renewals were reported twice;
  - the MCP server gave the wrong version.

  The reviewer caught one regression in W6's own fix (a retry after the deadline would have paid twice). It was fixed before the merge.
- **Both READMEs start with the quickstart**, the shipped example word for word, and document every export. Both link the live demo and its source as the reference app.
- **For W7:** the root README's agentpay row (line 123) still says 0.1.1; the arkiv-graph row and `arkiv/reach.md` are already at 1.0.0.

## Technical

- Release:
  - `pnpm pack` from main 2e1f395 in a clean worktree;
  - a clean room on the tarballs: install into empty folders, run every example and the README snippets, compare each README quickstart with its example, check the MCP version;
  - `npm publish <tarball> --access public`;
  - the same clean room against the registry.
- Shasums: arkiv-graph `2bde2d21…`, 21 files; agentpay `aff35f48…`, 32 files. Both are in `docs/technical/FACTS.md`; `VERSIONS.md` has both rows.
- npm lessons, for the next publish:
  - the web sign-in polls a done-URL; a network timeout there can lose the approval (403 on the retry), and starting again fixes it;
  - the 2FA web approval for a publish needs a terminal, or npm fails at once with EOTP, so run it in a Terminal tab;
  - each package needs its own approval;
  - an approval link lasts about 5 minutes, so post it as the last line of a turn: mid-turn text may not reach the founder.
- Tests: arkiv-graph 54; agentpay 67 offline and 21 on the fork. `test/docs.test.mjs` in each package keeps the README and the types in step with the exports.

## State

- **Done.** Session `local_b6205da6-b613-4662-872a-6d4879c66faf` (brief `briefs/2300-w6-sdk.md`).
- **Blockers:** none.
- **Open:** W7 updates the agentpay row; then nothing until judging ends.
