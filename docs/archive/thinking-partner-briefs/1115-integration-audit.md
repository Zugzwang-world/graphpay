Received 11:20 IST, Fri 6 Nov, by the Coordinator (attached by the founder; from the thinking partner).

# Brief: audit both halves before the website integration

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: the Coordinator (cross-cutting).
File it in `docs/thinking-partner/briefs/` with your usual time prefix.

**Read-only.** Change no code, merge nothing, deploy nothing, send no transaction. Use sub-agents for the heavy reading and keep only their summaries. Start now and report the moment it is done (ADR-0066).

## Why

The founder's team has finished the two phone apps: React 19, Vite 8 and Tailwind 4, on mock data, on their fork `ajatshatru01/graphpay` in `frontend/`. The founder ran it locally on port 5180.

The next step is one working website on `graphpay-event`:
- the team's two phones on the sides;
- T5's under-the-hood explainer in the middle, kept as it is for now;
- T5's other pages;
- our live back end, with the agents running the workflow we have today.

A new worktree session will build it from a brief the thinking partner writes from this audit. Once it works, the founder runs it himself, then tweaks the design, the agents and the explainer.

## Check

1. **The team's front end** (their fork's latest `main`):
   - PR #70 shows merged into our `main`, but `main` has no `frontend/` folder. Say what happened.
   - Which screens, journeys and tests are done, and what is still to come (they said a few commits are left).
   - The adapter seam: every event and action in `src/demo/contract.ts`, and how `DemoProvider` picks the adapter.
   - How components read story data (`src/data/story.json`, imported statically).
   - Whether `npm run build` and `npm test` pass.
2. **The back end and T5's site** (production):
   - Every route and stream the phones need: customer state, merchant feed, shops and quotes, the errand over SSE, pay, refund request, refund, re-order, pause and resume, the Open toggle, renewals, the kill. For each, say whether it is live, or "not live yet" and why.
   - The errand runner on production: wired or not, and what wiring needs (keys, run id, live hooks, the function time limit).
   - Whether any full errand has run on the Haiku live preset.
   - Keys in Vercel Production: present or missing, by name only.
3. **The mapping.** One table: each contract event and action, the route or stream that serves it, and its status (live, gap, owner).
4. **One website.** Options to host the team's phones beside T5's explainer on `graphpay-event`, with your recommendation. It must:
   - keep the team's folder and commits theirs, so their later commits merge cleanly, and bring their commits into our repo under their own names;
   - keep one Vercel project and one production domain, and keep the current address working;
   - take every name, price and prompt from `packages/config/story.json` (ADR-0047), so the story lock stays a config change (for example, generate their story file from it at build time);
   - keep their mock mode for development and tests, with live mode on production and no mock explorer link there;
   - keep every spending button behind the passcode (C6 and F2 keep passing);
   - keep T5's explainer and other pages as they are for now.
5. **Ownership.** Who edits `apps/web` during the integration (the new session), what T5 finishes and hands over (PR #81), and what Join, T1 and T2 add (the runner; subscribe and cancel; the kill), so that no two sessions edit the same file.
6. **The founder's test run.** The keys, wallets and test tokens it needs, and anything only the founder can give (logins, funding, secrets).
7. **Usage.** The plan usage now, and your estimate for the integration on Opus high.
8. **Risks**, most serious first.

## Deliver

- `docs/plan/integration-audit.md`, at most about 1,500 words, including the mapping table.
- A short summary at the top of NOW.md.
- Merge the docs PR promptly and tell the founder it has merged, so he can sync.

## Do not

- Start the integration; its brief comes next.
- Print any secret.
- Push to the team's fork.
