# Relay: phones (Integration), 22:30 IST, Fri 6 Nov

## In plain words

- The Integration session was the proof of concept. It put the team's two phone apps on our real site, on live data, in four phases. All four are live.
  - **Phase 1:** the phones on the site, read-only.
  - **Phase 2:** Vitalik's ask runs the real errand, and the middle follows it.
  - **Phase 3:** the money buttons: refund request, the shop's refund, re-order, dispatch, pause and resume, and the Open switch.
  - **Phase 4:** the stage is the home page, https://graphpay-event.vercel.app, with no login and no passcode.
- By 17:46 IST every button had worked live once. The refund and the re-order needed T5's fixes.
- The Booth sessions built on this: the dosa story, the deck in the middle, the figurines and photos.

## Technical

- Phase 1 [#111](https://github.com/Zugzwang-world/graphpay/pull/111); the Vercel build fix [#116](https://github.com/Zugzwang-world/graphpay/pull/116); public access, ADR-0069 [#117](https://github.com/Zugzwang-world/graphpay/pull/117); phase 2 [#122](https://github.com/Zugzwang-world/graphpay/pull/122); phase 3 [#124](https://github.com/Zugzwang-world/graphpay/pull/124); refund requests reach both phones [#127](https://github.com/Zugzwang-world/graphpay/pull/127); phase 4 [#128](https://github.com/Zugzwang-world/graphpay/pull/128); records [#133](https://github.com/Zugzwang-world/graphpay/pull/133). T5's fixes: [#129](https://github.com/Zugzwang-world/graphpay/pull/129), [#131](https://github.com/Zugzwang-world/graphpay/pull/131).
- `apps/phones/build.mjs` builds the team's `frontend/` with their Vite into `apps/web/public/phones/`, with a projection of our story config.
- `apps/phones/src/live-adapter.ts` reads our routes and posts the actions. `errand.ts` maps the run's stream to the phone's events; it is tested on a recorded paid run.
- Public access: `site.publicAccess` turns the passcode off for visitors. The keys between our own servers stay. Visitor guards: refund and dispatch act only on the persona's orders, once per 30 s per order; pause and resume once per 20 s.
- Proven live: the errand (4.80 in about 107 s), the Open switch, the refund request, the shop's 0.80 refund, the re-order, pause and resume. Dispatch is automatic.
- The founder's script, `docs/sessions/integration/test-script.md`, predates the dosa story (it says gulab jamun and a 1.20 re-order). Use the Booth's `docs/sessions/booth/demo-note.md`.
- Open for the team (OPEN, phones): hide unbuilt actions, label sample orders, optional repeat buyers, a receipt card for a re-order. The pause switch came with #132; product photos with the Booth's #140.

## State

- **Idle; phases 1 to 4 done.** Session `local_7268b4b1-7f52-4fe6-9652-329b9a9c97de`.
- Resume file: none of its own. Its records: the PRs above and `docs/sessions/integration/test-script.md`.
- Next step: none queued; the stage work moved to the Booth sessions.
