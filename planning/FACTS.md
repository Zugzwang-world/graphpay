# FACTS (verified values for the event build)

Every value the event build relies on, with its source, the date it was checked and its status. **Code uses only `verified`, `verified-on-chain` or `measured` values.** A row marked **9 pm** in the last column must be re-checked at the start of the event (M0) and the result recorded in the event repo's own `docs/technical/FACTS.md`.

Status: `verified` = checked against the primary source; `verified-on-chain` = seen in mined transactions or live node responses; `measured` = our own measurement (numbers depend on conditions); `from-research` = from the pre-event research reports, not re-checked; `unverified` = no primary source; `decided` = an ADR chose between conflicting sources. "Lab" = the private pre-event lab (`DISCLOSURE.md`); its transaction hashes are public on the explorers.

## 1. Networks

| fact | value | source | date | status | re-verify |
|---|---|---|---|---|---|
| Whitechain testnet | Whitechain Sepolia, chain id **1874** (0x752); mainnet is 1875; OP Stack L2 settling on Sepolia; EVM Prague | https://docs.whitechain.io/learn/network/reference.md; `eth_chainId` | 2026-11-03 | verified | |
| Whitechain RPC | **primary** `https://rpc.ankr.com/whitechain_testnet` (Ankr; `eth_chainId` answered `0x752` = 1874 on 2026-11-05 15:22 UTC); **backup** `https://rpc.testnet.whitechain.io` (WebSocket `wss://rpc.testnet.whitechain.io/ws`; public limit 50 requests/s per IP, burst 500, up to 100 calls per batch: from research). Ankr's WebSocket (WSS) needs a premium plan: use the backup's WebSocket or poll over HTTPS | Ankr: founder (5 Nov) and one `eth_chainId` call; backup: same docs | 2026-11-05 | Ankr chain id verified; WSS premium founder-reported | |
| Whitechain explorer | https://explorer.testnet.whitechain.io (Blockscout; `/api/v2` responds; verifier API ends in `/api/`) | https://docs.whitechain.io/build/block-explorer/overview.md | 2026-11-03 | verified | |
| Whitechain faucet | **2 WBT a day** per GitHub account older than 30 days (founder, 5 Nov; the docs said 0.5 WBT per rolling 24 h, Standard tier, on 3 Nov), https://faucet.testnet.whitechain.io; captcha; per-wallet and per-IP limits | founder (5 Nov); https://docs.whitechain.io/learn/get-started/get-testnet-wbt.md (3 Nov) | 2026-11-05 | founder-reported | **9 pm** |
| Whitechain fees | 1 s blocks; base fee 5 gwei; gas price paid 5.001 gwei; block gas limit 40M; L1 data fee 2.5e-15 to 2.6e-13 WBT per tx | lab receipts; `eth_feeHistory` | 2026-11-04 | verified-on-chain | |
| Ethereum Sepolia | chain id **11155111**; public RPC `https://ethereum-sepolia-rpc.publicnode.com` (load balanced: a read right after a write can lag a block); gas price was about 19 wei on 2026-11-04 | https://github.com/eth-clients/sepolia; lab real runs | 2026-11-04 | verified | gas price **9 pm** |
| Sepolia Glamsterdam | **Active since 2026-10-06 13:53:36 UTC** (epoch 353,024). New account: +183,600 state gas (a 1-wei transfer to an empty address used 204,600 gas, tx `0x0d9a515fd9292248b87a17ecd1b612da6c4919236f87f94ffefc9428ed16d507`; a 21,000 limit was mined and **failed**, tx `0x39ef9be54fccee8fe1208c51abcb0c6627505e3c58d684cfd485bdabe91eb854`); CREATE +183,600 state + 12,000; code deposit 1,530 per byte; SSTORE 0→nonzero 97,920 state + 10,000 + 2,100 (spec). The lab's ENS gas (2026-11-04) is post-fork. anvil 1.9.0 forks of Sepolia apply it by default (`--hardfork prague` does not). EIPs at Last Call: values may change | https://blog.ethereum.org/en/2026/09/17/glamsterdam-testnet-announcement; https://eips.ethereum.org/EIPS/eip-8037; https://eips.ethereum.org/EIPS/eip-2780; Sepolia receipts; local anvil | 2026-11-05 | verified (transfer on-chain; CREATE and SSTORE from the spec) | **9 pm** (estimate gas, never assume 21,000) |
| Sepolia gas price | base fee about 17 wei, suggested tip about 1,000 wei (2026-11-05 15:30 IST); a 1 gwei tip was mined in the next block | `eth_gasPrice`, `eth_feeHistory`, sweep receipts | 2026-11-05 | verified | **9 pm** |
| Arkiv testnet | Rabdi, chain id **7794095** (0x76edaf); Tiramisu, Braga and Kaolin are retired | https://docs.arkiv.network/networks/rabdi/; `eth_chainId` | 2026-11-03 | verified | |
| Arkiv RPC | `https://rpc.rabdi.db-chain.testnet.arkiv.network`, access key as the last path segment (keys at hub.arkiv.network/access-keys); WebSocket `wss://` same host | docs page above; SDK `src/chains/rabdi.ts` | 2026-11-03 | verified | |
| Arkiv explorer, faucet | https://rabdi.explorer.arkiv.network; faucet https://hub.arkiv.network/faucet (amount per claim not recorded) | docs page above | 2026-11-03 | verified | faucet limits **9 pm** |
| Arkiv gas | tGLM (18 decimals); 1 gwei on every transaction (1,000,000 gas = 0.001 tGLM); EIP-1559 accepted; block gas limit 30M; SDK caps a tx at 2^24 gas; block time 2 s | lab G-0, G-2 (tGLM transfer `0xcadd9ec44419af6a9a7ee8082c45321e386288f5c46960e1f8ac326baa9ce472`) | 2026-11-04 | verified-on-chain | |

