# M5 — The ENS namespace under graphpay.eth (real Sepolia)

**Goal:** `graphpay.eth` gets its resolver and registry; Vitalik and the three shops get their own registries and resolvers; 13 agents become non-transferable, expiring subnames with their own resolvers and a setter role limited to one record; shops publish a Whitechain address and a payment preference; `sim.graphpay.eth` answers as a wildcard; one disposable agent exists for the kill test.
**Depends on:** M0 (OPERATOR key imported; the fresh owner wallets VITALIK, SHOP_KESAR, SHOP_JAMUN, SHOP_SYRUP and ACCEPTANCE_PAYER generated and funded with Sepolia ETH by FUNDER). **Worktree:** `wt-identity` (`ens/namespace`). **Model:** Sonnet High. **Time:** 75–90 min (lab: 70 min on a fork, then 45 + 20 min for 77 real transactions).

## Inputs
`SPEC/IDENTITY_ENS.md` §1–§5, §9, §10; `SPEC/AGENTS.md` §1 (cast); `FACTS.md` §3; `WALLETS.md`.

## Prompt
> In `packages/ens`, first build the **address verifier** of `planning/SPEC/IDENTITY_ENS.md` §2 (fetch the ENS deployments page, check code and cross-wiring for every address, exit non-zero on any change) and generate ABIs from Sourcify. Run it; stop if anything changed. Load every address from one config file.
>
> Then a provisioning library and a `real-run` script, following §4 exactly: (A) root on the already-registered bare `graphpay.eth` (resolver, `setResolver`, UserRegistry, `setSubregistry`, `setParent`); (B) the four owners with their own UserRegistry and resolver (shops seed coin type `2147485522` and the ENSIP-31 `payment-preference` of §5); (C) `provisionAgent` for the 13 agents of `SPEC/AGENTS.md` §1 plus `rehearsal.vitalik` and `acceptance.vitalik` (seeded records, register with role bitmap 0, `grantSetterRoles` for `agent-endpoint[mcp]` only), returning node, epoch and expiry; each paying agent's token holder and address record is **its own wallet** (payer → PAYER, scout → DEAL_HUNTER, rehearsal → REHEARSAL_PAYER, acceptance → ACCEPTANCE_PAYER); concierge, analyst and the shop agents are held by their owner; (D) the `sim` wildcard with a default record that holds no status or cap; plus `disposable-1.vitalik.graphpay.eth` (cap 1 USDT, 14-day expiry) held by a freshly generated wallet DISPOSABLE_1. Roles exactly as §3. Agent expiry 30 days; ENS caps per `DECISIONS.md` E-11 (6,000,000 for payer and acceptance, 30,000,000 for rehearsal, 1,000,000 for scout and disposable agents). The script signs with the git-based env loader's keys, verifies the chain id (11155111) before signing, skips steps already done on-chain, re-reads after each write (the public RPC can lag a block), and prints only addresses and hashes. Rehearse the whole run on an anvil fork of Sepolia first (`--fork-url` the public endpoint directly), then run it for real.
>
> Write `docs/sessions/identity/namespace.md`: every name, node, epoch, resolver, registry, expiry and transaction link, and the hand-off values for the payments track (node, epoch, wallet, expiry per agent). Tests: unit tests for names, namehash, coin type, the ENSIP-31 encoder and parser (the draft's vectors byte for byte; malformed → ignore the whole record), the role bitmaps; fork tests for the scoped role (the agent's endpoint write succeeds, its `cap_micro` write reverts), both transfer reverts, the wildcard. Ship.

**Gas check before the real run:** read the Sepolia base fee and tip; OPERATOR must hold at least 1.3 × 75M gas × (base fee + tip), and each owner at least 1.3 × its planned gas × the same price. If short, add the founder to-do from `WALLETS.md` §3 to the `identity` section of `OPEN.md` and wait (re-check every 10 minutes); resume when the balances pass.

## Done when
- `ACCEPTANCE_TESTS.md` B1, B3, B4, B5 pass on real Sepolia.
- `getEnsText('graphpay.status')` reads `active` for all 13 cast agents and the rehearsal, acceptance and disposable agents; `anything.sim.graphpay.eth` reads `graphpay.synthetic=true`.
- The hand-off table is committed and the payments track has updated its policies.

## Pitfalls
`SPEC/IDENTITY_ENS.md` §10. `setResolver` on the bare root is untested: rehearse on the fork. Deploy a resolver before anything binds to it. The registrar charges `msg.sender`. Agents other than the payer are held by Vitalik's wallet until they get keys: say so in `agent-context`. A killed label can never be re-provisioned: keep a counter for disposable labels. Never mirror a fork-built result to a real AgentPolicy or Arkiv (fork keys are public).

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`identity`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `identity` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/identity.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `identity` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `identity` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
