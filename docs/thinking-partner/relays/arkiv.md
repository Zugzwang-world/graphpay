# Relay: arkiv (T3)

Updated 09:50 IST, Fri 6 Nov. This step: Friday item 18, the SDK publish prep (branch `arkiv/publish-prep`, ADR-0063).

## In plain words

The graph layer we built for GraphPay is now ready to be published for other developers as `@graphpay_ethglobal/arkiv-graph`, version 0.1.0, under the MIT licence. Someone who has never seen our code can follow the README: install it, define a small graph (people who follow and like each other), write events, ask a question, and see the exact Arkiv reads behind the answer. By default that runs in memory with no keys and nothing to fund. The same code points at Arkiv Rabdi with the developer's own testnet key.

It also ships one example that has nothing to do with payments: a leaderboard (players, games, points, a ranked read). That shows the package is a general tool and that GraphPay is one app built on it.

The README credits the other npm package called `arkiv-graph` (by SantiagoDevRel, a viewer for Arkiv entities) and says ours is a different project. `FEEDBACK.md` tells developers how to give feedback (a GitHub issue with the labels `arkiv-graph` and `feedback`) and what we want to learn, and it is a log we fill in.

What you need to do: log in to npm so the Coordinator can publish (the scope `graphpay_ethglobal` must belong to your account). Nothing else is blocked on you. Versions freeze after the submission.

## Technical

- **Rename:** `@graphpay/arkiv-graph` to `@graphpay_ethglobal/arkiv-graph` in `package.json`, every import and the READMEs. 35 files outside the package's own folder also changed in the `import` line only: `apps/web` (`package.json`, `lib/open-toggle.server.ts`), `integration/*`, `packages/city`, `packages/mirror`, `packages/money-graph`. The lockfile was regenerated. Historical records (ADRs, briefs, LOG) keep the old name on purpose.
- **New in the package:** `connect()` (ArkivSim with no URL; with a URL, the chain id you pass is checked before anything is signed; no key means read-only; the URL and key are redacted from errors), `createStore()` (`load`, `write`, `query` with a filter, ordering and an explain trace), `nodeKeyOf()`, `ExpirationTime` re-exported. The helpers use the same writer and read engine GraphPay runs on Rabdi.
- **Package:** version 0.1.0, MIT, `publishConfig.access` public, a `files` list (`index.mjs`, `index.d.ts`, `src`, `examples`, README, CHANGELOG, FEEDBACK, LICENSE), engines Node 22 or newer, dependencies only `@arkiv-network/sdk` 1.0.1 and `viem` 2.57.16 (both from npm). `bugs` points at the issue template.
- **Checks run:** `pnpm pack` gives 20 files, 42 KB, no workspace dependency, no key or keyed URL, no 40-hex address. The tarball installed with npm in an empty folder outside the repo on Node 22.23.4; the README's first code block, the quickstart and the leaderboard ran there. `connect` against Rabdi's public node (read-only): chain 7794095 accepted, chain 1 refused. Tests: arkiv-graph 28 pass (4 new for the store and connect, and the boundary test now also scans the README, CHANGELOG, FEEDBACK and examples for payment words); money-graph 19, city 18, mirror 36 pass; `pnpm check` clean.
- **Not done:** the full API reference (0.1.x); a live write through `connect()` on Rabdi (needs a funded key; the writer under it is the one already used for the seeded city); the labels and template are the Coordinator's.
- **Risks:** totals are absolute values, so one process should write one graph (said in the README). Replay protection after a restart needs events with `position`; without it only the latest event is recognised (said in the README and tested).
