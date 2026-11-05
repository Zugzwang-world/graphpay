# Relay: website (T5 Web)

Updated 01:30 IST, Fri 6 Nov. Step: **M15 shell** (branch `web/shell`).

## In plain words

The website's skeleton now exists and builds. On a laptop it shows Vitalik's phone on the left, Kesar Kingdom's phone on the right and a step-by-step explainer in the middle, with a top bar of live chips (the three chains' latest blocks, mirror lag, relayer balance, the token, a lock, sound, race mode). On a phone, each screen opens on its own page (`/customer`, `/merchant`, `/explain`, `/race`), and QR codes on the stage point to those pages on the public domain.

What works today: the layout at desktop, tablet and phone widths; the three chain-head chips (read live from the RPCs); the passcode lock; the tiffin-bot avatars; race mode's two cards (reads and bytes per side); the "how it works" page; every explorer link builder.

What does not work yet, on purpose: anything that needs another track's code. Those panels say, in words, which milestone they wait for (the shop and facilitator, the ENS pause, GraphQL and explain, the live race, the agents, the mirror). Nothing is faked: a button that would spend money asks for the passcode, then answers "not live yet" until its route is wired.

What the founder must do: nothing now. The Coordinator needs `DEMO_PASSCODE` set in Vercel (at least 24 characters); until then every spending route refuses ("spending is off").

## Technical

- **Pages** (`apps/web/app`): `/`, `/customer`, `/merchant`, `/explain`, `/explain/[explainId]`, `/order/[orderId]`, `/race`, `/how`. Components in `apps/web/components`, pure code in `apps/web/lib`.
- **Story and infrastructure values come only from `@graphpay/config`** (`lib/site.server.ts` builds one model: cast, ENS names, products, prices, request text, renewal, explorers, token). `pnpm check` is clean (no story literal or address in code).
- **Passcode guard** (`lib/passcode.ts`): `X-Demo-Passcode` header only, SHA-256 digests compared with `timingSafeEqual`, 401 if missing or wrong, 503 (spending off) if no passcode of at least 24 characters is configured. Every POST route calls it first. `lib/routes.test.ts` is acceptance F2 for the website: it imports every route file and calls it without, with a wrong, and with the right passcode, and checks the route table against the files on disk.
- **Routes**: `GET /api/status` (live heads via `resolveRpc`, chain-id checked, CDN 2 s) and `POST /api/passcode` are live. The rest follow `WEBSITE_SPEC.md` §7 and answer 503 `{error: 'not live yet', waitingFor}` after the passcode check until wired. T1's and T3's routes are not touched.
- **Streams** are read with `fetch` (`lib/sse-client.ts`) so a 503 JSON refusal is visible; polling pauses on hidden tabs (ADR-0055).
- **Explorer links** (`lib/explorer.ts`): a value that is not a 32-byte hash, 20-byte address or number gets no link. Arkiv's explorer routes were read from its own bundle (`/tx`, `/entity`, `/address`, `/blocks`, `/entity-explorer?q=`); recorded in `docs/technical/FACTS.md`.
- **Next config**: `outputFileTracingIncludes` adds the two config JSON files to every function bundle (the trace does not follow `readFileSync`); first Vercel deploy confirms.
- **Tests**: 58 in `apps/web` (explorer, passcode, money, route guard, SSE parser, status chips with a fake RPC); `pnpm test`, `typecheck`, `lint`, `build`, `check` pass on Node 22.23.4.
- **Versions added**: `uqr` 0.1.3 (QR as SVG), `viem` 2.57.16 (declared, unused yet); `docs/technical/VERSIONS.md`.
- **Deviations**: phones scale to the viewport height (≤ 390 × 844); the benchmark table under the race waits for M9's committed numbers (live numbers only, never the lab's).
- **Open risks**: the Vercel build of the shell is unverified until the PR deploys; this Mac's network to some RPCs was flaky, so the chain chips were tested with a fake RPC rather than live.
