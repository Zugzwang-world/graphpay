# Website session: resume file (T5 Web)

Start line: `You are T5 Web. Run docs/plan/sessions/T5-web.md. Go.` Then read this file. Written 03:03 IST, Fri 6 Nov.

## State
- **Merged:** #10 the shell (stage, both phones, explainer, race page, how-it-works, passcode guard, F2 tests, live chain-head chips), #13 phone views (request card, spending-pass states, merchant notifications).
- **In PR `web/wire-agents`:** the agent run route (`POST /api/agents/run` streams the errand as SSE in the same request; `GET .../:id/events` replays from memory), the one-at-a-time registry (`lib/run-registry.server.ts`), the runner seam (`lib/agents-live.server.ts`: **no runner until Join's M12**; the route answers 503 "not live yet" naming it), client streaming (`lib/sse-client.ts`, `stream()` in `components/site-context.tsx`).
- Production: https://graphpay-event.vercel.app (Vercel builds only code changes). Preview/local: `.claude/launch.json` is local (untracked): `pnpm --filter @graphpay/web exec next start -p 3917` after `pnpm build`.

## How a panel goes live (the pattern)
Each unwired route is a file under `apps/web/app/api/**/route.ts` that checks the passcode (spending routes) and answers `notLive(waitingFor(path))`. When the owning track's code merges: replace the body with the real call, keep the passcode check first, keep `SITE_ROUTES` (`lib/routes.ts`) accurate (`waitingFor: null` once live), and `lib/routes.test.ts` (acceptance F2) must still pass. The client already handles 503 "not live yet" and shows the milestone.

| route | waits for | notes |
|---|---|---|
| `POST /api/agents/run` | M12 (Join): a runner from the live hooks | set it in `lib/agents-live.server.ts` (`errandRunner()`); map `ErrandResult` as is (`RunResult` matches it); the run is one request, so no cross-instance state |
| `GET /api/state/customer` | M4 checkout, M6 ENS gate | shape: `CustomerState` in `lib/contracts.ts` (add `policyExpiresAt` if the policy has it) |
| `POST /api/customer/{reorder,subscribe,unsubscribe,refund-request}` | M4 shop, facilitator, recorder | return `{ transaction }` or `{ arkivTx }` |
| `POST /api/customer/{pause,resume,kill-disposable}` | M6 | return `{ sepoliaTx, effectiveWithinS: 20 }` |
| `GET /api/merchant/events` | M7b GraphQL, M11 mirror | SSE frames `ready` then `edge` (`MerchantEdgeEvent`); poll GraphQL every 2 to 3 s (ADR-0055) |
| `POST /api/merchant/{dispatch,refund}`, `GET .../export.csv` | M4, M7b | merchant key server-side behind the passcode (E-3) |
| `GET /api/race` | M9 | SSE `call` `{call, ms, bytes}` then `answer` (`RaceAnswer`); rate limit, uncached; the table under the race only from M9's committed numbers |
| `/explain/[id]`, `/order/[id]` | M7b | `ExplainTrace` reads `/api/explain/:id`; `OrderTrail` is a stub to wire to `order(id)` |

## Then
M16 (checkout kit `packages/checkout-kit`, store `apps/store`; needs M4; read `planning/PROMPTS/16-checkout-kit-store.md`), then Friday items 8 to 13 (`docs/plan/MASTER_PLAN.md` §4). Items 9, 10 need T3's `shop_open` and `shops` queries.

## Rules that bit
- Story and addresses only from `@graphpay/config` (`pnpm check` fails otherwise; also in tests).
- Reviewer agent on any spending-endpoint change; records in the same PR (skill `relay`); `git add` specific paths, never `.claude/launch.json`.
- Network to GitHub is slow: retry pushes (`git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=60 push`, up to 6 tries, 15 s apart) and `gh` calls.
- No middle dots in UI strings, no all-caps labels; say "cannot be edited", never "permanent" or "hidden".
