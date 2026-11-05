# SPEC: The benchmark (plain Arkiv against Graph Arkiv)

The benchmark backs one claim with live numbers: **aggregates cost Graph Arkiv a constant 2 calls while plain Arkiv code must read every payment, because Arkiv has no SUM.** It also states, honestly, where Graph Arkiv does not win. It feeds the website's race mode (`WEBSITE_SPEC.md` §6) and acceptance tests D6–D7.

Everything below is the lab's live run on Rabdi (2026-11-04, founder's Mac, access key, SDK 1.0.1, synthetic data, graph model **before** the event's merged columns). The event re-measures on its own freshly seeded cities. **Quote only numbers measured at the event**, with "synthetic data" and the city size.

## 1. Datasets

| size | transactions | actors | shops | edges (graph store) | plain payment + renewal rows |
|---|---:|---:|---:|---:|---:|
| S | 945 | 91 | 12 | 999 | 462 (5 pages) |
| M | 9,612 | 463 | 40 | 9,874 | 4,604 (47 pages) |

Generator and seeding: `SPEC/ARKIV_GRAPH.md` §8. Two stores per size, each under **its own wallet** (reads filter by owner only): a graph store (names on edges and pair links) and a plain store (one record per event plus one profile per actor, names inline, filter fields indexed, no derived data, no epochs). In the lab, S was under W_SEED and M under W_SEED_M; at the event use fresh wallets, W_SEED_EVENT (S) and W_SEED_M_EVENT (M). Every row `synthetic=true` with a dataset name.

## 2. The six questions

| # | question | type | Graph Arkiv (one GraphQL document) |
|---|---|---|---|
| Q1 | refund rate and 90-day orders for kesar-kingdom | one hop, aggregate | `node(ens)` with its `all` tally and its `last:90` window |
| Q2 | **top 10 shops by sales, city-wide** | aggregate | `top(kind: "shop", by: "paid_micro", limit: 10)` |
| Q3 | Vitalik's agents' spend by shop this week | owner → agents → edges | `node(ens: vitalik) { agents { out(kinds: pay, renew; sinceDay) } }` |
| Q4 | agents that paid a shop this week that later refunded someone else | two hops | refund edges this week, then pay edges into those shops |
| Q5 | a payment path payer.vitalik → jamun-junction within 3 hops | path | `path(from, to, maxDepth: 3, kinds: pay)` |
| Q6 | kesar-kingdom's depth-2 neighbourhood over this week's payments | k-hop (feeds the graph view) | `neighborhood(ens, depth: 2, kind: pay, sinceDay)` |

Ground truth for every question is computed in memory from the generator. "This week" = the last 7 days of the city. The plain baseline is **best effort**, written by hand: `count()` wherever a count answers, OR-batching sized to the same 64-leaf budget, projections, and a two-ended path search with the same caps. **Plain is scored against a name-based truth** (it has no epochs); report the identity difference separately: plain credits a re-registered shop's previous holder's sales to the new holder, so its Q2 is right by name and wrong by identity.

## 3. Metrics and method

- Arkiv calls = JSON-RPC requests, counted in one shared metered transport.
- Bytes = request plus response bodies as on the wire, without headers (KB = 1,024 bytes).
- Time = median wall time of 5 runs (11 interleaved rounds for Q2), after one untimed warm-up run (the first Rabdi call took 909 ms cold; warm about 0.29–0.32 s).
- Correctness against ground truth.
- Q2 plain also runs **at its fastest**: one `count()`, then every page with 4, 8, 16 and 48 requests in flight (48 = all 47 pages at once at M). Modes interleave round-robin so drift hits every mode alike.
- Log every HTTP response's status, time and `ratelimit` header (never the URL).
- Commit the CSVs, the commit hash, the backend and the block range, with a SYNTHETIC header.

## 4. Lab results to compare against (live, Rabdi, 2026-11-04)

**Q2 at its fastest (median of 11 interleaved rounds; Arkiv calls in brackets):**

| city | plain, one page at a time | 4 in flight | 8 in flight | 16 in flight | every page at once | **Graph Arkiv** |
|---|---:|---:|---:|---:|---:|---:|
| S | 1.62 s (5) | 0.92 s (6) | 0.65 s (6) | — | — | **0.66 s (2)** |
| M | 15.2 s (47) | 4.12 s (48) | 2.31 s (48) | 1.42 s (48) | 1.17 s (48) | **0.65 s (2)** |

Bytes: plain 98 KB at S and 976 KB at M; Graph Arkiv 20 KB and 31 KB. Parallel plain modes make one extra call (the `count()`).

