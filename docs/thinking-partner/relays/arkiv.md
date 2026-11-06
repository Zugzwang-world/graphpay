# Relay: arkiv (T3)

Updated 10:40 IST, Fri 6 Nov. This step: Friday item 15, the drafts of the Arkiv judges' files (branch `arkiv/judges-drafts`). Before it: the SDK publish prep, merged at about 10:15 ([PR #74](https://github.com/Zugzwang-world/graphpay/pull/74)).

## In plain words

Arkiv's judges read the `arkiv/` folder. Three of its files are now drafted:

- **`friction.md`:** seven gaps we ran into on the live network or in the published SDK during this event, each with how to reproduce it, what we expected, what happened and what it cost. Examples: Arkiv has no SUM, so ranking shops by sales meant reading every payment (5 reads against our 2, on a synthetic city); a number typed the wrong way in a query silently matches nothing; the SDK returns attributes under a name we did not expect, which nearly wrote a refusal receipt twice. It also lists what worked, what we only saw in our simulator, and the booth questions nobody answered.
- **`how-you-use-arkiv.md`:** each Arkiv feature, what a person sees because of it, and where it lives in the code. It says which parts are running and which are only built. It links the npm package.
- **`swarm.md`:** honest and marked pending. Nothing has been uploaded to Swarm yet; it records the plan (public gateway, no stamp of ours, photos encrypted in our code first) and what is not done.

What you need to do: nothing now. At the end, someone should re-check each repro and number before the files go out (OPEN).

## Technical

- **Sources for every friction row:** `docs/technical/FACTS.md` (T3 rows and the M0 verifier rows), `docs/problems/PROBLEM_LOG.md` (P-arkiv-1), `bench/BENCHMARK-LIVE.md`, the SDK 1.0.1 type declarations. Rows excluded because we did not reproduce them live: the 256 KiB failure (ArkivSim only), "readonly can still be deleted" (SDK types only), offset-paging drift (documented, not observed). I left out the pack's other candidates (salted-create duplicates, `eth_getLogs` lag, no events on expiry) because they were not run at the event.
- **Numbers:** Q2 top 10: 2 reads and 34.5 KB (Graph Arkiv) against 5 reads and 131.9 KB (plain), 490 rows, synthetic size S, blocks 265307 to 265376. Graph Arkiv needs fewer reads on Q2 and Q5, equal on Q1, Q4, Q6, and more on Q3 (3 against 2); more bytes on Q1, Q3, Q4, Q5, Q6. Keyless limit 2000, keyed 5000, lowest remaining 4,834 over the S seed. Gas: 1,301,681 first event, 377,893 steady.
- **how-you-use:** `watchEntityEvents` is not used (stated). `agent_presence` and `handoff` are built and tested but no run calls `activityHooks` yet.
- **Not done:** `reach.md` and `why-arkiv.md` (Submission, M17); Swarm (next, if usage stays under about 88%).
- **Checks:** `pnpm check` clean. No addresses in the files (roles only).
