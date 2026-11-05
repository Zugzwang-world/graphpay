# PREFLIGHT (checked 2026-11-05, 15:15–16:10 IST, by the lab's pre-event session)

**In short:** the Mac, the logins, the Arkiv key and all three networks are ready for 21:00. FUNDER holds enough WBT and Sepolia ETH for every fresh wallet, and enough tGLM for everything except the M city. **Open before or during the build:** at least 9 tGLM and some test USDT to FUNDER, the laptop on power, and the rules questions for an organiser.

## 1. Tools on the founder's Mac

| tool | wanted | found | status |
|---|---|---|---|
| Node | 22.x (22.23.4, `FACTS.md` §5) | 22.23.4 installed through fnm; the shell default is **24.21.0**, and Claude Code's shell does not run fnm's use-on-cd hook | ok with a workaround: run Node-sensitive checks with `fnm exec --using=22.23.4`; CI and Vercel run 22. No Node-version problem is logged in the lab, which ran locally on 24 |
| pnpm | 10.34.9 via `packageManager` | 10.34.9 | ok |
| Foundry | 1.9.0 | forge, anvil, cast 1.9.0 (Homebrew) | ok; its Sepolia forks use the Glamsterdam gas rules by default (`FACTS.md` §1) |
| gh | any recent | 2.103.3 | ok |
| vercel | 65.10.0 (the flags in the pack were checked on it) | 65.10.0; 65.11.0 is out | ok; do not upgrade before the event |
| Claude Code | — | 2.1.318 (npm `latest` today) | ok |
| git | — | 2.53.0 | ok |

## 2. Logins and names

| what | found | status |
|---|---|---|
| GitHub | `gh` logged in as **`Zugzwang-world`** (keyring), scopes `repo`, `workflow`, `read:org`, `gist` | ok: enough to create the repo, push, set protection and auto-merge |
| repo name | `Zugzwang-world/graphpay` does **not** exist yet | ok: M0 creates it empty |
| Vercel | `vercel whoami` = `zugzwang-world`, team **Hrizzup** (Pro) | ok |
| Vercel project | `graphpay-event` does not exist yet | ok: M0 creates it (`vercel project create`, CLI 65.10.0) |
| pack | `~/Downloads/GraphPay-ThinkingPartner/handover/` (this folder) | ok |
| event folder | `~/graphpay` created empty at 16:12 IST | ok: the 9 pm session starts in it |

## 3. Arkiv access key

`ARKIV_ACCESS_KEY` is set in the lab's `.env` (name only). A read through the keyed Rabdi endpoint answered HTTP 200 (`eth_chainId` 7794095, head 243,367); a made-up key on the same endpoint answers **401 `INVALID_KEY`**, so our key is valid. Monthly quota: unknown (ask the Arkiv booth).

## 4. RPCs (2026-11-05 15:24 IST)

| network | endpoint | chain id | head | gas price | latency |
|---|---|---|---|---|---|
| Whitechain Sepolia | `https://rpc.testnet.whitechain.io` | 1874 ✓ | 12,276,118 (0 s old) | 5.001 gwei | 186–594 ms |
| Ethereum Sepolia | `https://ethereum-sepolia-rpc.publicnode.com` (reth 2.8.0) | 11155111 ✓ | 12,068,715 (12 s old) | 1,013 wei (base about 17 wei) | 319–361 ms |
| Arkiv Rabdi | `https://rpc.rabdi.db-chain.testnet.arkiv.network` (public and keyed) | 7794095 ✓ | 243,367 (1 s old) | 1 gwei | 297–887 ms |

Transfer gas to a brand-new address: Whitechain 21,000; Rabdi 21,000; **Sepolia 207,391 (estimate; 204,600 used)**. Estimate gas for every transaction.

## 5. Balances against the funding plan (after the sweep, 16:05 IST)

| wallet | network | holds | the plan needs (`WALLETS.md` §3) | status |
|---|---|---:|---|---|
| FUNDER | Whitechain (WBT) | **1.848** | 1.20 to the fresh wallets + 0.2 reserve | ok (about 0.65 left) |
| FUNDER | Sepolia (ETH) | **0.0139** | 0.009 to the owners and ACCEPTANCE_PAYER | ok (about 0.0049 left) |
| FUNDER | Rabdi (tGLM) | **2.858** | 2.6 at M0 (S city, W_LEDGER 1.5, W_SYNC 0.2); 9.4–11.6 in all | ok for M0; **gap of 6.5–8.7 for the M city and the mirror** |
| FUNDER | Whitechain (test USDT) | 0 | ≥ 5 (ideally 80) for the qualifying payment | **gap** |
| OPERATOR | Sepolia (ETH) | **0.0950** | ≥ 0.05 for the namespace (≥ 0.08 if gas goes above 0.5 gwei) | ok at today's gas |
| OPERATOR | Whitechain (WBT) | 0.000895 | none (no Whitechain role at the event) | ok |
| OPERATOR | Rabdi (tGLM) | 0 | none | ok |

The lab's other wallets were swept into FUNDER and are not used (`WALLETS.md` §5). The lab's hosted demo can no longer spend (its spending routes answer 503).

## 6. Gaps: founder steps

| # | what | where | why | by when |
|---|---|---|---|---|
| 1 | **At least 9 tGLM** to FUNDER `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65` on Arkiv Rabdi | the Arkiv booth first; https://hub.arkiv.network/faucet (amount per claim unknown) | the M city (6.3–8.5) and the mirror's second 0.5; FUNDER has 2.86 | 23:30 (M seeding starts) |
| 2 | **Test USDT** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: at least 5, ideally 80, to FUNDER on Whitechain Sepolia (1874) | the Whitechain workshop (16:30) or booth | the qualifying payment (C7); nobody outside Whitechain can mint it | any time; Friday evening at the latest |
| 3 | Ask an organiser the four questions in `DISCLOSURE.md` and send the written pre-event disclosure | an ETHGlobal organiser; the Hacker Dashboard | the rules bar prior designs and say AI should assist, not create the whole project (`FACTS.md` §6) | 21:00 kickoff |
| 4 | **Laptop on power** (it was on battery at 81%), and System Settings → Battery → Options → "Prevent automatic sleeping on power adapter when the display is off" on | the Mac | system sleep is set to 1 minute and only held off while a keep-awake process runs; the mirror runs overnight on this Mac | 20:45 |
| 5 | Grant the Vercel GitHub app access to `graphpay` (grant only, no import) | vercel.com → Hrizzup → Settings → Git | the repo exists only from about 21:05 | 21:10 |

No other gap. Nothing in this preflight needs a key or a password from the founder.