**All six questions, live medians of 5 runs (calls / bytes / time):**

| Q | S plain | S graph+names+links | M plain | M graph+names+links |
|---|---|---|---|---|
| Q1 | 3 / 1.1 KB / 426 ms | 3 / 3.3 KB / 606 ms | 3 / 1.1 KB / 340 ms | 3 / 3.3 KB / 616 ms |
| Q2 | 5 / 98.0 KB / 1,470 ms | 2 / 20.0 KB / 587 ms | 47 / 975.5 KB / 14.9 s | 2 / 30.9 KB / 631 ms |
| Q3 | 2 / 2.7 KB / 579 ms | 3 / 7.0 KB / 898 ms | 2 / 2.7 KB / 592 ms | 3 / 7.0 KB / 901 ms |
| Q4 | 2 / 3.6 KB / 593 ms | 2 / 5.1 KB / 586 ms | 2 / 20.4 KB / 599 ms | 2 / 31.8 KB / 618 ms |
| Q5 | 3 / 21.4 KB / 891 ms | 5 / 18.9 KB / 1,502 ms | 11 / 149.0 KB / 2,528 ms | 9 / 85.9 KB / 2,121 ms |
| Q6 | 2 / 8.2 KB / 821 ms | 2 / 10.7 KB / 606 ms | 4 / 57.9 KB / 625 ms | 4 / 77.1 KB / 696 ms |

Every Graph Arkiv answer was correct at both sizes; plain was correct by name and wrong by identity on Q2. Live call counts equalled the emulator's for every like-for-like question; bytes agreed within about 2% except count-heavy Q1 (the emulator's `count()` sends rows the node does not).

**Quota:** no 429 and no non-200 (apart from deliberate 413 probes) in 24,484 logged responses; lowest `ratelimit remaining` seen 4,682 of 5,000.

## 5. What to claim and what not to

- **Claim:** one GraphQL call for any question; aggregates at constant cost, and the gap grows with the data; identity-correct answers (epochs); verifiable totals (`verify` recounts with `count()`); with pair links, all-time path search beats plain (M: 9 calls against 11, 2.1 s against 2.5 s).
- **Do not claim:** fewer reads for this-week traversals (Q3 is 3 against 2; Q4 and Q6 are even); a win at small sizes (at S the fastest plain Q2 is level, 0.65 s against 0.66 s); emulated numbers as live ones; cheaper writes (seeding M cost 4.62 tGLM for the graph store against 1.70 for plain; a live money event is 6 operations against plain's 1).
- Suggested line (replace the numbers with the event's own): *"On Arkiv's live testnet, with a synthetic city of 9,612 transactions (40 shops), the city-wide top-10 ranking takes Graph Arkiv 2 calls and 0.65 s. Plain Arkiv code must read all 4,604 payment and renewal rows: 48 calls and about 1 MB, 1.17 s even with every page requested at once, and 15.2 s one page at a time."*

## 6. Expected deviations at the event

- The merged model adds four tally counters and an indexed `ref`: about +30% write payload and +12.5% Q2 bytes at S (measured on the emulator by the lab's reviewer); calls unchanged. Re-measure bytes.
- **Expected call counts come from the event's own city.** Graph Arkiv's Q2 is 2 calls at any size. Plain sequential Q2 is `ceil(payment and renewal rows / 100)` (the lab's 462 and 4,604 rows gave 5 and 47); the parallel modes add one `count()`. The generator will not reproduce the lab's row counts exactly, so compute the expected plain count from the seeded store's row count before comparing.
- Times depend on the network path from the venue and on the row counts. Acceptance compares per-page time rather than totals when the row count differs (`ACCEPTANCE_TESTS.md` D6): the lab's plain sequential Q2 took about 0.32 s per page (1,615 ms for 5 pages; 15.2 s for 47), Graph Arkiv 0.65 s in total.

## 7. Outputs

`bench/results/questions-<size>.csv` (columns: question, mode, calls, queries, bytes, median_ms, min_ms, max_ms, runs, correct, truth_basis, matches_identity_truth, commit, backend, block_from, block_to), `q2-parallel-<size>.csv` (mode, in_flight, calls, bytes, median_ms, runs, correct, http_requests, non_200, n_429, lowest_remaining), `writes-<size>.csv` (store, transactions, creates, patches, gas, tglm, minutes), and `BENCHMARK-LIVE.md` generated from them. Plain language first, then tables, then caveats (synthetic data, one machine, one network, a testnet days old).
