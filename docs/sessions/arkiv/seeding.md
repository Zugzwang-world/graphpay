# Seeding the synthetic cities

Labelled synthetic, straight into Arkiv, no real payments (ADR-0043). **Tonight only size S, with the test story; size M only after the founder locks the final story, never with the test cast (ADR-0049).** The driver refuses `--size M` while `story.json` has `"locked": false`.

Driver: `packages/city/scripts/seed.mjs`. Generator: `packages/city/src/generate.mjs`, every parameter from `packages/config/story.json` (`syntheticCity`, `syntheticCity.generator`, the cast, `locations`, `renewal`). Stores: the graph store (node, edge, tally, link) and the plain store (record, profile) under the size's seed wallet (S: W_SEED_EVENT, M: W_SEED_M_EVENT), and the shop directory under W_DIRECTORY. Manifests and the ground truth go to `docs/sessions/arkiv/city/`.

## Size S (T3, tonight)

| step | command | result |
|---|---|---|
| check on ArkivSim | `fnm exec --using=22.23.4 node packages/city/scripts/seed.mjs --size S --end 2026-11-05 --backend sim` | 91 actors, 12 shops, 1,003 events, 490 pay and renew rows (5 plain pages); row counts equal a direct load; Q1 and the Q2 top 10 equal the truth; estimated live cost 0.45 tGLM graph + 0.16 plain + 0.002 directory (`docs/sessions/arkiv/city/sim-check-S.json`) |
| balances | same with `--backend rabdi` | W_SEED_EVENT 0.9000 tGLM, W_DIRECTORY 0.4998 (01:57 IST) |
| seed graph and plain | same with `--backend rabdi --execute --store graph,plain` | started 01:58 IST; manifests `seed-S-graph.json`, `seed-S-plain.json` |
| seed the directory | same with `--backend rabdi --execute --store directory` | after the generator's neighbourhoods are in the story |

## Size M (W2, Sat 7 Nov, with the final cast; ADR-0077)

1. The cast is pinned, not the whole story: `syntheticCity.sizes.M.cast = "final"` and `syntheticCity.places` (Grok's 120 places). The driver refuses M with any other cast. The city ends at a fixed UTC midnight: `2026-11-06`.
2. Check on ArkivSim, which needs no secrets. Expect about 10,000 events and `countsOk`, `q1ok` and `q2ok` all true. The estimate is in `docs/sessions/arkiv/city/sim-check-M.json`; the lab's M cost 6.3 tGLM before the merged columns.
   ```bash
   fnm exec --using=22.23.4 node packages/city/scripts/seed.mjs --size M --end 2026-11-06 --backend sim
   ```
3. Dry run on Rabdi (balances only; nothing is sent). W_SEED_M_EVENT holds 8.5 tGLM. Stop if it is under 1.2 × the estimate.
   ```bash
   fnm exec --using=22.23.4 node packages/city/scripts/seed.mjs --size M --end 2026-11-06 --backend rabdi
   ```
4. Seed the graph and plain stores (about 2 hours; run it in the background with a log, and never edit the script while it runs). The directory store is held back tonight: the stage's phones poll `/api/map`, whose synthetic-shops query would read the 120 rows on every poll (OPEN, frontend).
   ```bash
   fnm exec --using=22.23.4 node packages/city/scripts/seed.mjs --size M --end 2026-11-06 --backend rabdi --execute --store graph,plain > seed-M.log 2>&1
   ```
5. If the plain store stops, resume it: the same command with `--store plain --resume` (it skips rows already written). If the graph store fails, wipe it and run it again (its tallies are merged per batch, so it is never resumed):
   ```bash
   fnm exec --using=22.23.4 node packages/city/scripts/seed.mjs --size M --backend rabdi --wipe --execute --store graph
   ```
6. Commit `docs/sessions/arkiv/city/` (truth, manifests, the digests in `digests.json`; the `.log` files stay local).

## Progress (size M)

- 00:00 IST, Sat 7 Nov: the graph store started from W_SEED_M_EVENT (8.5 tGLM). Dry run on ArkivSim: 9,996 events, every row count equal to a direct load; estimate about 6.0 tGLM (`sim-check-M.json`).
- SEED_M_RESULT

## Progress (size S)

- 01:58 IST: graph and plain stores seeding in the background from W_SEED_EVENT.
- 02:05 IST: directory done (12 rows, 1 tx). 02:06: graph store done (97 txs, 0.494 tGLM, 8.9 min).
- 02:12 IST: GraphQL checks on Rabdi all pass (`docs/sessions/arkiv/city/check-S.json`).
- 02:13 IST: the plain store stopped after 24 txs on an RPC read timeout; 03:02 resumed with `--resume`; 03:04 done (19 more txs; plain store 43 txs, 0.181 tGLM in all). **Size S is complete.**
