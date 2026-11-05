# M2 — Deploy and verify on Whitechain Sepolia

**Goal:** the stand-in token and its checkout deployed from the right roles, verified on Blockscout and set up, with the USDT path ready as a dry run (the real-chain lifecycle and the USDT checkout run in M3 part B).
**Depends on:** M1; M0's funding. **Worktree:** `wt-payments` (`pay/deploy`). **Model:** Opus High. **Time:** 30–45 min (lab: 37 min for deploy, verify, setup and lifecycle; the lifecycle now runs in M3 part B).

## Inputs
`SPEC/PAYMENTS_WHITECHAIN.md` §2, §7, §8 (limits), §9; `planning/WALLETS.md`; `FACTS.md` §2; `DECISIONS.md` E-1, E-6, E-11.

## Prompt
> Write real-chain scripts in `scripts/whitechain` (one `--token standin|usdt` switch everywhere; keys only through the git-based env loader; print addresses and hashes only; every transaction appended to `docs/sessions/payments/txlog.jsonl` with gas, fee and explorer link; a dry run by default and `--yes` to send (the wallet scripts use `--execute --real`; keep each script's own flag and print it in its usage line); check `eth_chainId == 1874` and fork-versus-real before signing):
> 1. `deploy-token`: deploy the stand-in from DEPLOYER (a fresh event wallet; `WALLETS.md`), mint PAYER 30, REHEARSAL_PAYER 60, ACCEPTANCE_PAYER 30, SHOP_KESAR 20, VITALIK 10, DEAL_HUNTER 10.
> 2. `deploy-checkout --token`: check the token (code, 6 decimals, symbol, `DOMAIN_SEPARATOR()` equals the domain clients will sign), record a pending deployment (predicted address and nonce) before sending, deploy with `(token, Permit2, admin=DEPLOYER, relayer=FACILITATOR, policyWriter=POLICY_WRITER)`, checksum the address, write `packages/contracts/deployments/whitechain-sepolia.json`.
> 3. `verify`: run the Blockscout command in `SPEC/PAYMENTS_WHITECHAIN.md` §7 once per contract (the token and the checkout), each with its own source path and constructor arguments; record the explorer links.
> 4. `setup`: admin grants RENEWER as a second relayer; SHOP_KESAR, SHOP_JAMUN and SHOP_SYRUP each approve a bounded refund float (20); the policy writer creates policies **from one configured list, one dedicated wallet per paying agent** (`planning/SPEC/PAYMENTS_WHITECHAIN.md` §2): `payer.vitalik` → PAYER (6.00/day), `rehearsal.vitalik` → REHEARSAL_PAYER (30.00, so the lifecycle and several rehearsals fit in one UTC day), `acceptance.vitalik` → ACCEPTANCE_PAYER (6.00), `scout.vitalik` → DEAL_HUNTER (1.00, for the revoked-agent beat), each `disposable-<n>` → its own DISPOSABLE_<n> (1.00), using the node, epoch and expiry from the ENS track (M5); until M5 is done use the namehash with epoch 0 and update after. Never bind VITALIK or a shop wallet (they pay as humans or receive). A wallet already bound to another node makes `setPolicy` revert: check `nodeOfWallet` first.
> 5. `usdt-ready`: a **dry run** of every USDT check (token code, decimals, domain, FUNDER's USDT balance). Its `--go --yes` path (deploy, verify and set up the USDT checkout, fund ACCEPTANCE_PAYER, make the qualifying payment) is written here but **run in M3 part B**, because the payment needs the facilitator (M3), the agent names (M5) and the gate (M6).
> The real-chain `lifecycle` and `subscription` runs also move to M3 part B, for the same reason.
> Run the reviewer on the scripts (key redaction from every error, pending deployment records, no repeated first payment). Ship.

## Done when
- Both contracts show "verified" on https://explorer.testnet.whitechain.io; links in `relays/payments.md` (main copies them into `docs/technical/FACTS.md`).
- `setup` has granted RENEWER, the three merchants' floats and every policy in the configured list (explorer links).
- `usdt-ready` dry run passes every check.

## Pitfalls
The verifier URL must end in `/api/`; expect "verified", not "fully verified". A lifecycle run spends its buyer's 6.00 for the UTC day (resets 05:30 IST; Thursday 21:00 to Friday 05:30 IST is one UTC day): that is why it pays as `rehearsal.vitalik`. The real ENS gate refuses over-cap payments off-chain, so the on-chain failure beat needs an ENS-active agent with a revoked policy. Gas of a renewal is about 200k. Never run these scripts with the hosted relayer key while the hosted demo is in use (E-1).

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`payments`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `payments` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/payments.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `payments` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `payments` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
