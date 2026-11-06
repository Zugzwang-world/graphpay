# ADR-0070: One website: the team's phones as static pages inside T5's stage (option A)
Status: accepted · Date: 2026-11-06 12:40 IST · Decided by: founder · Source: `docs/plan/integration-audit.md` §4, option A; the support brief `docs/archive/thinking-partner-briefs/1240-coordinator-integration-support.md`

## Decision
- **The team's folder stays theirs.** Their two phone apps stay in `frontend/`, with their path, their npm lockfile, and their mock dev server and tests. PR #70 was squash-merged under ajatshatru01's name as 8abe39a.
- **Our `apps/phones/` builds their phones.** It builds their phone components with their own toolchain, wrapped in our live adapter, into `apps/web/public/phones/` before `next build`.
- **The story stays in our config.** At build time their story file is swapped for a projection of `packages/config/story.json`.
- **T5's stage hosts the phones** as same-origin iframes, with the Explainer kept in the middle. T5's other pages stay as they are.
- One Vercel project and one production domain.

## Why
The audit found that option A:
- needs no edits in the team's folder, so their later commits merge cleanly;
- keeps Tailwind's reset inside the frames;
- keeps the story a config change (ADR-0047);
- keeps one project and one domain.

Each of options B, C and D breaks one of these: B puts their components in Next pages, C makes their stage the home page, and D adds a second project.

## Consequences
- **This amends ADR-0065 and ADR-0068.**
  - The team's folder is `frontend/`, not `apps/demo-ui`.
  - Option A replaces ADR-0068's fixes (a), (b), (d) and (e). Fix (c), the middle dots and uppercase labels, stays the team's, together with the two story jokes in `copy.ts`.
  - Under public access (ADR-0069) there is no passcode for the adapter to carry.
- **Ownership:**
  - the Integration session: `apps/phones/` and the stage;
  - T5: reviews;
  - the team: `frontend/`.
- **Builds:** `apps/web/vercel.json`'s `ignoreCommand` builds commits that touch `frontend/` or `apps/phones/` (PR #105).
