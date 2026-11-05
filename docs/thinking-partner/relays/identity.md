# Identity relay (T2): M6 done (gate merged, watcher in review)

## In plain words

Two things now protect every payment. First, the **gate** (merged in PR #34): before an agent pays, its ENS name is checked on the chain itself, and the amount must fit the smaller of the owner's published cap and the payment contract's own cap. Second, the **watcher** (this PR): it listens to the ENS contracts and keeps the payment policy and the money graph's picture of each agent in step. When the owner kills an agent, the watcher revokes its payment policy; when the owner pauses it, the picture shows "paused"; when a name quietly lapses, a 30 second ticker notices.

Two safety rules were tested hard. A killed agent cannot be revived by paying to renew its name (the registry accepts the renew but leaves the name unregistered, and the watcher re-reads the chain before it trusts an event). And an owner who raises the cap in their ENS record gets nothing: the policy cap does not move.

For the demo this makes the kill-switch beat real. What the founder must do: nothing. Join hosts the watcher in the workers process; the Coordinator funds a new disposable wallet only if a second kill is needed.

## Technical

- **Watcher** (`packages/ens/src/watcher.mjs`, `createEnsWatcher({ client, names, sink, reader, gate, checkpoint })`): registry events (`LabelRegistered`, `LabelUnregistered`, `ExpiryUpdated`, `TokenResource`) and resolver events (`TextUpdated`, `AddressUpdated`) of the tracked names, fetched in 1000-block ranges and 8-address queries (the public Sepolia RPC refuses 19 addresses in one `getLogs`; 10 works), one serial queue, one shared checkpoint. Each poll also re-reads the last 6 blocks, because that RPC is load balanced; every handler re-reads `getState` and ignores a stale event. Epoch from the `TokenResource` of the same transaction. Marks (revoked, expired) are set only after the sink succeeded; a failed batch leaves the checkpoint. A 30 s ticker marks a lapse on the node only. `start()` catches up from chain state (a kill while the watcher was down).
- **Rules held by tests:** never creates a policy (no policy on chain → skipped); never reads an ENS cap or address into a policy (`updatePolicy` carries no cap or wallet; the sink uses the bound wallet and the configured cap only to reopen); `Address`/accepts changes only clear caches (`invalidatePayee`, `invalidateAccepts`); `graphpay.cap_micro` changes are shown on the node only.
- **Policy sink** (`policy-sink.mjs`): a revoke writes `revoked=true`, cap 0, expiry 0 from the chain's own policy (it needs no list). Reopening a revoked policy or a new epoch uses the configured cap. A newer on-chain epoch is never lowered.
- **Reviewer** (two passes): the first found six blocking issues in the first draft (a revoke skipped without a list entry, lost tip events on a lagging RPC, replayed events un-revoking or revoking wrongly, a renew after a lapse lifting a revocation it never set, names never retried); all fixed and covered by tests before this PR.
- **Tests:** 47 unit, 11 fork (pause bites within 25 s of its receipt; unregister refuses at once; renew after unregister leaves the label RESERVED and the gate refuses it; a lapse then renew keeps the epoch; the watcher revokes once and never un-revokes). Real Sepolia dry run (`scripts/ens/watch.mjs`, logging sinks) runs clean over 22 names.
- **B8 MCP call:** `scripts/ens/acceptance.mjs` now POSTs `initialize` and `tools/list` to the endpoint the root's ENS record names: it answers with `schema`, `ask`, `graphql`, `explain`.
- **Not done / next:** B6, B7 and E7 timings on real Sepolia need Join's workers process to host the watcher; B9 (a)'s payee comparison needs T1's first settled payment. Problem log: P-identity-2.
