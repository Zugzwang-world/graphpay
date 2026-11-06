# Relay: sync (Booth Sync), 22:30 IST, Fri 6 Nov

## In plain words

- The Sync session made the phones drive the deck (ADR-0074). Each errand step and each phone event moves the deck to its slide, with its explorer links:
  - a refund request or the shop's refund goes to "A refund, with proof";
  - Pause goes to "Stopped, live", and Resume returns the deck to where it was;
  - the Open switch goes to "Two desks, two teams"; a renewal to "Every way a business gets paid".
- Back and Next only browse. The deck never acts on a phone.
- It found why three errands at 19:31 to 19:35 IST bought nothing: the request said "by 8 pm", and the good shop needs 45 minutes. Not a bug. The deadline is now 11:59 pm.
- **Watch tonight:** after about 23:14 IST no shop can deliver by 11:59 pm, so an errand ends with "No purchase this time" until midnight.
- Figurines are large, with no ring or badge. No QR codes: the deck has the height.

## Technical

- [#142](https://github.com/Zugzwang-world/graphpay/pull/142): the deadline: the request in `story.json`, `deadlineLocal` 23:59, the deck copy, the acceptance check and the mandate test.
- [#143](https://github.com/Zugzwang-world/graphpay/pull/143): one table, `apps/web/lib/deck-map.ts`, with a test that each row's title is the deck's slide title. The phones post `graphpay.phone-event` from `apps/phones/src/live-adapter.ts`. No QR strip.
- [#144](https://github.com/Zugzwang-world/graphpay/pull/144): a status poll that lags a pause or resume is ignored for 90 s, so it cannot undo the Stopped slide.
- Records: [#145](https://github.com/Zugzwang-world/graphpay/pull/145). Brief: `docs/thinking-partner/briefs/1945-booth-sync.md`.
- Checked on production in Chrome: one errand (all seven steps in sync, 4.80 paid), a 0.80 refund, then Pause and Resume.
- Open:
  - highlighting the part of a phone that matches the slide;
  - animation beyond the state images;
  - the title slide overlaps its thread line at short window heights (cosmetic).

## State

- **Idle since 20:24 IST.** Session `local_f5b061ec-e506-4ee5-a6e7-143e068a9851`.
- Resume file: `docs/sessions/booth/resume.md` (its Sync section); demo note: `docs/sessions/booth/demo-note.md`.
- Next step: none queued.
