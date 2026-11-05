# WALLETS

**Testnets only.** Public addresses only: keys live in the git-ignored `.env` (and, for hosted services, the Vercel environment as Sensitive values).

**Fresh event wallets (founder decision, 2026-11-05; `DECISIONS.md` E-7).** Only two lab wallets carry over to the event:

- **FUNDER**, the bank: it receives the founder's test tokens and pays every other wallet.
- **OPERATOR**: it owns `graphpay.eth` and does all the ENS work on Sepolia. It has no Whitechain role at the event.

Every other role gets a **new key at M0**. That covers the deployer, the relayers, the policy writer, the recorder, the Arkiv writers, the persona, the shops and every paying agent. The lab's other role wallets are **not used at the event**. Their spare test tokens were swept into FUNDER on 2026-11-05 (§5).

**How keys get into `.env`:**
- FUNDER and OPERATOR: the import script copies exactly these names from the lab's `.env` (default `~/graphpay-lab/.env`): `FUNDER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `ARKIV_ACCESS_KEY` and `ANTHROPIC_API_KEY`. It refuses any other name, prints names only, and refuses to overwrite a different value.
- Every fresh role: the one-role wallet generator (`--only ROLE`, one role per run) makes the key in-process. It writes the key straight into `.env` through the hidden secret setter's write path (never echoed, never on a command line or the clipboard) and prints the address only.
- After generation, check that no event role's address appears in the lab list in §5 (`ACCEPTANCE_TESTS.md` A5).

**Two binding rules (`DECISIONS.md` E-14):** the checkout binds one wallet to one agent node, so **every paying agent has its own wallet**; and **no owner wallet (VITALIK, the shops) is ever bound** to a node, because a bound wallet paying as a human fails `NODE_MISMATCH`.

## 1. Event roles

