# M1 — GraphPayCheckout and its tests (Whitechain fork)

**Goal:** the checkout contract and a labelled stand-in token, with Foundry tests on a pinned-block fork of Whitechain Sepolia against the real test USDT and Permit2.
**Depends on:** M0. **Worktree:** `wt-payments` (branch `pay/contract`). **Model:** Opus High. **Time:** 60–75 min (lab: about 75 min across two sessions, two reviewer passes each).

## Inputs
`SPEC/PAYMENTS_WHITECHAIN.md` §1–§4, §7 and §10, `DECISIONS.md` (0005, 0006, 0021, 0022, E-5), `FACTS.md` §2.

## Prompt
> In `packages/contracts`, write `GraphPayCheckout` exactly to `planning/SPEC/PAYMENTS_WHITECHAIN.md` §3 (types, events with the indexed arguments shown, functions, roles, errors, invariants) and §4 (the Permit2 witness, the EIP-2612 gasless approval, the subscription `Subscribe` and `Cancel` signatures). Solidity 0.8.30, EVM prague, `via_ir = true`, 200 optimizer runs, `bytecode_hash = "none"`, `cbor_metadata = false`; OpenZeppelin v5.7.0, forge-std and Permit2 at the tags in `FACTS.md` §5, fetched by a dependency script (the libraries are git-ignored). Apply the renewal-id top-bit fix in §3.6. Also write the labelled stand-in token of §7 (`gpUSD TEST stand-in (not USDT)`, `gpUSD-TEST`, 6 decimals, EIP-2612 in both forms, EIP-3009, `Ownable2Step` mint).
>
> Tests on a fork of `https://rpc.testnet.whitechain.io` at a pinned block, against the real test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (impersonate a holder found through the explorer API) and the real Permit2, and the whole suite again against the stand-in. Cover: a gasless first payment (permit + witness), replay → `DUPLICATE`, retry of a `CREATED` order with the same permit, `TermsMismatch`, partial and full refunds with caps, re-order rules, every `FailReason` path (revoked, cap, expired policy, node mismatch including the `payerNode = 0` bypass, wrong token, expired order, starved gas), subscriptions (create with first charge, renew schedule and re-anchor, 3 failures lapse, `cancelWithSig`, front-run `PermitSingle`), disputes, role separation (each role refused everything else; distinct-role checks in the setters; `renounceOwnership` reverts), the renewal-id fix, the digests recomputed by hand and matched against viem, and an EIP-3009 and EIP-2612 parity suite run against both tokens. Use `vm.getBlockTimestamp()` everywhere in tests. Run the `reviewer` subagent on the diff twice (fix every blocking item between passes). Ship.

## Done when
- `forge build --sizes` and `forge test` pass locally and in the `contracts` CI job; runtime size under 24 KB.
- The test list above exists with names that state the promise.
- Reviewer verdict "ship".

## Pitfalls
`SPEC/PAYMENTS_WHITECHAIN.md` §10 items 3–7, 10–13: the `payerNode = 0` bypass, unsigned subscription terms, the permit token pin, failures that cost gas without reverting, approvals applied after the policy, `via_ir` and `vm.warp`, `vm.prank` consumed by a view call in the arguments, stack too deep without `via_ir`, `catch` swallowing out-of-gas. A package `test` script must not call `forge` (the Node CI runner lacks it).

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`payments`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `payments` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/payments.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `payments` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `payments` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
