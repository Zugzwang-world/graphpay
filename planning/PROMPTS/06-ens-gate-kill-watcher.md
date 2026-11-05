# M6 — ENS gate, kill switch and policy-mirror watcher

**Goal:** the payment gate that reads registry state (never records alone), the pause and kill actions, and a watcher that mirrors ENS changes into the on-chain AgentPolicy and the Arkiv node standing.
**Depends on:** M5 (and M2 for `setPolicy` on the real checkout). **Worktree:** `wt-identity` (`ens/gate`). **Model:** Sonnet High; **the reviewer pass is mandatory** (the gate is on the payment path). **Time:** 45–60 min.

## Inputs
`SPEC/IDENTITY_ENS.md` §6–§9; `SPEC/PAYMENTS_WHITECHAIN.md` §5 (how the facilitator uses the gate); `SPEC/INTEGRATION_AND_MIRROR.md` §3 (`AgentPolicySet` → node standing).

## Prompt
> In `packages/ens`, implement `ensGate(name, amountMicro)` exactly as `planning/SPEC/IDENTITY_ENS.md` §7 (steps 0–9, every reason code, `allowedRoots: ['graphpay.eth']`, block time as now, every ancestor walked, resolver offset 0 and factory-proxy check, `min(ENS cap, policy cap)`, injected `expectedEpoch`, `policyCapMicro`, `spentToday`), fail closed, with a 20 s cache keyed by the exact normalised spelling and stamped before the reads. Implement `ens_check` for the agents (`SPEC/AGENTS.md` §5) on the same reads.
>
> Owner actions (signed with the owner's key through the env loader): `pause(name)` and `resume(name)` (`graphpay.status`), `kill(name)` (`unregister`, re-reading the owner's registry from chain state before signing; refuse if already killed and report "killed earlier"), `provisionDisposable()` (next free `disposable-<n>` label: generate a fresh wallet DISPOSABLE_<n> straight into `.env` and print its address, give it 1 token, provision the name with that wallet as holder and address (3 Sepolia transactions), and have the policy writer create its 1.00/day policy).
>
> The watcher (§8), which **never creates a policy and never copies the ENS cap**: registry and resolver events with a shared checkpoint, epoch from `TokenResource` of the same transaction, `LabelUnregistered` → `setPolicy(revoked)` on an existing policy with the stored epoch, `ExpiryUpdated` → re-read `getState` and un-revoke only if REGISTERED with the stored epoch, `TextUpdated` on status → patch the node, a 30 s expiry ticker, marks set only after the sink succeeded. Sinks: `updatePolicy` on the checkout with the POLICY_WRITER key (wallet and cap from the configured list) and `patchNode` (in-process, through the mirror's writer). It runs inside the single long-lived workers process with the mirror (M11), not on Vercel cron.
>
> Tests: gate unit tests for every reason with fakes (including a look-alike spelling that must not poison the real entry, a RESERVED `sim` ancestor, a RESERVED leaf after `renew`, a lapsed parent, a default-record leak, a non-factory resolver, an owner-raised ENS cap above the policy cap); fork tests for the kill ladder (unregister → `ENS_EXPIRED_OR_REVOKED`; 5-minute expiry then `renew` → same epoch; pause → `ENS_PAUSED`); a watcher test that a `renew` after `unregister` does not un-revoke. Then a real-Sepolia read-only check that the gate passes all 13 agents. Reviewer pass. Ship.

## Done when
- `ACCEPTANCE_TESTS.md` B2, B6, B7 pass.
- The facilitator (M3) runs with the real gate against real Sepolia.
- A pause made on the website path is refused within 20 s of its Sepolia receipt (tests allow 25 s) and allowed again after resume.
- A watcher test shows that an owner raising `graphpay.cap_micro` leaves the on-chain policy cap unchanged.

## Pitfalls
Empty strings are not an error; a renewed killed label comes back RESERVED with its old records; the parent's default record leaks; the epoch of an AVAILABLE name is off by one after an `unregister`; a gate call costs 1.2–2.3 s on the public RPC (cache it; read 6 names at a time); a revoked policy's cap (0) must not stop the facilitator from recording `AGENT_REVOKED` on-chain within the quota. POLICY_WRITER has one nonce stream: M2's `setup` runs before the watcher starts; after that only the watcher writes policies (a second policy write goes through the watcher's queue).

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`identity`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `identity` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/identity.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `identity` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `identity` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
