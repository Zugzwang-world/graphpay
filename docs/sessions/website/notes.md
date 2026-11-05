# Website session notes (T5 Web)

Working notes; deviations from `planning/WEBSITE_SPEC.md` and why. Newest first.

## Race mode (`web/race`)

- `/api/race` calls T3's `raceQuestion` per request on a new connection (`lib/race.server.ts`); truth and params from `@graphpay/city` (`generateCity` with `SEEDED_END`, a constant: the seeded city's end day, `2026-11-05`; update on a re-seed). One race per side per instance; `size` other than S is refused (ADR-0049).
- Local type declarations in `apps/web/types/` for `raceQuestion`, `callTap` and `@graphpay/city` (the packages ship no types for them); T3 may replace them.
- The benchmark table is read from `bench/results/questions-S.csv` at build time (the page is static); labels in `app/race/page.tsx` are generic, not story names.

## Merchant stream and CSV (`web/m16-checkout-kit`)

- Reads T3's GraphQL (`node.in/out`) through the shared engine; `lib/merchant-feed.ts` is pure (tests on ArkivSim), `lib/merchant-feed.server.ts` shares one query per 2 s per instance.
- The stream starts 30 s back (an edge lands some seconds after its block) and reconnects with `?since=<last edge ts>`; each stream lasts 50 s.
- **CSV deviation from §4:** no item, kind or Arkiv entity key columns (the GraphQL edge does not carry them; OPEN item for T3); a signed `net_effect_usdt` replaces refunds and net columns, one row per ledger event.

## Shell PR (`web/shell`)

- **Phone height:** the phones scale to the viewport height (390 × 844 at most) so both fit one screen at 900 px high.
- **Unwired routes answer 503 `not live yet`** (naming the milestone they wait for) after the passcode check; no fake data anywhere. Each panel is wired by replacing its route body when the owning track's route merges.
- **Streams are read with `fetch`, not `EventSource`,** so a 503 JSON refusal is readable (`lib/sse-client.ts`).
- **Status chips:** block heads come from `resolveRpc` (keyed URL first, chain-id checked); mirror lag and relayer balance show "—" until M11 and M4 exist.
- **QR codes** are HTTPS links on `config.site.url`, drawn with `uqr` (0.1.3).
- **`.claude/launch.json`** (a preview-server config) is local and not committed.
- **Passcode brute force:** `/api/passcode` has no rate limit (no state allowed, ADR-0003); the 24-character minimum is the protection (reviewer note).

## Run route (`web/wire-agents`)

- **Deviation from `WEBSITE_SPEC.md` §7:** `POST /api/agents/run` streams the run (SSE) in the same request instead of returning `{ runId }` for a separate GET. Why: Vercel can serve the GET from another instance than the one running the errand, and this site has no database to share it; also `EventSource` cannot send the passcode header. `GET /api/agents/run/:id/events` replays a run held by the same instance, best effort.
- **No runner yet:** `lib/agents-live.server.ts` exposes the seam; Join sets it in M12. Until then 503 "not live yet".
- **Single-flight is per server process** (reviewer note): two Vercel instances could each start an errand, giving two relayer nonce streams. The runner Join wires must not rely on this lock for the nonce; the on-chain per-order id and the relayer's own sequencing are the bounds (`planning/SPEC/PAYMENTS_WHITECHAIN.md` §8).
