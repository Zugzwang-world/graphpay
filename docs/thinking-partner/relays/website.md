# Relay: website (T5 Web), 22:30 IST, Fri 6 Nov

## In plain words

- T5 built the site's routes and views: everything the phones call, the explainer, race mode, the map, the order trail, and the checkout kit with its demo store.
- Since the founder's change of plan (ADR-0068), T5 builds no new screens: the team's phones are the screens. T5 reviews the Integration PRs and every team PR; the Coordinator squash-merges a team PR after that review.
- Its two fixes on first real use made every phone button work: the shop's refund and dispatch ([#129](https://github.com/Zugzwang-world/graphpay/pull/129)) and the re-order ([#131](https://github.com/Zugzwang-world/graphpay/pull/131)).
- Pause and Resume are public, so any visitor can pause the payer (it happened at 15:45 and 21:24 IST). Making them presenter-only is the founder's call.
- Not built: Subscribe and Cancel (they need T1's endpoint), the kill button (it needs T2's provisioning), and the `graphpay-store` Vercel project.

## Technical

- Routes the phones call (`apps/web`): customer state [#44](https://github.com/Zugzwang-world/graphpay/pull/44); Pause and Resume [#43](https://github.com/Zugzwang-world/graphpay/pull/43); the Open switch [#39](https://github.com/Zugzwang-world/graphpay/pull/39); Mark dispatched and Refund [#65](https://github.com/Zugzwang-world/graphpay/pull/65); Request refund [#73](https://github.com/Zugzwang-world/graphpay/pull/73); Re-order [#81](https://github.com/Zugzwang-world/graphpay/pull/81); the run route [#17](https://github.com/Zugzwang-world/graphpay/pull/17).
- Views: shell [#10](https://github.com/Zugzwang-world/graphpay/pull/10), phone views [#13](https://github.com/Zugzwang-world/graphpay/pull/13), order stream and CSV [#23](https://github.com/Zugzwang-world/graphpay/pull/23), order trail [#26](https://github.com/Zugzwang-world/graphpay/pull/26), race [#36](https://github.com/Zugzwang-world/graphpay/pull/36), map [#54](https://github.com/Zugzwang-world/graphpay/pull/54), lanes [#55](https://github.com/Zugzwang-world/graphpay/pull/55).
- Checkout kit and demo store (M16): [#51](https://github.com/Zugzwang-world/graphpay/pull/51); one real kit payment: [#63](https://github.com/Zugzwang-world/graphpay/pull/63).
- After the integration: [#104](https://github.com/Zugzwang-world/graphpay/pull/104) (the feed and the CSV keep the newest rows), [#113](https://github.com/Zugzwang-world/graphpay/pull/113) (read limits raised tenfold), [#125](https://github.com/Zugzwang-world/graphpay/pull/125) (resume file), #129 (refund and dispatch sign locally: the 502), #131 (re-order pays through the hosted shop's own x402 path: the 409 `BAD_402`).
- Open (details in the resume file):
  - three guards proposed, not built: one Open write per 10 s, a cooldown between errands, and a daily cap with a reason allowlist for refund requests. Public access makes them matter more;
  - #124's review notes, not yet sent: misleading refusal texts (`TOO_SOON`, `NOT_THIS_ORDER`, a raw `BAD_REASON`), and the Open renewal runs once per open merchant tab;
  - a refund reason is free text on the public graph;
  - the store's CSV row for the kit payment.

## State

- **Idle; the reviewer of team PRs.** Session `local_e34793ca-bfc1-4489-8340-07a90fc9b703`.
- Resume file: `docs/sessions/website/resume.md` (16:58 IST; its item 0, the `BAD_402`, is fixed by #131).
- Next step: review the next team PR (CI, `pnpm check`, the secret scan, the reviewer agent on anything that spends); then the Coordinator squash-merges it.
