# Relay: arkiv (T3)

Updated 03:50 IST, Fri 6 Nov. This step: Friday item 1, the activity rows (branch `arkiv/activity`).

Merged before it:
- M9, the live benchmark: [PR #31](https://github.com/Zugzwang-world/graphpay/pull/31), 03:45. D6 passes. The city-wide top 10 takes Graph Arkiv 2 reads against plain's 5, or 6 in parallel. See `bench/BENCHMARK-LIVE.md`.
- The synthetic label on reputation: [PR #30](https://github.com/Zugzwang-world/graphpay/pull/30), 03:41.
- Join's `$attributes` fix: [PR #25](https://github.com/Zugzwang-world/graphpay/pull/25), 03:23.
- M8 S and M7b: [PR #21](https://github.com/Zugzwang-world/graphpay/pull/21).
- M7a: [PR #14](https://github.com/Zugzwang-world/graphpay/pull/14).

## In plain words

The map and the explainer need to show what is happening right now: which shops are open, which agents are at work, and which agent just handed the errand to which. On Arkiv, "right now" is a row that expires. Each of these is a short-lived row, written by the directory wallet. It stays alive only while something renews it, and it disappears by itself afterwards. Nobody has to clean up, and a crashed server cannot leave a shop showing "open" forever.

- **A shop's Open toggle:** the row lives 15 minutes and is renewed while the toggle is on. Turning it off takes the shop out of "open now" at once; the row is gone within 15 minutes.
- **An agent at work:** the row lives 15 minutes, renewed while it runs. It cannot be edited, only extended.
- **A handoff between two agents in one errand:** the row lives 30 minutes and cannot be edited. It feeds the explainer's agent lane.

GraphQL can now ask three new questions: which shops nearby are open now (one extra read), which agents are online for a person or a run, and the handoffs of a run in order. Every row has a key, so the website can link each dot and chip to its explorer page.

Nothing writes these rows yet. The website's Open toggle (T5) and the agent run (T4/T5) need to call them; that request is in OPEN.

## Technical

- **Model** (`packages/money-graph/src/model.mjs`):
  - `shop_open`: `shop_key`* key, `shop_ens`, `open_until` u64; mutable.
  - `agent_presence`: `agent_ens`*, `owner_ens`*, `role`, `session`*; readonly.
  - `handoff`: `request_id`*, `from_agent`, `to_agent`, `step`; readonly.
  - The index lists are in `QUERIES` (ADR-0041 test). All three are trusted from W_DIRECTORY only. `LIFETIME` gains `openMinutes` and `presenceMinutes` (15) and `handoffMinutes` (30).
- **Writes** (`src/activity.mjs`):
  - `openShop` creates the row, or finds it by `shop_key`, then patches `open_until` and extends it. `closeShop` sets `open_until` to now.
  - `markPresence` creates the row, or extends it by key. A lapsed row is created again.
  - `recordHandoff` creates the row.
  - `activityHooks(conn)` gives `runErrand` its `presence` and `handoff` hooks, with one presence row per agent and run.
- **Renewal rule:** read `$expiresAt` and the head (uncached), and extend only if the row ends before head + lifetime. An extension sets `max(current, now + lifetime)`, so it never goes past now + 15 min.
- **Shared wallet:** every create and renewal passes `verifyRecovered`, which checks its own values (W_DIRECTORY's nonces are shared across Vercel instances; P-arkiv-1).
- **Reads:**
  - `openShopKeys`, `agentsOnline`, `handoffsFor`, each owner-scoped.
  - GraphQL `shops(openNow: true)`: one `queryAny` over `shop_key`; a shop counts only if its `open_until` is still ahead.
  - GraphQL `agentsOnline(owner | session)` and `handoffs(requestId)`, oldest first by `$createdAt`.
  - `Presence` and `Handoff` link to `Node`s.
- **Bug caught by the tests:** viem caches `getBlockNumber()` for a few seconds. A renewal then saw a stale head and skipped the extension. It now reads with `cacheTime: 0`.
- **Tests** (`test/activity.test.mjs`, 3 tests on ArkivSim):
  - Open, renew (found by key, never past now + 15), `openNow` in 2 reads, off, lapse.
  - Presence readonly, renewed, online by owner, gone, re-created.
  - Handoffs ordered, readonly, a spoofed wallet's row never read, gone after 30 min; the hooks write one presence row per agent and run.
  - Totals: money-graph 19, city 18, arkiv-graph 23, agents 64; `pnpm check` and the web typecheck clean.
- `arkiv/schema.md` has the three rows.

**Deviations:** none from item 1. "Agents online" takes an owner or a run id: a query must filter on something beyond the type, and both are what the explainer knows.

**Next:** Swarm, per the Coordinator's decision. First the menu through the public gateway: public and unencrypted, the reference and a content hash on Arkiv, re-uploaded on a 404, no stamp of ours. Then refund evidence encrypted in our own code (AES-256-GCM, per-file key wrapped with the Swarm key). Refund evidence is the first thing cut if time runs short.
