# Relay: arkiv (T3 Arkiv), 22:30 IST, Fri 6 Nov

## In plain words

- The money graph on Arkiv remembers every payment, refusal, refund request and quote. Any agent can ask it before it pays, and each answer comes with an explain trace of every read.
- The city is size S: synthetic history, labelled as such.
- Each shop's menu is a file on Swarm; Arkiv holds its link and hash.
- The SDK `@graphpay_ethglobal/arkiv-graph` 0.1.1 is on npm: https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph
- **Tonight's fault, fixed:** at about 21:36 IST our Arkiv access key ran out of quota, so the site's reads failed. T3's #148 repeats a refused read on the keyless public endpoint. Reads came back at 21:54 IST.
- Still to do, on the founder's word: the big city (size M), the new shops' history under new names, and the category, which still says "sweets".

## Technical

- The SDK and the money graph: [#14](https://github.com/Zugzwang-world/graphpay/pull/14) (M7a). The S city, the engine, GraphQL, explain and the hosted MCP: [#21](https://github.com/Zugzwang-world/graphpay/pull/21) (M8, M7b). The benchmark at S: [#31](https://github.com/Zugzwang-world/graphpay/pull/31) (M9). Activity rows: [#35](https://github.com/Zugzwang-world/graphpay/pull/35).
- Fixes: [#25](https://github.com/Zugzwang-world/graphpay/pull/25), [#30](https://github.com/Zugzwang-world/graphpay/pull/30) (the synthetic label), [#97](https://github.com/Zugzwang-world/graphpay/pull/97) (the writer never adopts another instance's transaction).
- npm: [#74](https://github.com/Zugzwang-world/graphpay/pull/74) (0.1.0), [#98](https://github.com/Zugzwang-world/graphpay/pull/98) (0.1.1).
- Swarm: [#82](https://github.com/Zugzwang-world/graphpay/pull/82) (menus), [#86](https://github.com/Zugzwang-world/graphpay/pull/86) (refund evidence dropped on purpose), [#109](https://github.com/Zugzwang-world/graphpay/pull/109) (an optional menu image). The Booth re-published the dosa menus with one dish image ([#135](https://github.com/Zugzwang-world/graphpay/pull/135)); references in `docs/sessions/arkiv/swarm-menus.json`.
- Judges' drafts: [#77](https://github.com/Zugzwang-world/graphpay/pull/77) (`arkiv/friction.md`, `how-you-use-arkiv.md`, `swarm.md`). The Submission session finishes them.
- The quota fallback, [#148](https://github.com/Zugzwang-world/graphpay/pull/148): `arkivTransport({ fallbackUrl })` repeats a 429 `QUOTA_EXCEEDED` on the public Rabdi endpoint, stays there 10 minutes, then tries the key again. Web routes, the mirror and the runner all use it. Problem log: P-arkiv-4.
- Keep `ARKIV_ACCESS_KEY` on Vercel: the live runner requires it.
- Open:
  - a quota reset or a new key from the Arkiv team (the founder); the keyless endpoint allows 2,000 calls per window;
  - size M: 100 to 130 minutes of seeding from W_SEED_M_EVENT (8.5 tGLM), dry run first (`docs/sessions/arkiv/seeding.md`), then D7. At S the race is about 2 reads against 5 to 6;
  - the new names and the category: directory rows and graph nodes together;
  - the SDK's README does not link the demo app yet (ADR-0076).

## State

- **Idle after #148.** Session `local_949a2091-02b7-4f63-9c71-efebf8fe215a`.
- Resume file: `docs/sessions/arkiv/resume.md` (09:42 IST; older than Swarm, the image and #148).
- Next step: on the founder's word, the M seed or the new names and category.
