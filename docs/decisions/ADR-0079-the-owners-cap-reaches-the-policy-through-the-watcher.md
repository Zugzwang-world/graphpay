# ADR-0079: The owner's cap reaches the spending policy through the watcher, never above the configured cap
Status: accepted · Date: 2026-11-07 00:10 IST · Decided by: the night Coordinator, under the founder's authority (W3 brief, item 4b) · Source: the W3 brief `docs/thinking-partner/briefs/2258-w3-payments.md`; NOW, "Decided tonight (Coordinator)", 00:00 IST; the Coordinator's approval to W3 with these bounds. Amends `planning/SPEC/IDENTITY_ENS.md` §8; cites ADR-0021

## Decision
When the payer agent's owner changes its daily cap (`POST /api/customer/cap`), the owner's wallet writes the ENS record `graphpay.cap_micro` on Sepolia. The ENS watcher on the Mac then writes the same cap into the agent's spending policy on the checkout, as min(the owner's ENS cap, the payments setup's configured cap, `buyerAgents.<agent>.capMicro`). POLICY_WRITER stays local. The route waits up to 60 s for the policy and records the change on Arkiv (a W_SYNC `request` edge from the owner to the agent, ref `own:`, amount 0).

## Bounds (the Coordinator's, enforced in code)
- The policy never goes above the configured cap: the watcher writes min(the owner's ENS cap, `buyerAgents.<agent>.capMicro`).
- Only the owner's change to `graphpay.cap_micro` on an agent's own node triggers a write, and only for an agent with a pass (a configured cap and a policy on chain).
- One `setPolicy` per change, idempotent: nothing is written when the policy already holds that cap.
- The chain id is checked before each signing.
- A refusal is logged, never retried in a loop.
- The watcher still never creates a policy, writes an address, lifts a revocation or changes an epoch. ADR-0021 stands: no hosted key can lift a cap above the payments setup's bound.

## Why
- **The brief asks for both records.** It says "the owner changes the payer's cap, in both the spending policy and the ENS record".
- **Only the policy writer can write the policy**, and its key stays on the Mac on purpose (planning/SPEC/ARCHITECTURE.md §3; ADR-0021: "a stolen relayer key cannot lift a cap"). `secrets:vercel` refuses it (LOCAL_ONLY).
- **The owner's key is already hosted** for pause and resume, and the site is public (ADR-0069). Any visitor can therefore change the cap through the route, not just a thief of the key. Bounding the copy by the configured cap keeps ADR-0021 true: no one can lift the pass above what the payments setup allows. The route also refuses a cap below today's spend plus the story errand's budget (`order.budgetMicro`), so a visitor cannot stop the live errand (W5 found that a floor at the budget alone would not do it). A restore to the configured cap is always allowed.
- **The contract's own policy check is the only cap on renewals.** Renewals do not pass the ENS gate, so the policy must follow the owner, or a lowered cap would not bind them.

## Consequences
- **This narrows `planning/DECISIONS.md` E-11** ("the watcher never copies the ENS cap") and `planning/SPEC/IDENTITY_ENS.md` §8 ("`graphpay.cap_micro` changes are shown on the node, never written into the policy"). The watcher may now write an owner's cap change into the policy of a story agent that already has one, bounded as above. It still never creates a policy, never writes an address, never lifts a revocation and never changes an epoch.
- **W1** implements the watcher and policy-sink side in `packages/ens` (#191). **W5** restarts the workers so it runs.
- **Known gap:** the watcher has no reconcile at start, and a reopened policy goes back to the configured cap. So a cap set while the workers are down, or before a re-registration, reaches the policy only with the owner's next change. The route then answers `policy.applied: false`. A reconcile at start is the follow-up.
- **W3's route** refuses a cap above the configured one (`OVER_CONFIGURED`). It writes ENS through `@graphpay/ens`'s `setCap`, and it reports `policy.applied: false` if the watcher has not followed within 45 s. The gate already enforces the lower of the two caps, so a lowered ENS cap holds for x402 payments within the gate's 20 s cache.
