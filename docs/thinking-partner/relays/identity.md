# Identity relay (T2): after M6 part 1

## In plain words

An agent is now checked against its ENS name before it can pay. The new payment gate looks at the chain, not at a cached file: is the name registered, is every parent name still alive, is it the real `graphpay.eth` namespace (not a look-alike), is the agent paused, and is the amount inside the smaller of two limits, the owner's published cap and the payment contract's own cap. If anything is unclear, such as a read failing, the answer is "no" and the payment path never sees an exception.

The owner can now pause an agent (instant, reversible), resume it, or kill it for good (unregister its name). We measured on a local copy of Sepolia that a pause is refused within 25 seconds of its receipt, that an unregistered name is refused at once, that renewing a killed name does not bring it back, and that a lapsed name renewed in time keeps its identity (same epoch), so its history stays.

On real Sepolia, read-only, every agent that holds a wallet passes the gate with the real Whitechain policies. Agents that never pay (the concierge, analyst, shop agents) are refused by design: they publish a cap of 0 (ADR-0059).

What this means for the demo: the kill-switch beat is real and testable. What the founder must do: nothing. The Coordinator funds a new disposable wallet only when one is needed.

## Technical

- **Gate** (`packages/ens/src/gate.mjs`, `createEnsGate`): reasons exactly as `planning/SPEC/IDENTITY_ENS.md` §7. Reads come from `walkName` (every ancestor, expiry against the latest block, resolver at offset 0 and a factory proxy) plus `graphpay.status` and `graphpay.cap_micro` from the leaf's own resolver (a record answered by another resolver is `ENS_RESOLVER_MISMATCH`). Cache 20 s per exact spelling, stamped before the reads, failed reads not cached, capped at 2000 entries, expiry re-checked on every hit. `expectedEpoch`, `policyCapMicro`, `spentToday` are injected and never cached. Deviation: the epoch check (step 4) runs after the resolver check (step 5) because both live in the walk; both refuse, only the reason code order differs.
- **ens_check**: registry state first. An unregister burns the token (latest owner 0x0) and reads REVOKED; a lapse keeps its owner and reads EXPIRED (measured on the fork). Status is ACTIVE unless exactly `paused`, as in the agents spec; the gate is stricter.
- **Owner actions** (`actions.mjs`, `scripts/ens/owner.mjs`): signed with the agent's owner wallet from the git-ignored `.env`; chain id checked before every signing step; registry and resolver re-read from chain; `kill` is one-shot ("killed earlier"); `nextFreeDisposable` skips any label that was ever registered.
- **Tests**: 33 unit tests (17 new), 10 fork tests (pause 25 s bite, kill ladder, lapse then renew, snapshot/revert per stateful test). A `renew` after `unregister` is accepted by the registry and leaves the label RESERVED: the gate still refuses it.
- **Real Sepolia pass** (`scripts/ens/gate-pass.mjs`): 16 registered names; ENS side ok for the 5 paying agents and `disposable-1`; zero-cap names return `CAP_EXCEEDED` by design; with the real checkout's policies the full gate is ok for the paying agents and `ENS_NO_POLICY` for the rest. About 4 to 8 s per name on the public RPC with retries (uncached).
- **Reviewer**: no blockers. Applied: bounded cache, `--n` validated, expiry re-check on hits, the Whitechain setup script is not auto-confirmed by the disposable flow.
- **Open risks**: the watcher (part 2) is the other half of M6; B6/B7/E7 real timings need Join's workers process.
