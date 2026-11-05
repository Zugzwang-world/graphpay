Received 22:48 IST by main (attached by the founder; from the thinking partner).

# Brief: Vercel is connected — checks

From the thinking partner (claude.ai), via the founder. For: main, the M0 coordinator.
File it in `docs/thinking-partner/briefs/` with your usual time prefix.

## Context

- At 22:42 IST the founder connected `Zugzwang-world/graphpay` to the Vercel project `graphpay-event` (team Hrizzup, Pro) in the Vercel dashboard. He linked the existing project; he did not import a new one. The Vercel GitHub app now has access to the repo. OPEN item 1 is done.
- Vercel's Git toggles as he left them: pull request comments on, commit status on, commit comments off, deployment_status and repository_dispatch events off.
- The Supabase GitHub app also has access to the repo. GraphPay does not use Supabase. Leave it untouched.

## Checks

Report each result in NOW.md. Change settings only where this brief says so.

1. **One project only.** Confirm `graphpay-event` is the only Vercel project linked to this repo.
2. **Build.** Root directory and framework point at the web app. The next push builds green, both preview and production.
3. **Skip unneeded builds.** Set Vercel's ignored-build setting so commits that touch neither the web app nor its dependencies (for example `docs/thinking-partner/` updates) don't build. Five tracks will push often; builds must not queue behind docs commits.
4. **Required checks.** Keep Vercel out of branch protection's required checks, so a skipped or queued build never stalls auto-merge.
5. **Public demo link.** Under Vercel's Standard Protection, only production domains are public; preview and generated deployment URLs need a Vercel login. The demo link, both phone views and every QR code must use the production domain. Confirm it opens in a private window with no Vercel login. Don't use `VERCEL_URL` for server-side fetches (it points at a protected generated URL); use the production domain or relative paths. ENS requires a working live-demo link at submission.
6. **Secrets.** Server-only values (the Ankr URL once the founder has stored it, and any key the facilitator needs) go to Vercel from `.env` without printing, never under a client-exposed name (`NEXT_PUBLIC_`, `VITE_` or similar). Confirm deployments from forks need approval (public repo).
7. **Production address.** Report the current production domain, and whether a shorter free vercel.app name (for example `graphpay.vercel.app`) is available. Don't add one until the founder picks; the address goes into ENS records and QR codes.
8. **Close out.** Close OPEN item 1 and update NOW.md.

## Do not

- Import, create or rename Vercel projects.
- Print any secret.
- Touch the Supabase GitHub app.
