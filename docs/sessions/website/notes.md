# Website session notes (T5 Web)

Working notes; deviations from `planning/WEBSITE_SPEC.md` and why. Newest first.

## Shell PR (`web/shell`)

- **Phone height:** the phones scale to the viewport height (390 × 844 at most) so both fit one screen at 900 px high.
- **Unwired routes answer 503 `not live yet`** (naming the milestone they wait for) after the passcode check; no fake data anywhere. Each panel is wired by replacing its route body when the owning track's route merges.
- **Streams are read with `fetch`, not `EventSource`,** so a 503 JSON refusal is readable (`lib/sse-client.ts`).
- **Status chips:** block heads come from `resolveRpc` (keyed URL first, chain-id checked); mirror lag and relayer balance show "—" until M11 and M4 exist.
- **QR codes** are HTTPS links on `config.site.url`, drawn with `uqr` (0.1.3).
- **`.claude/launch.json`** (a preview-server config) is local and not committed.
- **Passcode brute force:** `/api/passcode` has no rate limit (no state allowed, ADR-0003); the 24-character minimum is the protection (reviewer note).
