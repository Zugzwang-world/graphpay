# NOW

Updated 23:05 IST, Thu 5 Nov (main)

## Summary (main only)

**M0 (foundation) is complete; wave 1 starts when its last PRs merge.** The public repo `Zugzwang-world/graphpay` is protected, and every change goes through PRs with auto-merge. The live site is **https://graphpay-event.vercel.app** (public, no login).

Done:
- every role wallet funded on all three testnets, with test USDT in the payer wallets;
- facts re-verified, nothing blocking a track;
- the founder's Ankr URL stored and checked (chain 1874, HTTPS);
- Vercel connected to the repo, and docs-only commits skip builds.

New tonight:
- **One story config** (`packages/config/story.json`) holds everything story-specific; code never does (ADR-0047). It holds the pack's cast as a test story until the founder locks the final story.
- **Agent models are presets** in that file: `testing` = Opus 5.5 at xhigh is active; `live` = Haiku 5.5 at xhigh. All three presets were tested and accepted.
- **Only the small city is seeded tonight.** The large city waits for the locked story (ADR-0049).
- The stand-in token is retired: everything pays in test USDT.

Next:
1. The founder starts T1–T5 (`docs/plan/prompts/session-lines.md`).
2. Join starts when M7a merges.
3. Acceptance targets Fri 05:00–06:00 IST.
4. Feature freeze is Fri 18:00. We submit by Sat 08:00.

## foundation

Updated 23:05 IST. A1–A6 pass. Merged: PR #1 (web placeholder) and PR #2 (Vercel install fix).

In review:
- **#3** (secret helpers): pass 1 fixed, pass 2 running.
- **#4** (funding): the reviewer's blocking double-top-up case is being fixed.
- **#5** (records, this update).

Next: **#6** (the story config and presets).

**Vercel checks (the 22:42 brief):**

1. **One project:** `graphpay-event` is linked to the repo (production branch `main`). It is the only Vercel project the repo deploys to; the next build's GitHub status will name it.
2. **Build:** root directory `apps/web`, framework Next.js, Node 22.x. The production build is green from the CLI. The first Git-triggered builds arrive with #6.
3. **Skip unneeded builds:** the ignored-build step is set. Only commits touching `apps/web`, `packages/`, the root manifests or the lockfile build; docs commits skip. Tested.
4. **Required checks:** branch protection requires only `ci`. Vercel stays out, so a skipped or queued build never stalls auto-merge.
5. **Public link:** only https://graphpay-event.vercel.app answers without a login (200). The team alias and generated URLs need a login (302). Rule in `CLAUDE.md`: links and QR codes use the production domain, never `VERCEL_URL`.
6. **Secrets:** server-only values go to Vercel as Sensitive, never under `NEXT_PUBLIC_`. Fork deployments need approval (`gitForkProtection` on).
7. **Production address:** `graphpay-event.vercel.app` today. `graphpay.vercel.app` answers `DEPLOYMENT_NOT_FOUND`: nothing holds it now, but it is only certain to be free once added. Not added; the founder picks.
8. **Close-out:** the Vercel GitHub link is closed in OPEN.md.

**Seeding numbers (the large city, ADR-0049):**
- tGLM for one M seeding: about 6.3–8.5. W_SEED_M_EVENT already holds 8.5.
- Wall-clock for one M seeding: about 100–130 minutes.
- **Latest safe start: Fri 14:00 IST.** That leaves 130 minutes of seeding, 30 minutes of checks and 60 minutes of margin before the 18:00 freeze.
- The seed reads the story's `syntheticCity`, the cast and its scenario rates, `products`, `renewal`, `locations` and `city`.
- The background city **cannot** seed before the cast is final: the generator ranks the cast shops 1–3 and writes the persona's purchases. A second M seeding needs another faucet claim.

**Secrets hygiene:** proven with a fake Ankr URL built at run time. The prompt-log hook masks it before writing, and the pre-commit scan refuses the commit (`ankr-api-key-in-url`). CI runs the same scan.

**Preset probe (22:54):** all three presets were accepted.
- `testing` 2.2 s and `video` 1.6 s (Opus 5.5, xhigh).
- `live` 0.9 s (Haiku 5.5, xhigh), and three turns at 0.9 / 0.9 / 1.9 s.
- No empty reply and no `max_tokens` stop. Once, Haiku returned the same answer in two text blocks; agents read only the final block.
- Total $0.0012.

**Mirror:** it runs under `caffeinate -ims -w <pid>` and must resume from its last processed block (ADR-0056). Main checks this when Join starts it.

## payments

Not started (T1, wave 1).

## identity

Not started (T2, wave 1).

## arkiv

Not started (T3, wave 1).

## agents

Not started (T4, wave 1).

## integration

Not started (Join, when M7a merges).

## website

Not started (T5, wave 1). A placeholder page is live at https://graphpay-event.vercel.app.

## records

Not started (main, M14, every 2 hours once the tracks run).

## submission

Not started (main, M17, Friday; submit by Sat 08:00 IST).
