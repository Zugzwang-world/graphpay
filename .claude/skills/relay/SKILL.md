---
name: relay
description: Write the end-of-step thinking-partner update (NOW section, relay file, LOG line, OPEN section, briefs) for your activity, judge-safe and secret-free.
---

# relay

Activity names: `foundation`, `payments`, `identity`, `arkiv`, `agents`, `integration`, `website`, `agentpay` (T6), `records`, `submission`. Touch only your own parts of `docs/thinking-partner/`.

1. **`NOW.md`** — rewrite only your `## <activity>` section: `Updated HH:MM IST`; where we are in plain words; what's running; blockers; next. Five to ten lines. (Main alone rewrites the top summary.)
2. **`relays/<activity>.md`** — overwrite with about 800 words: plain language first (what now works, what it means for the demo, what the founder must do), then technical (what was built, PR links, numbers with their sources, transaction links, deviations from the spec and why, open risks).
3. **`LOG.md`** — append one line per PR under `## <activity>`: `- HH:MM IST · <activity> · <result> · <PR link>`. Append-only.
4. **`OPEN.md`** — update your `## <activity>` section: each founder to-do or open question with **what**, **where**, **why** and a **recommendation**; mark settled items closed with the date and the evidence. Main alone edits "Founder now".
5. **`briefs/`** — save any brief the founder attached as `briefs/<HHMM>-<slug>.md` on receipt; a pack prompt (already in `planning/PROMPTS/`) gets a one-line pointer file instead of a copy.

Checks: no secrets, no key-shaped strings, no private URLs (`pnpm check` must pass); judge-safe wording (the repo is public); synthetic data labelled; the folder stays under about 20,000 words (`cat docs/thinking-partner/*.md docs/thinking-partner/*/*.md | wc -w`).
