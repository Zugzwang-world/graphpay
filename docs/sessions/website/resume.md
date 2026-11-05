# Website session: resume file (T5 Web)

Start line: `You are T5 Web. Run docs/plan/sessions/T5-web.md. Go.` Then read this file. Updated 05:05 IST (first written 03:03), Fri 6 Nov.

## State
- **Merged:** #10 the shell (stage, both phones, explainer, race page, how-it-works, passcode guard, F2 tests, live chain-head chips), #13 phone views (request card, spending-pass states, merchant notifications).
- **Merged since:** #17 (agent run route), #23 (merchant stream `/api/merchant/events` and `/export.csv` on the live graph; both now `waitingFor: null`). #26 (`/order/[id]` on `order(id)`, explain per-call detail). #36 (`/api/race` live with the benchmark table). **In PR `web/open-toggle`:** Friday item 9, `POST /api/merchant/open` (needs `W_DIRECTORY_PRIVATE_KEY` in Vercel). Branch off `origin/main`; the worktree needed `pnpm install --frozen-lockfile` after the merge.
- **Agent run route (merged #17):** the agent run route (`POST /api/agents/run` streams the errand as SSE in the same request; `GET .../:id/events` replays from memory), the one-at-a-time registry (`lib/run-registry.server.ts`), the runner seam (`lib/agents-live.server.ts`: **no runner until Join's M12**; the route answers 503 "not live yet" naming it), client streaming (`lib/sse-client.ts`, `stream()` in `components/site-context.tsx`).
- Production: https://graphpay-event.vercel.app (Vercel builds only code changes). Preview/local: `.claude/launch.json` is local (untracked): `pnpm --filter @graphpay/web exec next start -p 3917` after `pnpm build`.

## How a panel goes live (the pattern)
Each unwired route is a file under `apps/web/app/api/**/route.ts` that checks the passcode (spending routes) and answers `notLive(waitingFor(path))`. When the owning track's code merges: replace the body with the real call, keep the passcode check first, keep `SITE_ROUTES` (`lib/routes.ts`) accurate (`waitingFor: null` once live), and `lib/routes.test.ts` (acceptance F2) must still pass. The client already handles 503 "not live yet" and shows the milestone.

| route | waits for | notes |
|---|---|---|
| `POST /api/agents/run` | M12 (Join): a runner from the live hooks | set it in `lib/agents-live.server.ts` (`errandRunner()`); map `ErrandResult` as is (`RunResult` matches it); the run is one request, so no cross-instance state |
| `GET /api/state/customer` (live) | subscription waits for M4's subscribe flow; last order's item waits for an edge that carries it | `lib/customer-state*.ts` |
| `POST /api/customer/{reorder,subscribe,unsubscribe,refund-request}` | M4 shop, facilitator, recorder | return `{ transaction }` or `{ arkivTx }` |
| `POST /api/customer/kill-disposable` | T2's `provisionDisposable` + a funded disposable wallet | return `{ sepoliaTx, effectiveWithinS: 20 }` (pause and resume are wired) |
| `POST /api/merchant/{dispatch,refund}` | M4 | merchant key server-side behind the passcode (E-3) |

## Then
After M16 merges: the store's Sunday box (stretch), then Friday items 8 to 13 (`docs/plan/MASTER_PLAN.md` §4). Items 9, 10 need T3's `shop_open` and `shops` queries.

## Rules that bit
- Story and addresses only from `@graphpay/config` (`pnpm check` fails otherwise; also in tests).
- Reviewer agent on any spending-endpoint change; records in the same PR (skill `relay`); `git add` specific paths, never `.claude/launch.json`.
- Network to GitHub is slow: retry pushes (`git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=60 push`, up to 6 tries, 15 s apart) and `gh` calls.
- No middle dots in UI strings, no all-caps labels; say "cannot be edited", never "permanent" or "hidden".
