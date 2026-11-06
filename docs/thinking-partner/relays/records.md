# Relay: records (the Coordinator), 10:40 IST, Fri 6 Nov: the handover to a fresh Coordinator

## In plain words

The first Coordinator is handing over to a fresh Coordinator session, at the founder's request. Everything the new session needs is in `docs/sessions/records/resume.md`: the work in flight, each session's state, the open decisions and every standing rule.

**What is true now:**
- The core works on the real testnets. Acceptance stands at 45 pass, 0 fail, 1 blocked (D7, the large city, which waits for the story) and 2 not run. B7 and B9 have merged since and go into the next run.
- **Both SDKs are on npm:** `@graphpay_ethglobal/arkiv-graph` 0.1.0 and `@graphpay_ethglobal/agentpay` 0.1.0. Each was installed from the registry into an empty folder, and its quickstart passed. Developers at the venue can try them now.
- **The agents now run on Kimi** (ADR-0067). The founder stored the key through the hidden prompt, and the secret scan recognised it. The key is also on Vercel Production as a Sensitive value. T4 is running the calibration: three errands per preset, with seconds and cost.
- **The website plan changed** (ADR-0068):
  - The founder's team has its own site (#70). T5 stopped building screens and now reviews and integrates the team's site.
  - The review asks for five fixes before merge.
  - The live errand runner (Join, #88) runs on the server only, uses the live preset only, keeps every guardrail and holds its keys only on Vercel. It is merged and live on production on Kimi.
  - On Kimi the agents don't complete a purchase yet: the concierge stops at a plan. T4 is fixing this.

**What the founder does next** (`OPEN.md`, "Founder now"):
1. Lock the story. The demo cast and the large city's seeding start at once.
2. Top up Kimi ($10 recommended).
3. Pass T5's five fixes to the team.
4. Start the Submission session when usage allows.
5. Send the disclosure if not sent.

## Technical

**PRs this step:**
- #89 is merged: the `KIMI_API_KEY` name, the Kimi secret rule and the validator.
- The handover docs PR (`coord/handover`): this relay, the resume, ADR-0068, NOW, OPEN, LOG and AI_USAGE.

**The secret scan (#89):**
- `kimi-api-key` matches `sk-` and then 32 or more key characters (letters, digits, `_` and `-`). It never matches `sk-ant-`, which keeps the Anthropic label.
- JSON text, as in prompt logs and git diffs, stores a key that starts a line or follows a tab as `\n<key>`. That escape now counts as a boundary in the xai, Kimi, JWT and GitHub rules, so `pnpm check`, the pre-commit hook and F1's history scan all catch such a key. Before #89 they missed it.
- `secrets:set` refuses a Kimi value that isn't Kimi-shaped and reports whether the scan recognises a stored API key.
- Checks: 100/100 script tests; `pnpm check` clean over 794 files; 0 findings over the history of every branch (404 commits).
- The main checkout pulled #89 at once, because the prompt-log hook runs from there.

**npm:**
- arkiv-graph 0.1.0 has 21 files, 42.7 kB packed.
- agentpay 0.1.0 has 32 files, 75.5 kB packed, from `main` at #80. It was published at 10:40 IST, after two approval links lapsed.
- Checked from the registry:
  - arkiv-graph's quickstart printed `grace: { follows: 1n, likes: 2n }` and its explain trace;
  - agentpay's `sweets.mjs` paid 4.80 and `cab.mjs` 3.20 test USDT on a local anvil fork.
- The main checkout needed `pnpm install` before pnpm could rewrite agentpay's three workspace devDependencies. Those are test-only and never installed by users. A 0.1.1 should drop them from the published manifest (T6), because they name a scope we don't own.
- The versions and links are now in `FACTS.md`, the README and `arkiv/how-you-use-arkiv.md`. The versions freeze from submission until judging ends.

**Wallets** (`pnpm -s funding --balances`, 10:3x IST):
- FUNDER: 2.5948 WBT, 0.2749 Sepolia ETH, 15.08 tGLM and about 15.54 test USDT.
- W_SEED_M_EVENT: 8.5 tGLM for the large city.
- The two disposable wallets for the video and the pitch, DISPOSABLE_2 and DISPOSABLE_3, have keys but no funds. They also need adding to `wallets.fresh` and to the funding plan (0.005 WBT and 1 test USDT each) before a real funding run.

**Sessions:**
- Working: T4 (calibration) and Join (runner merge).
- Idle and waiting for the story lock: T1, T2 and T3.
- Waiting for the team's fixes: T5.
- Waiting for venue feedback: T6.
- Plan usage is 86%, with the pause at 92% and the reset at 21:30 IST.

**Stopped at handover:** the first Coordinator's tick and its background tasks, so only one Coordinator runs.

## Problems

- **npm's web approval expires after about 5 minutes.** Two agentpay links lapsed while the founder was storing the Kimi key. Lesson: start the publish only when the founder is at the browser.
- **The prompt-log hook only masks Kimi keys once the main checkout has the rule.** The founder's first `secrets:set` was refused ("not a name in env.example") until the main checkout pulled #89. The order now is merge, then pull, then store.
