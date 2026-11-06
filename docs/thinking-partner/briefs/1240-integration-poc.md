# Brief: the integration proof of concept

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: the new Integration session (its own worktree). File it in `docs/thinking-partner/briefs/` with your time prefix.

## Goal

This is a proof of concept, not a redesign. On https://graphpay-event.vercel.app, anyone, with no login, runs the whole cycle through the team's two phones, with T5's explainer in the middle, against our live back end. Every partner technology (ENS, Arkiv, Whitechain, Swarm) works at least once.

The team's design, T5's explainer and our back end stay as they are. You only connect them.

## Read first

- `docs/plan/integration-audit.md`, the Coordinator's audit. Follow its option A and its ownership table.
- `frontend/README.md` and `frontend/src/demo/contract.ts`.

Read nothing more than the work needs.

## Rules

1. **Minimal usage.** No design work, no restyling, no features beyond wiring, and no refactors outside your files. Use sub-agents only for heavy reading.
2. **Their folder is theirs.** Never edit `frontend/`. If you need a change there, write it in OPEN for the team.
3. **One source of story.** Every name, price and prompt comes from `packages/config/story.json`, projected into their story shape when the site builds.
   - The later swap (Grok's assets: dosa, BKC, new shop names, photos, agent figurines) must be a config and asset change, with no code change.
   - So pass through optional fields such as product images and agent avatars. They stay empty for now.
4. **Public access** (founder decision): no passcode anywhere a visitor goes.
   - Do it in one place: make the passcode check a no-op behind a config switch, not route by route.
   - The keys between our own servers (the facilitator, the recorder, the renewal cron) stay.
   - Run the reviewer on this change. Join rewrites C6 and F2 to the new rule.
5. **Kimi, sparingly.** Develop on the existing mocks. Run at most five live errands in the whole session, each one to prove a step.
6. **Hide what isn't built.** In live mode, hide subscribe and cancel, the kill, the cap actions, decline and reset until T1 and T2 build them.
7. **Don't break today's site.** Build the new stage at `/live` until phase 3 passes, then make it the home page.
8. **Usage line** (founder decision): merges and real payments are allowed up to 97% plan usage. At 97%, stop at a clean point and write `docs/sessions/integration/resume.md`.
9. **Small PRs with auto-merge.** Pin the team's commit you build on in each PR.

## Phases

Merge each phase and check it live before you start the next.

1. **The phones on our site** (option A):
   - `apps/phones/` builds their phone components with their own toolchain, wrapped in our live adapter, into `apps/web/public/phones/`.
   - A copy of T5's stage at `/live` frames the two phones, with the explainer in the middle.
   - It shows live read-only data: customer state, the merchant feed, the shops and the map.
   - Ask the Coordinator to squash-merge PR #70, credited to ajatshatru01, when you need it.
2. **The errand:**
   - Vitalik's ask on the customer phone calls `/api/agents/run`.
   - The adapter maps the run's frames to their events.
   - Both phones and the explainer's lanes follow the run, with the run id posted to the page.
   - Make one live paid errand once the Coordinator says the payer's pass is 100 and the errand pays reliably.
3. **The money buttons that exist:** refund request, merchant refund, re-order, dispatch, pause and resume, and the Open switch. Use each one once, live.
4. **Swarm and close-out:**
   - One menu item's image comes from Swarm through its Arkiv pointer (T3 uploads it) and shows on Vitalik's phone.
   - Make `/live` the home page.
   - Write `docs/sessions/integration/test-script.md`, a click-by-click script for the founder's run.
   - Start `docs/thinking-partner/relays/phones.md` (under 800 words), a `phones` section in NOW, and LOG lines as usual.

## Done when

In a private window on the production address, with no login:

- Vitalik's ask runs the real errand:
  - the shops are compared and the trap is vetoed;
  - 4.80 is paid, with a real explorer link;
  - the shop's phone shows the order live;
  - the explainer's lanes fill.
- Refund request, refund, re-order, dispatch, pause and resume, and the Open switch each work once.
- One image loads from Swarm on Vitalik's phone.
- Nothing on screen says mock, and unbuilt actions are hidden.
- The team's tests and our checks pass, and `frontend/` is unchanged.

## Not now

These come later, cheaply, after the founder's run:
- Grok's assets and the dosa and BKC story swap.
- Agent animations, more on Swarm (the live refund photo), and polish for the explainer and the screens.
- The kill, subscriptions and caps.
- Self-healing extras, and Kimi tuning.
