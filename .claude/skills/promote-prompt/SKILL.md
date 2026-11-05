---
name: promote-prompt
description: Save a founder brief or a prompt that worked, so the thinking partner and later sessions can reuse it.
---

# promote-prompt

1. **A brief the founder attached or typed** that changes the plan: save it on receipt as `docs/thinking-partner/briefs/<HHMM>-<slug>.md` (IST time of receipt). Start with `Received HH:MM IST by <session>`; then the text, with anything secret-shaped removed (`pnpm check` must pass). A pack prompt that already sits in `planning/PROMPTS/` gets a one-line pointer file instead of a copy: `Pointer: planning/PROMPTS/<file> (attached HH:MM IST to <session>)`.
2. **A prompt worth reusing** (a session-start line, a fix recipe): add it to `docs/plan/prompts/<slug>.md` with when to use it, the exact text, and what it produced (PR links).
3. Never edit `planning/`. The raw log in `prompts/raw/` is written by the hook; this skill only curates.
