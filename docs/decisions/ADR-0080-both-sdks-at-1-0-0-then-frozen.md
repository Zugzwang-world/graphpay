# ADR-0080: Both SDKs at 1.0.0 before the submission, with no new features, then frozen
Status: accepted · Date: 2026-11-07 01:35 IST · Decided by: founder · Source: the W6 brief `docs/thinking-partner/briefs/2300-w6-sdk.md`

## Decision
`@graphpay_ethglobal/arkiv-graph` and `@graphpay_ethglobal/agentpay` go to 1.0.0 before the submission. A 1.0.0 adds no new features: it carries 0.1.1's API, documented and typed in full, with bug fixes only. Both versions stay frozen from the submission until judging ends. This amends ADR-0063's versioning rule ("0.1.x for fixes, 0.2.0 for changes").

## Why
The founder wants stable versions for the judges and for developers who try the packages: each README starts with a quickstart that runs as written, every export is documented, and the live demo is linked as the reference app (ADR-0076). No tester feedback arrived at 0.1.x (no GitHub issues), so W6's own review found the fixes instead:
- arkiv-graph: 5 bugs fixed, in [#174](https://github.com/Zugzwang-world/graphpay/pull/174);
- agentpay: 7 bugs fixed, in [#177](https://github.com/Zugzwang-world/graphpay/pull/177).

## Consequences
- Both are on npm at 1.0.0 (arkiv-graph at 00:34 IST, agentpay at 01:30 IST, Sat 7 Nov), recorded in `docs/technical/FACTS.md`. Each was installed from the registry into an empty folder, and its examples ran.
- After the submission, no new version is published until judging ends. A bug found before then is logged in the package's `FEEDBACK.md`, and the fix waits.
- The submission texts cite 1.0.0: the README and `arkiv/reach.md` (W7).
