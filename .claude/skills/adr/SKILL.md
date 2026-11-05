---
name: adr
description: Record a decision as a short ADR in docs/decisions/ and add it to the index.
---

# adr

1. Next number: the highest `docs/decisions/ADR-NNNN-*.md` plus one (four digits). If two sessions might collide, re-check after `git fetch origin && git merge origin/main`; on a clash, take the next free number.
2. Create `docs/decisions/ADR-NNNN-<kebab-slug>.md`:

   ```
   # ADR-NNNN: <title>
   Status: accepted | proposed | superseded by ADR-XXXX · Date: YYYY-MM-DD HH:MM IST · Decided by: founder | <session> under the founder's authority · Source: <pack id, brief or evidence>

   ## Decision
   <one to three sentences>

   ## Why
   <the reason, with evidence links>

   ## Consequences
   <what changes, who must act>
   ```

3. Add one line to the table in `docs/decisions/README.md`: number, title, status, date.
4. If it overturns or narrows a pack decision, say which (for example `planning/DECISIONS.md` E-6) and mark the earlier ADR `superseded by`.
