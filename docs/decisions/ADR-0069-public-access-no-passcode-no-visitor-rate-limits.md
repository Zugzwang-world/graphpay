# ADR-0069: Public access: no passcode for visitors, no rate limits for visitors
Status: accepted · Date: 2026-11-06 12:40 IST · Decided by: founder · Source: the thinking partner's support brief `docs/thinking-partner/briefs/1240-coordinator-integration-support.md`

## Decision
- **Visitors meet no passcode.** The site's spending buttons work for anyone. This replaces the passcode rule: the pack's "demo passcode on every spending endpoint" (`planning/SPEC/SECURITY_AND_OPS.md`), pack E-3 for the merchant routes, and the passcode fix in ADR-0068.
- **The keys between our own servers stay:** the facilitator's bearer token, the recorder's token, the cron secret, and every wallet key, on the server only.
- **No rate limits for visitors.** The errand runner drops its six-an-hour cap and keeps one errand at a time.

## Why
The founder wants visitors and judges to try the live demo without a code. These are testnets only. The payer's on-chain pass (100 test USDT a day, ADR-0071), the contract caps and the relayer's floor bound what a visitor can spend.

## Consequences
- **Who acts:**
  - The Integration session lands the switch, so the website stops asking for the passcode.
  - Join then rewrites acceptance C6 and F2: server-to-server routes must still refuse a caller without its token.
  - Join removes the hourly cap.
- **The on-chain bounds now carry the load:**
  - A visitor can use up the payer's daily cap, which resets at 00:00 UTC (05:30 IST).
  - With no hourly cap, a visitor can also run errands back to back, one at a time per server instance. Each production errand costs $0.71 to $3.55 of Kimi's prepaid balance, and an empty balance stops every errand. Watch the balance.
- **Unchanged:** the limits held in each instance's memory, such as one errand at a time and the re-order guard.
