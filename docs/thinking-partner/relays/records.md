# Relay: records (the Coordinator), 12:47 IST, Fri 6 Nov: supporting the integration proof of concept

## In plain words

The founder started the integration proof of concept. A new Integration session builds one website: the team's two phones beside T5's explainer, on the live back end. The Coordinator's job is the essentials it needs and the decisions on record, while every other session stays idle so the usage goes to the integration.

**Done:**
- **The team's code is in.** PR #70 is squash-merged, credited to the team member who wrote it.
- **Funding:** the founder's 150 test USDT reached our funding wallet. 100 of it went on to Vitalik's payer, which now holds 125, and Vitalik's wallet got gas for many pauses and resumes.
- **The founder's decisions, recorded:**
  - **ADR-0069:** visitors use the site with no passcode and no rate limits; the keys between our own servers stay.
  - **ADR-0070:** option A from the audit.
  - **ADR-0071:** Mr. Vitalik stays the persona, the payer can spend 100 a day, and the new story comes after the founder's run.
  - **ADR-0062, amended:** payments and merges are allowed up to 97% for this work.
- **Kimi:** the project instructions and the README now say the agents run on Kimi.

**In progress:**
- **The payer's 100-a-day pass:** T1 writes it on-chain and T2 in ENS.
- **A reliable errand:** Join leads, with T4.
- **T3:** one image on Swarm.
- **T5:** reviews.

## Technical

- **#70:** merged with `--match-head-commit bef8862`.
  - GitHub made UTSAV OJHA the commit's author, with GitHub as committer.
  - The body lists the 10 commits, with Co-authored-by trailers.
  - `gh pr merge --author-email` with the author's noreply address was refused ("Invalid email address"): it must be one of the merger's own emails.
- **Funding:**
  - The founder's transfer: `0x7aeb681a…42e10535`, block 12,349,311, at 11:44:39 IST.
  - `--plan usdt`: PAYER 99.8, ACCEPTANCE_PAYER 5.2, VITALIK 5.2 and REHEARSAL_PAYER 1.2.
  - `--plan m0` on Sepolia: VITALIK 0.018 ETH.
  - FUNDER keeps 54.14 test USDT and 0.2569 Sepolia ETH. All of it is in `WALLETS.md` §2b.
  - The payer's bounded Permit2 approval (50) renews itself whenever the allowance falls below the amount due, so a cap of 100 is not blocked.
- **Builds:**
  - `apps/web/vercel.json` now has an `ignoreCommand`, verified in Vercel's schema and docs, which say it overrides the project setting.
  - It adds `integration/`, `frontend/` and `apps/phones/`. `integration/` was missing, so runner-only commits did not deploy.
- **PRs:**
  - #105: the config and funding records.
  - This PR (`coord/decisions-1240`): the ADRs, CLAUDE.md, the README and the thinking-partner records.

## Problems

- A Sepolia balance read from the public node lagged behind the receipt for a few seconds. Lesson: confirm a transfer by its receipt, and read balances again later.