## 2. Whitechain tokens and contracts

| fact | value | source | date | status | re-verify |
|---|---|---|---|---|---|
| **Test USDT (use this)** | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: "Tether USD", USDT, 6 decimals, EIP-1967 proxy over a verified TetherTokenV2 | https://whitechain.io/tokens/whitechain.tokenlist.json (v3.0.0, 2026-10-28); explorer API `/api/v2/tokens/0xcedf…`; fork calls | 2026-11-03 | decided (ADR-0004), verified on-chain | |
| **Never use** | `0xaa7962d073935D387e8d442DA1D7149C81388f46`: "Bridged USDT (Whitechain)", USDT.e | docs token-list page (v1.1.0, 2026-10-16) | 2026-11-03 | verified | |
| Test USDT signing | EIP-2612 `permit` (domain name "Tether USD", version "1", chain 1874, verifyingContract = proxy; v,r,s and packed-bytes `0x9fd5a6cf` overloads) and EIP-3009 (`transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, `authorizationState`) work; no `eip712Domain()`, no `version()`; `mint` is owner-only | Foundry fork tests (lab, incl. an EIP-3009 parity suite run against the real token); the EIP-2612 domain and a gasless permit confirmed live in the lab's USDT proof (`DOMAIN_SEPARATOR` `0xcdcfacb6…2a25` = {"Tether USD", "1", 1874, proxy}; permit tx `0xc02855a0a562b46ae8b0146cf56470993d7f6923fa89787cd17b68fadedb9cde`) | 2026-11-05 | verified-on-chain | |
| Test USDT supply | about 1,945,270 USDT, 50 holders, one holds about 1M; no faucet; FUNDER holds 3.75208 (5 Nov, after the lab proof swept everything back) | explorer API | 2026-11-04 | verified | **9 pm** (ask at the workshop) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` deployed on 1874 (9,152 bytes); domain name "Permit2", chain 1874, no version | `cast` on a fork | 2026-11-04 | verified | |
| Other system contracts on 1874 | deterministic deployer `0x4e59…956C`; EntryPoint v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (v0.6, v0.8 also present); Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`; `x402ExactPermit2Proxy` `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` (2,913 bytes; witness `Witness(address to,uint256 validAfter)`) | `cast` on a fork | 2026-11-04 | verified (code only) | |
| Gas per real call | first agent settle with gasless approval 312,024 (0.00156 WBT); settle with existing approval 234,292; re-order 252,082; recorded failure 160,525; refund 65,681; `markDelivered` 36,027; `setPolicy` 95,233 new / 38,568 update; `createSubscription` 437,794; `renew` 201,555; `cancelWithSig` 44,582; checkout deploy 3,596,042 (0.018 WBT); stand-in deploy 1,307,372. **On the real test USDT** (lab proof, 2026-11-05): human-payer settle with the gasless approval 320,346; refund 75,344 (+15% vs the stand-in: the token is a proxy); `markDelivered` 36,027 (same); checkout deploy 3,596,042 (same); USDT `transfer` 39,023–60,923; `permit` 72,081 | lab receipts on 1874 (first agent payment `0xbc779554b3df52b2aece23dbcfbe99b3b9bef0ce15fa13884e93cfc1b3582505`; public-URL payment `0x7a0dd6abaf20182db522c1b1fefc40ee109b314329c313316ac1d4dbaa67f6b4`; USDT settle `0xcaaabdac1db5866c8b4a45b0734d399cb00425f6f87fd151bc0416ab5c139864`, USDT refund `0xf4b20fa4a9dfce1b4a0cd7156dbfd2a5f5ba1ab9113db17d444a7ca271e5df1e`; revoked agent recorded `0xfffe69b7f2494dc054010d939787af5289dc4a465fec2a0c870aa1f3ec8946d8`; renewal `0x273372ee6daf011214f7ed73e9cbeef9233404ba46b61553886b768d313eadbc`) | 2026-11-04 | verified-on-chain | |
| Settle gas cap | `MAX_SETTLE_GAS` = 450,000 (founder decision); 300,000 refused the first settle | lab | 2026-11-04 | decided | |
| Wallet ↔ node binding (lab contract) | `setPolicy` reverts `BadInput("wallet bound to another node")` when the wallet already backs another node; moving a node to a new wallet releases the old one. The policy check: a bound wallet must pay as its node (else `NODE_MISMATCH`); a human payment (node 0) only from an unbound wallet; policy must exist with `wallet == payer`; `revoked` → `AGENT_REVOKED`; `expiry != 0 && now >= expiry` → `AGENT_EXPIRED` (0 = never); spent in (node, stored epoch, day) + amount > cap → `SPEND_CAP`. `settleOrder` takes no epoch | lab contract source and Foundry tests; lab payments spec §2 | 2026-11-04 | verified (fork tests) | |
| Lab ENS caps | real `payer.vitalik.gp-lab.eth` had `graphpay.cap_micro` = 6 USDT and a 6.00 policy; disposable agents 1 USDT | lab integration facts (F-4) | 2026-11-04 | verified-live | |
| A whole day of lab activity | about 0.046 WBT (deploys, setup, every lifecycle run, the public payment) | lab tx log | 2026-11-04 | measured | |
| Blockscout verification | `forge verify-contract … --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ --compiler-version 0.8.30 --evm-version prague --num-of-optimizations 200 --via-ir --watch` passes; shows `is_verified` true, `is_fully_verified` false (no CBOR metadata) | explorer API `/api/v2/smart-contracts/<addr>` | 2026-11-04 | verified | |
| Lab deployments (do **not** reuse) | stand-in `gpUSD-TEST` `0x395dc742053F1D77595ED18884628B809A34f3D6`; checkout `0x4fD68FB630711Ef592F24c2441eA23B270C1e442`; superseded first stand-in `0xa173…95df`. The event deploys its own | lab deployments record | 2026-11-04 | verified-on-chain | |
| x402.org facilitator | supports only Base Sepolia and Solana Devnet: run our own | R2 | 2026-11-03 | from-research | |

## 3. ENS (Ethereum Sepolia, ENSv2)

| fact | value | source | date | status | re-verify |
|---|---|---|---|---|---|
| ENSv2 Sepolia addresses | RootRegistry `0xb458d6a3a77919449d03e7a6903c26827c1ec43f`; ETHRegistry `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`; ETHRegistrar `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3`; StandardRentPriceOracle `0x8196665d4ca7488b6474a9ec8e7d2719fb42263a`; MockUSDC `0x240b0316df57887dbbe58b586508b19e633a14aa` (6 dec, `mint` open to anyone); MockDAI `0xf6fac8a58a0be13b9197f27c41b73162fe32572b`; VerifiableFactory `0xda70306c98e97ece36f997a21368e53298572991`; UserRegistryImpl `0x9bd8a88719068d09ecee662f36c0e3856708366a`; PermissionedResolverImpl `0x115eb53f0c60696633855f90b138178fb40b2b2c`; UniversalResolverV2 `0x24e1d8e068620b647ca097f961a61055f4f42d72`; **Universal Resolver proxy `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`** (viem's built-in `sepolia` points here); UniversalHelper `0xd453e5bdb62cc3bea84341b1e306319c8ffd7dfe` | https://docs.ens.domains/learn/deployments/ ("Sepolia (ENSv2)", redeployed 2026-09-15); code present on-chain | 2026-11-04 | verified | **9 pm** |
| Registration parameters | commit age 60 s min, 86,400 s max; minimum registration and grace 2,419,200 s (28 days); 1 year = 8,000,021 MockUSDC units; the registrar charges `msg.sender`; the owner gets SET_SUBREGISTRY(+admin), SET_RESOLVER(+admin), CAN_TRANSFER_ADMIN, no RENEW or UNREGISTER | ETHRegistrar source on Sourcify; fork calls | 2026-11-04 | verified | |
| Role bitmaps | registry: REGISTRAR `1<<0`, REGISTER_RESERVED `1<<4`, SET_PARENT `1<<8`, UNREGISTER `1<<12`, RENEW `1<<16`, SET_SUBREGISTRY `1<<20`, SET_RESOLVER `1<<24`, CAN_TRANSFER_ADMIN `(1<<28)<<128`; resolver: SET_ADDRESS `1<<0`, SET_TEXT `1<<4`, SET_CONTENTHASH `1<<8`, SET_ABI `1<<12`, SET_INTERFACE `1<<16`, SET_NAME `1<<20`, SET_DATA `1<<24`, LINK `1<<28`, UPGRADE `1<<124`; admin = role `<<128`; `ALL_ROLES` = `0x1111…1111` (64 nibbles) | verified Solidity source on Sourcify | 2026-11-04 | verified | |
| `ens_epoch` | low 32 bits of `getState(labelhash).resource`; read only while REGISTERED; bumps on re-registration after a lapse and on `unregister`; not on role changes or `renew` revival; fresh names are epoch 0 | source + fork experiments | 2026-11-04 | verified | |
| Kill-switch behaviour | after owner `unregister`: AVAILABLE, resolver 0x0, the parent's resolver answers with **empty strings, not an error**; `renew()` afterwards makes it RESERVED and brings old records back; the operator and the agent cannot `unregister` | fork + real Sepolia (kill tx `0x66b444d3c32a7b9f06b216c5842b52b6943f4a3a562d816d70cc754cdfc79de7`) | 2026-11-04 | verified-on-chain | |
| `graphpay.eth` | registered bare by OPERATOR `0x531D49A595946a72b9C47b78D287Ff6e6B3CfF32`; resolver 0x0; subregistry 0x0; expiry 1825315020 (2027-11-04); register tx `0x8d0aceffae0a563e6daefeffa2643dbcfc3c65f73d93743136444db3b15b4145` | `getState`, `getResolver`, `getSubregistry` on real Sepolia | 2026-11-04 | verified-on-chain | **9 pm** (still owned, still bare) |
| Namespace cost | lab namespace (1 root, 4 owners, 13 agents, wildcard): 63 transactions, 62.2M gas on a fork; 77 transactions, 68.4M gas on real Sepolia; one agent = 3 transactions (resolver 1.5–3.0M gas, register 0.27–0.39M, grantSetterRoles 0.26M); `unregister` 163,102 | fork and real receipts | 2026-11-04 | measured | |
| Gate cost | 12 contract reads + 1 block read per 4-label name; 1.2–2.3 s on the public Sepolia RPC (3 runs) | unit test count; lab integration runs | 2026-11-04 | measured | |
| viem and ENSv2 | viem 2.57.16 `getEnsText`, `getEnsAddress({ coinType })` work unchanged against ENSv2, including wildcard names; no ENSIP-24 data action | lab fork and real runs | 2026-11-04 | verified | version **9 pm** |
| ENS ABIs | generate from Sourcify (`https://sourcify.dev/server/v2/contract/11155111/<address>?fields=abi`); `@ensdomains/ensjs` 5.2.12 depends on `@ensdomains/ensjs-abi` 5.0.5 (partial ABIs); an `ensjs-abi@5.2.12` does not exist | `npm view` | 2026-11-04 | verified | **9 pm** |
| Whitechain coin type | `2147485522` = `0x80000752` = `0x80000000 | 1874` (ENSIP-11) | R3; lab reads | 2026-11-04 | verified | |
| ENSIP-31 test USDT entry | `0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7` (28 bytes); the draft's own vectors reproduce byte for byte | https://docs.ens.domains/ensip/31 (draft) | 2026-11-04 | verified (draft) | **9 pm** (draft changed in October) |
| ENSIP-26 records | `agent-context`, `agent-endpoint[mcp|a2a|web]` | R3 | 2026-11-03 | from-research | |
| ERC-8004 Sepolia | IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`: code exists (130 bytes each) | `eth_getCode` | 2026-11-04 | unverified (code only) | |
| Mainnet ENSv2 | the ENS pages disagree; do not claim it | docs | 2026-11-04 | conflict | |

## 4. Arkiv

| fact | value | source | date | status | re-verify |
|---|---|---|---|---|---|
| SDK | `@arkiv-network/sdk` 1.0.1 (npm `latest`, published 2026-11-02); peer `viem ^2.0.0`; exports listed in `SPEC/ARKIV_GRAPH.md` §2 | npm registry; installed type declarations | 2026-11-03 | verified | **9 pm** |
| Limits | 32 attributes incl. schema tag (31 columns); string 128 bytes; name 32 bytes; `bytes` 128 KiB per create or patch; page 100 (`limit(101)` rejected); max lifetime 7,884,000 blocks | SDK constants; live calls | 2026-11-03 | verified | |
| Predicate budget | 64 leaves incl. schema tag and owner; 65 → `-32004`; AND/OR depth ≤ 4; query text ≤ 8 KiB | live probe (9 calls); node `limits.rs` | 2026-11-04 | verified | |
| Request body cap | 256 KiB: 262,138 bytes pass, 262,222 get HTTP 413 `{"error":"BAD_REQUEST","message":"request body too large"}`; about 131 KB calldata per tx | `eth_call` bisection | 2026-11-04 | verified-on-chain | |
| Repeated create | duplicates (key = `keccak256(chainId, registry, owner, entityNonce, salt)`); txs `0x69a14ab7d634be89e0acfd0cbf7801aad90f61c98b84043b6a63f752179eca10`, `0x32ba7611cde95ccae441b01dc9ceb5733cb18f9fe6318cbdd0e2d298e1dd5eb9` | lab G-3 | 2026-11-04 | verified-on-chain | |
| Batch atomicity | a create plus a failing patch reverted together (`0x8e2aa0cb2cbd670e5bb3cfdb4e7ced4e7b74d1ea13e0dba9eef02bd3d95bbafb`) | lab G-3 | 2026-11-04 | verified-on-chain | |
| Read-after-write | visible to `count()` on the first query after the receipt, 5 of 5 | lab G-3 | 2026-11-04 | verified-on-chain | |
| Same nonce twice | one mined, the other refused | lab G-3 | 2026-11-04 | verified-on-chain | |
| Readonly entity | patch reverts; extend, transfer, delete still work | lab G-3 | 2026-11-04 | verified-on-chain | |
| `key` column with a namehash | works; stored lowercase; `eq`, `or`, `count` exact; upper-case query values match | lab G-1 (`0xa1a1814bc5056a3be3d7c84bad3e37bc250e1c70717f8fbe2fb82794d75e2fdd`) | 2026-11-04 | verified-on-chain | |
| camelCase names | accepted on-chain (research said they revert: out of date) | lab G-1 | 2026-11-04 | verified-on-chain | |
| ORDER BY | u64 at scale (400 rows over 4 pages, indexed and unindexed), `$key`, `str`; ties in creation order (SDK PR #130 "unsupported" is out of date) | lab G-4 (read-only) | 2026-11-04 | verified-live | |
| Non-indexed filter | matches nothing, no error | node `docs/api-spec.md` §4 | 2026-11-04 | verified (source) | |
| Write cost | 13-column row 214,800 gas (1 day) / 223,038 (14 days) / 589,094 (max); tally patch 51,369 (7 counters) / 37,782 (1); extend 1→14 days 71,117, 14 days→max 408,940; delete 162,788 alone, 115–135k in a batch of 60; **money event 310,527 (0.00031 tGLM)**, with link 333,320, first meeting 822,393 / 977,978 | lab G-2 (`0x6291413ca0288124f333333c7a1721dfa7b5b25459338b39869d7d336d900239`, `0x1649b2361ef7297564a455052b6c6fc45061c9a6e2d7e2b45206feac85a15875`) | 2026-11-04 | verified-on-chain | |
| Calldata per op | create 352 bytes + 192 per attribute; patch 256 + 192 per column; + 68 per tx; a money event 10–11 KB | lab G-2 receipts | 2026-11-04 | verified-on-chain | |
| Rate limit | `ratelimit: limit=5000, remaining=N, reset=10` with a key (1 unit per call); `limit=2000` keyless; no 429 in 24,484 responses; monthly key quota unknown | live headers | 2026-11-04 | verified-on-chain (semantics inferred) | **9 pm** (ask the booth) |
| Entity contract | `0x4400000000000000000000000000000000000044` (`execute((uint8,bytes)[])`) | SDK `src/consts.ts`; tx `to` | 2026-11-04 | verified | |
| Log backfill | `eth_getLogs` fails about 1,000 blocks behind head (arkiv#283) | R1 | 2026-11-03 | from-research | |
| Read latency | warm call about 0.29–0.32 s from the founder's Mac; cold first call 0.9–1.1 s | lab E-A8, live bench | 2026-11-04 | measured | |
| Seeding cost (pre-merge model) | S: graph 88 tx, 0.491 tGLM, 10.7 min; plain 42 tx, 0.174, 4.3 min. M: graph 905 tx, 4.622 tGLM, 79.2 min; plain 202 tx, 1.704, 20.5 min; 5–8 s per tx | lab G-5 manifests | 2026-11-04 | verified-on-chain | |
| Cast history size | the deck's three shops over 90 days = 25,116 events (1,005 batches of 25; 29,320 entities; 4.3–4.5 s on the emulator). 5% = about 1,256 events, about 100 Rabdi transactions when 25-event batches are split by bytes | lab integration facts (F-6); arithmetic | 2026-11-04 | measured (emulated) / computed | |
| Local dev node | `ghcr.io/arkiv-network/arkiv-reth-dev:v1.0.1`, chain 1337 (not run in the lab: no Docker) | Arkiv release v1.0.1 | 2026-11-04 | verified (not run) | |

## 5. Packages and tools (lab pins; re-verify all at 9 pm with `npm view` / `--version`)

| item | value | date | status |
|---|---|---|---|
| Node | 22.23.4 "Jod" (Maintenance LTS, EOL 2027-04-30; still the newest 22.x on 2026-11-05); Vercel default is 26.x, 20.x deprecated. On the founder's Mac 22.23.4 is installed through fnm but the default is 24.21.0, and Claude Code's shell does not run fnm's use-on-cd hook (`PREFLIGHT.md`) | 2026-11-05 | verified · **9 pm** |
| pnpm | 10.34.9 via `packageManager` (npm `latest` is 12.16.1; `latest-10` is 10.34.9) | 2026-11-03 | verified · **9 pm** |
| Foundry | 1.9.0 (2026-11-02); `--broadcast` required for `forge create` | 2026-11-03 | verified · **9 pm** |
| solc | 0.8.30, EVM `prague` (0.8.31+ default to `osaka`; latest 0.8.38) | 2026-11-03 | verified |
| OpenZeppelin Contracts | v5.7.0 (`cab1993`) | 2026-11-03 | verified · **9 pm** |
| forge-std | v1.9.7 (`77041d2`) | 2026-11-03 | verified · **9 pm** |
| Permit2 source | Uniswap Permit2 at `0x000000000022D473030F116dDEE9F6B43aC78BA3`; source at commit `cc306b6` | 2026-11-03 | verified |
| viem | 2.57.16 | 2026-11-03 | verified · **9 pm** |
| x402 | `@x402/core`, `@x402/evm`, `@x402/hono`, `@x402/fetch` 2.29.0 | 2026-11-03 | verified · **9 pm** |
| AI SDK | `ai` 7.0.162, `@ai-sdk/anthropic` 4.0.96, `@ai-sdk/mcp` 2.0.90 | 2026-11-03 | verified · **9 pm** |
| model id | `claude-haiku-5-5` (live runs on 2026-11-04: the whole errand used 66,535 tokens and 13 tool calls on the first run, 68,730 and 14 on the hardened second run; Whitechain fork, Arkiv emulator, real Sepolia ENS) | 2026-11-04 | verified-live · **9 pm** |
| zod | 4.6.7 | 2026-11-03 | verified · **9 pm** |
| hono / @hono/node-server / tsx | 4.13.16 / 2.1.6 / 4.23.15 | 2026-11-03 | verified · **9 pm** |
| graphql | 16.14.2 (one major across the repo; 17.0.2 exists) | 2026-11-03 | verified · **9 pm** |
| graphql-yoga | 5.24.6 (6.0.x is `latest` since 2026-10-22; avoid) | 2026-11-04 | verified · **9 pm** |
| dataloader | 2.2.3 | 2026-11-03 | verified · **9 pm** |
| Next.js / React | 16.4.4 (needs Node ≥ 20.9; builds type-check with the local `tsc`) / 19.3.1 | 2026-11-03 | verified · **9 pm** |
| TypeScript / ESLint | 5.9.3 / 9.39.5 (the Next template's majors; npm `latest` is TS 7.0.2, ESLint 10) | 2026-11-03 | verified |
| vitest | 5.1.0 | 2026-11-03 | verified · **9 pm** |
| `@modelcontextprotocol/sdk`, sigma, graphology | 1.32.2; sigma 3 + graphology (from R1, not installed) | 2026-11-03 | from-research · **9 pm** |
| GitHub Actions | `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `foundry-rs/foundry-toolchain@v1.9.2` | 2026-11-03 | verified · **9 pm** |
| Vercel CLI | 65.10.0 (65.11.0 available on 2026-11-05) | 2026-11-05 | verified · **9 pm** |
| Claude Code | 2.1.318 installed and npm `latest` on 2026-11-05 (2.1.317 on 2026-11-03); deny rules hold in bypass mode | 2026-11-05 | verified |

## 6. Platform

| fact | value | source | date | status |
|---|---|---|---|---|
| GitHub | account `Zugzwang-world` (Pro); branch protection and auto-merge on a **public** repo work on any plan | GitHub docs | 2026-11-03 | verified |
| Vercel team | `hrizzup` ("Hrizzup"), Pro, the CLI's default team | `vercel api /v2/teams/<id>` | 2026-11-03 | verified |
| Vercel cron | Pro: once per minute; up to 100 jobs per project | https://vercel.com/docs/cron-jobs/usage-and-pricing | 2026-11-03 | verified |
| Vercel pnpm | supports pnpm 6–12; pin via `packageManager` | https://vercel.com/docs/package-managers | 2026-11-03 | verified |
| Vercel functions | default timeout 300 s; bodies up to 4.5 MB; streaming works on the Node runtime | Vercel knowledge update (2026-09-18) | 2026-11-05 | verified (docs) |
| ETHGlobal Mumbai deadline | **Saturday 7 November 2026, 09:00 IST**; "Late submissions won't be accepted"; submit on the Hacker Dashboard (title, description, repo link; up to 3 partner prizes); finalist judging 7 min (4 demo, 3 Q&A), slot on the dashboard | start page https://ethglobal.com/events/mumbai/info/start; submission guidelines https://ethglobal.com/events/mumbai/info/details | 2026-11-05 | verified · **9 pm** |
| Whitechain prizes | the rules allow **one Whitechain prize per project** | founder (5 Nov, event rules) | 2026-11-05 | founder-reported | **9 pm** |
| ETHGlobal rules (pre-event work, AI) | Classic track: "all work on your project must begin after the hackathon officially starts"; prior project-specific code, designs or assets barred unless public libraries or starter kits; pre-existing work disclosed **in writing to the ETHGlobal team** or risk disqualification; "Clearly distinguish between what's new and what's reused"; version control required, "large single commits or missing histories may be disqualified". AI "generally permitted": document where and how; AI should assist, "not to create the entire project"; spec-driven work allowed but "all spec files, prompts, and planning artifacts" must be in the repo. Video: no text-to-speech or AI voiceover | general rules https://ethglobal.com/rules; submission guidelines https://ethglobal.com/events/mumbai/info/details | 2026-11-05 | verified (pages read) · **9 pm**: ask an organiser (`DISCLOSURE.md`) |

## 7. Synthetic scenario values (labelled, not measurements)

Cast and shop table (ADR-0013): kesar-kingdom 4,812 orders, 1.2% refunds, 97% on time, 4.80 for 12; jamun-junction 2,190, 18.4%, 71%, 3.30; syrup-street 1,204, 3.1%, 93%, 4.20. Order: 12 gulab jamun for 4.80, budget 6, by 8 pm IST; refund 0.80 for two squashed jamuns. Computed ranking: 0.986 / 0.934 / 0.821. These are inputs to the demo, always shown with a "synthetic demo data" label.
