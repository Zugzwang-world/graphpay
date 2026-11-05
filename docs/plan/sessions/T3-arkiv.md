# T3 Arkiv

Activity `arkiv`; your own worktree; branches `arkiv/*`. Read `CLAUDE.md` and `planning/README.md`, then each prompt and its inputs.

## Goal and milestones, in order

The money graph on Arkiv: the safe writer, the engine (GraphQL, explain, hosted MCP), the synthetic city, the live benchmark.

| step | prompt (`planning/PROMPTS/`) | also apply |
|---|---|---|
| M7a model, writer, ArkivSim | `07a-graph-model-writer.md` | `docs/plan/amendments/M7-arkiv.md`, which wins where they differ: conventions, W_DIRECTORY, readonly edges, the `shop` directory, quotes, the box query, `arkiv/schema.md`; ADR-0033 to ADR-0035, ADR-0040, ADR-0041; the SDK boundary of ADR-0057 |
| M7b engine, GraphQL, explain, MCP | `07b-graph-engine-graphql-mcp.md` | `M7-arkiv.md` §6 (discovery) and §8 (the hosted MCP; ADR-0037) |
| M8 city and seeding | `08-city-and-seeding.md` | `M7-arkiv.md` §3 and §8: size S only (ADR-0049); ADR-0043, ADR-0050 |
| M9 live benchmark | `09-live-benchmark.md` | `M7-arkiv.md` §8: reads, not speed (ADR-0042) |
| Friday | `docs/plan/MASTER_PLAN.md` §4 | items 1 (heartbeat and handoff entities), 4–5 (Swarm; ADR-0039), 6 (the demo cast's `shop` rows), 10 (the link builder), 15 (`arkiv/` drafts), 18 (publish the SDK as `@graphpay/arkiv-graph`; ADR-0057) |

## Gates

- M7a needs only M0; M7b and M8 need M7a; M9 needs M7b and the S city. Friday item 5 needs item 4 to pass and the wrapping key from the Coordinator. Friday item 18 starts after CP4's acceptance run; the publish waits for the founder's npm login, which the Coordinator asks for.
- Others wait on M7a (T1's recorder, Join's M11) and M7b (Join's M12, T5): ship M7a first, small.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`, so end yours the same way. Meanwhile build what the gate does not block.

## Owns

`packages/arkiv-graph` (`@graphpay/arkiv-graph`, the generic SDK), `packages/money-graph` (`@graphpay/money-graph`, GraphPay's payment model over it; ADR-0057), `packages/city`, `bench/`, `apps/web/app/api/{graphql,explain,mcp}`, `arkiv/schema.md`, the drafts of `arkiv/friction.md`, `how-you-use-arkiv.md` and `swarm.md` until Submission takes them, `docs/sessions/arkiv/`. In the Coordinator's `packages/config/`, only the `arkiv` writer addresses, by a PR that says so.

## Acceptance checks

`planning/ACCEPTANCE_TESTS.md` D3–D6 (D6 as amended: calls exact, times not scored); D7 stays `blocked: waiting for the locked story` until the Coordinator's M load. From `docs/plan/ACCEPTANCE_ADDITIONS.md`: D8, D9, D10, B8's tool list, A7, A8; on Friday D11, D12, D13, D14.

## The specific rules for this session

- Code against the installed SDK types (`docs/technical/FACTS.md`, Arkiv SDK API notes).
- **The SDK boundary (ADR-0057):** nothing payment-specific in `packages/arkiv-graph`; the developer defines nodes, edges and totals (views); GraphPay code imports only the package's exports, never deep paths; a boundary test enforces it.
- Every city parameter, name and location comes from `packages/config/story.json` (ADR-0047).
- As soon as M7a has merged, seed **size S only, with the test story**, in the background.
- **Never seed size M.** The Coordinator runs your driver for M after the founder locks the final story (ADR-0049): write its exact dry-run and real commands in `docs/sessions/arkiv/seeding.md`.
- Every edge is created readonly and never patched. Receipts "cannot be edited", never "permanent" (ADR-0052); reports say "2 reads against N", never seconds.
- Never run a local W_DIRECTORY script while the site is live (ADR-0033).
- Short of time: Swarm goes first and map heartbeats second (ADR-0053); the 48-against-2 race is never cut.

## Open items from other sessions (the Coordinator adds; T3 closes them by PR)

- **03:10 IST, from Join (PR #20): a bug in merged `packages/money-graph`.** `publicClient.getEntity()` returns the columns under `$attributes`, but `recordEdge` (`src/recorder.mjs` ~L43), `src/quotes.mjs` ~L27 and the ledger's unstreamed verifier (`src/ledger.mjs` ~L103) read `e.attributes`, so their found-by-nonce check is always false. After an uncertain send, `recordEdge` resends and the same refusal ref gets a second edge (Join's fold guard keeps it from counting twice). Fix: `e.$attributes ?? e.attributes` in each, plus an ArkivSim test that the resend path finds the existing entity. T1's M3 recorder depends on it.

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: your next milestone, then your Friday items (before CP4, additive with no-op defaults). Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`arkiv`**, in each step's PR (skill `relay`): your `arkiv` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/arkiv.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Opus 5.5 at **xhigh**: the critical path (writer, engine, seeding).
