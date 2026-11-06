# Brief (Coordinator, 09:40 IST, Fri 6 Nov): publish the arkiv-graph SDK, with three corrections

Run `docs/plan/sessions/T3-arkiv.md`; read `docs/sessions/arkiv/resume.md` first. The publish brief there (ADR-0063, the founder's 09:35 brief) has three corrections:

- The package name is `@graphpay_ethglobal/arkiv-graph`, not `@graphpay/…`. Rename it in `package.json`, every import across the repo and the READMEs, in one PR; tell the owners of any files touched outside T3's folders.
- The labels are `arkiv-graph` and `feedback`, on the repo, with the template `.github/ISSUE_TEMPLATE/arkiv-graph-feedback.yml`. `FEEDBACK.md` is a log: date, who, what they asked, outcome.
- The licence is MIT. The full API reference can follow in 0.1.x. Keep the no-payment-words lane test.

Everything else stands: the 5-minute quickstart (ArkivSim by default), the leaderboard example, the CHANGELOG, 0.1.0, `publishConfig.access` public, a `files` list, no workspace-only dependencies, then pack, install the tarball in an empty folder and run the quickstart. Ready by about 12:00 IST; tell the Coordinator when it passes. The Coordinator publishes after the founder's npm login. Pause at 92% of the weekly plan.