Re-read every balance at 9 pm with a read-only script over all three networks. `gpUSD` (the lab's stand-in token) is not used; the event deploys its own stand-in. Test USDT: 0 everywhere until Whitechain supplies it.

| role | address | used for | source of the key |
|---|---|---|---|
| FUNDER | `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65` | the bank: receives the founder's test tokens (WBT, test USDT, tGLM); pays out every funding transfer in §3 | lab, imported |
| OPERATOR | `0x531D49A595946a72b9C47b78D287Ff6e6B3CfF32` | owner of `graphpay.eth`; ENS provisioner (root, owner and agent registries and resolvers, wildcard, disposable agents). **Sepolia only** | lab, imported |
| DEPLOYER | new | Whitechain contract admin (`Ownable2Step` owner) and deployer of the stand-in token and both checkouts; mints the stand-in; grants the relayer, renewer and policy-writer roles; resolves disputes | fresh at M0 |
| FACILITATOR | new | relayer for the hosted facilitator (`settleOrder`, `createSubscription`); holds only WBT | fresh at M0 |
| RENEWER | new | second relayer, for scheduled `renew` calls (E-1) | fresh at M0 |
| POLICY_WRITER | new | `setPolicy` only (setup script and the ENS watcher) | fresh at M0 |
| W_SYNC | new | **the recorder**: create-only off-chain edges (refusals, refund requests) from Vercel routes (E-2) | fresh at M0 |
| W_LEDGER | new | **the Arkiv writer of the mirror** (one workers process): the single writer of nodes, chain-derived edges, tallies, links, checkpoints (E-2) | fresh at M0 |
| W_SEED_EVENT | new | the event's synthetic city S (graph and plain stores) | fresh at M0 |
| W_SEED_M_EVENT | new | the event's synthetic city M | fresh at M0 |
| VITALIK | new | persona and owner of `vitalik.graphpay.eth` (pauses and kills his agents); human payer; Sunday-box subscriber; **never bound** | fresh at M0 |
| SHOP_KESAR | new | merchant and owner of `kesar-kingdom.graphpay.eth`: receives, delivers, refunds | fresh at M0 |
| SHOP_JAMUN | new | merchant and owner of `jamun-junction.graphpay.eth` | fresh at M0 |
| SHOP_SYRUP | new | merchant and owner of `syrup-street.graphpay.eth` | fresh at M0 |
| PAYER | new | `payer.vitalik` (the stage payer, 6.00/day): signs Permit2 witnesses, pays no gas | fresh at M0 |
| DEAL_HUNTER | new | `scout.vitalik` (1.00/day), bound for the revoked-agent beat | fresh at M0 |
| REHEARSAL_PAYER | new | `rehearsal.vitalik` (30.00/day): the M3 part B lifecycle and every rehearsal | fresh at M0 |
| ACCEPTANCE_PAYER | new | `acceptance.vitalik` (6.00/day): the acceptance suite, including B3's scoped `setText` on Sepolia | fresh at M0 |
| DISPOSABLE_<n> | new, one per kill | `disposable-<n>.vitalik` (1.00/day): token holder and payer, then killed | fresh, by `provisionDisposable` |

The event seeds fresh cities under the new seed wallets (one dataset per owner wallet), so the lab's cities never mix in.

## 2. What each step needs (lab receipts; projections marked)

| step | wallet | cost |
|---|---|---|
| deploy the stand-in token and two checkouts (stand-in, USDT) | DEPLOYER | 1.3M + 2 × 3.6M gas ≈ 0.043 WBT |
| grant roles (relayer, renewer, policy writer), merchant approvals, policies (about 7) | DEPLOYER, merchants, POLICY_WRITER | 95k gas per new policy, 39k per update |
| one agent payment (relayer pays) | FACILITATOR | 312k gas ≈ 0.0016 WBT first, 234–252k after |
| one renewal | RENEWER | 202k gas ≈ 0.001 WBT |
| ENS namespace (≈ 85 transactions incl. the rehearsal, acceptance and disposable agents, ≈ 75M gas) | OPERATOR, owners | ≈ 1e-9 ETH at 19 wei; **about 0.075 ETH at 1 gwei** |
| one disposable agent and its kill | OPERATOR, VITALIK | 4 Sepolia transactions |
| B3's scoped `setText` | ACCEPTANCE_PAYER | 1 Sepolia transaction |
| one live Arkiv money event | W_LEDGER | 0.0003–0.001 tGLM (lab, 1-day rows; more with 30-day rows) |
| the 5% cast history (about 1,256 events, about 100 transactions) | W_LEDGER | about 0.7–0.9 tGLM (projection from the S seed) |
| one recorder edge | W_SYNC | about 0.0002–0.0006 tGLM |
| seed S (merged model) | W_SEED_EVENT | about 0.9 tGLM (projection) |
| seed M (merged model) | W_SEED_M_EVENT | about 6.3–8.5 tGLM (projection) |

## 3. Funding plan (M0; every transfer from FUNDER; dry run first, then `--execute --real`)

FUNDER after the 2026-11-05 sweep (§5): **1.848 WBT**, **0.0139 Sepolia ETH** and **2.858 tGLM**. OPERATOR keeps its own **0.095 Sepolia ETH** for the namespace.

**Estimate gas for every transfer; never assume 21,000.** On Ethereum Sepolia (Glamsterdam fork, EIP-8037 and EIP-2780, active since 2026-10-06), sending ETH to an address with no state used **204,600 gas** on 2026-11-05 (the RPC estimated 207,391); a 21,000 limit is mined and fails. Every fresh wallet is such an address. Whitechain and Rabdi still charge 21,000 (`FACTS.md` §1).

**Whitechain Sepolia (1874), WBT**

| to | amount | why |
|---|---:|---|
| DEPLOYER | 0.1 | deploys ≈ 0.043, role grants and mints |
| FACILITATOR | 0.8 | the hosted relayer; refuses at 0.3, so about 300 payments |
| RENEWER | 0.1 | about 100 renewals |
| POLICY_WRITER | 0.05 | about 7 new policies and their updates |
| SHOP_KESAR | 0.05 | refund approval, deliveries, refunds |
| SHOP_JAMUN, SHOP_SYRUP | 0.02 each | refund approvals |
| VITALIK | 0.02 | the human payer and the Sunday box |
| PAYER, DEAL_HUNTER, REHEARSAL_PAYER, ACCEPTANCE_PAYER, each DISPOSABLE_<n> | 0.005 each | emergency `Permit2.lockdown` only; they never pay gas for a payment |
| **total** | **about 1.20** (with 4 disposable agents) | FUNDER keeps ≥ 0.2 (about 0.65 left) |

**Ethereum Sepolia (11155111), ETH**

| to | amount | why |
|---|---:|---|
| VITALIK, SHOP_KESAR, SHOP_JAMUN, SHOP_SYRUP | 0.002 each | owner transactions: `grantSetterRoles`, records, pause and resume, `unregister` on a kill (a few million gas in all) |
| ACCEPTANCE_PAYER | 0.001 | B3's scoped `setText` |
| **total** | **0.009** plus five first-transfer surcharges (about 205,000 gas each, negligible at today's fee) | FUNDER holds 0.0139 and keeps about 0.0049 |
| OPERATOR | keeps its own 0.095 | the namespace (about 75M gas in the lab on 2026-11-04, already under Sepolia's Glamsterdam pricing, active since 2026-10-06) |

**Sepolia gas rule.** On 2026-11-05 the base fee was about 17 wei and the suggested tip about 1,000 wei, so these amounts cover the whole build many times over. At M0, read the base fee and the tip. **If base fee plus tip is above 0.5 gwei**, stop the ENS track's real run and add a founder to-do in `docs/thinking-partner/OPEN.md`: *"about 0.1 Sepolia ETH to OPERATOR `0x531D…CfF32` from a Sepolia faucet, then say done"*. OPERATOR's floor is then 0.08, not 0.05.

**Arkiv Rabdi (7794095), tGLM**

| to | amount | when |
|---|---:|---|
| W_SEED_EVENT | 0.9 | M0, from the swept 2.86 (the S city) |
| W_LEDGER | 1.5 at M0, then 0.5 more (2.0 in all) | M0 from the swept 2.86; the rest with the founder's tGLM (the 5% history 0.7–0.9 plus about 1,000 live events 0.3–1.0) |
| W_SYNC | 0.2 | M0, from the swept 2.86 (hundreds of recorder edges) |
| W_SEED_M_EVENT | 8.5 (6.3–8.5 projected) | as soon as the founder's tGLM reaches FUNDER (the M city). Skip M if it cannot be funded and race at S |
| **total** | **9.4–11.6** | FUNDER has 2.86 and keeps about 0.26 after M0. **The founder brings at least 9 tGLM to FUNDER** (the Arkiv booth first; the faucet's amount per claim is unknown) |

**Tokens (Whitechain)**

| what | amounts | from |
|---|---|---|
| stand-in mint (new token, **M2**) | PAYER 30, REHEARSAL_PAYER 60, ACCEPTANCE_PAYER 30, SHOP_KESAR 20, VITALIK 10, DEAL_HUNTER 10, each DISPOSABLE_<n> 1 | DEPLOYER mints; labelled stand-in |
| **test USDT, when obtained** | FUNDER ≥ 5, ideally 80. **ACCEPTANCE_PAYER first** (it makes the qualifying payment C7 as `acceptance.vitalik`): under 10 arrived, all of it to ACCEPTANCE_PAYER; with 80: ACCEPTANCE_PAYER 20, PAYER 30 (the stage), SHOP_KESAR 20, VITALIK 10 | founder (MetaMask) → FUNDER → script. The qualifying payment needs 4.80 at ACCEPTANCE_PAYER |

## 4. Safety floors and caps

| bound | value | enforced by |
|---|---|---|
| relayer-balance floor | the facilitator refuses at ≤ 0.3 WBT | hosted facilitator (reads the chain) |
| per-agent daily cap (AgentPolicy) | `payer.vitalik` 6.00; `acceptance.vitalik` 6.00; `rehearsal.vitalik` 30.00; `scout.vitalik` and disposable agents 1.00; revoked 0. Same values in ENS `graphpay.cap_micro`; the watcher never copies ENS caps into policies | contract |
| gas per settle | ≤ 450,000 | facilitator |
| recorded failures | ≤ 20 per day | facilitator (per instance) |
| gasless approval value | bounded (50), never unlimited | payer client |
| merchant refund float | bounded `approve(checkout, 20)` | merchant |
| agent wallets' WBT | a tiny reserve (0.005) only for an emergency `Permit2.lockdown`; they never pay gas for a payment | wallet |
| distribution scripts | dry run by default; real sending needs `--execute --real`; check `eth_chainId` before sending; skip roles without a key; send only from FUNDER | scripts |
| funding reserve | FUNDER keeps ≥ 0.2 WBT after the M0 split | funding plan |
| import allowlist | only `FUNDER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ANTHROPIC_API_KEY` come from the lab's `.env` | import script |

## 5. Lab role wallets: not used at the event

These lab wallets keep their addresses on-chain, but **no event role uses them**. Their spare WBT, Sepolia ETH and tGLM were swept into FUNDER on 2026-11-05; each kept only enough for its own transfer's gas. Their lab Arkiv data (the two synthetic cities, expiring about 18 Nov) and the lab's stand-in balances stay where they are.

| lab role | address | after the sweep (WBT / Sepolia ETH / tGLM) |
|---|---|---|
| FACILITATOR (lab relayer) | `0x2b07cDE60404Eb5FE3b1B179CD12376Eee1EF801` | 0.000895 / 0 / 0 |
| POLICY_WRITER | `0x396657eD1441f5C58D73c75ddB35C22cA95790A0` | 0.000895 / 0 / 0 |
| VITALIK | `0x6e8b2Deea86987A0bF5304ac2e5998E325f17f16` | 0.000895 / 0.000480 / 0 |
| SHOP_KESAR | `0xB15e23A7B52238d1CEe6acbadb19B67911606580` | 0.000895 / 0.000179 / 0 |
| SHOP_JAMUN | `0x24CAD0Dc6477D85E6a78d14F60598dE800A035f7` | 0 / 0.005 (key not in the lab's main `.env`; not swept) / 0 |
| SHOP_SYRUP | `0x8100EB81D78153269F875689F0A54045Ac586dFa` | 0 / 0.005 (key not in the lab's main `.env`; not swept) / 0 |
| PAYER | `0xc42D84af5D24588aDC06D13BfB5Bf11aECCab0EB` | 0.000895 / 0.000179 / 0 |
| DEAL_HUNTER | `0xf99468Ba7C41D5E4dC713e11E286C1Faf1FD975c` | 0 / 0 / 0 |
| W_LEDGER | `0x4E0c2C442bd42dc139d9EB716DE6D8bE58505774` | 0 / 0 / 0.000979 |
| W_SYNC | `0x33aFF4aC99cFA86042F5B60af2dADE357F140ef4` | 0 / 0 / 0.000979 |
| W_SEED (lab city S) | `0x7e00F8C22cD55556a1070dC2F6536E1942A977d3` | 0 / 0 / 0.000979 |
| W_SEED_M (lab city M) | `0x31F5ebe121F31dCcBE651E500E30d645b20C225E` | 0 / 0 / 0.000979 |

Moved into FUNDER on 2026-11-05: **0.673559 WBT, 0.013894 Sepolia ETH, 2.808578 tGLM** (13 transfers). OPERATOR's spare WBT (0.165) was swept too; it keeps 0.000895 WBT and its 0.095 Sepolia ETH. The lab's hosted demo (`graphpay-lab.vercel.app`) no longer holds a relayer key: its spending routes answer 503.
