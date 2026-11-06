# FACTS (event repo, re-verified at M0)

Every value the event code relies on, re-checked against primary sources at the start of the event (`planning/FACTS.md` rows marked **9 pm**), with source, time and status. Statuses: `verified`, `verified-on-chain`, `measured`, `changed` (from what to what), `open (founder)`, `conflict`, `unverified`. Code uses only `verified`, `verified-on-chain` or `measured` values. Tracks add rows under their own heading at the end.

Checked 2026-11-05, 21:47 to 22:25 IST, by the M0 verifier (read-only: public RPCs, `cast` 1.9.0, `curl`, `npm view`, `gh api`; nothing signed or installed) and by main (the rows marked *main*). The `@arkiv-network/sdk` 1.0.1 tarball was fetched once, its sha512 matched npm's `integrity`, and only its type declarations were read.

Shorthand: `SEP` = `https://ethereum-sepolia-rpc.publicnode.com`, `WC1` = `https://rpc.ankr.com/whitechain_testnet`, `WC2` = `https://rpc.testnet.whitechain.io`, `RAB` = `https://rpc.rabdi.db-chain.testnet.arkiv.network`, FUNDER = `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65`, OPERATOR = `0x531D49A595946a72b9C47b78D287Ff6e6B3CfF32`.

## Results


| fact | value now | source (URL or exact command) | checked (IST) | status | note |
|---|---|---|---|---|---|
| Whitechain chain id (primary RPC) | `0x752` (1874) | `eth_chainId` (curl POST) on `WC1` | 21:47 | verified-on-chain | |
| Whitechain chain id (backup RPC) | `0x752` (1874) | `eth_chainId` on `WC2` | 21:47 | verified-on-chain | |
| Arkiv Rabdi chain id | `0x76edaf` (7794095) | `eth_chainId` on `RAB` (no key) | 21:47 | verified-on-chain | |
| Sepolia chain id | `0xaa36a7` (11155111) | `eth_chainId` on `SEP` | 21:47 | verified-on-chain | |
| Whitechain faucet limit | Docs: Standard tier, GitHub account at least 30 days old, **0.5 WBT per rolling 24 h**. Wallet, IP and GitHub account are each limited separately. Captcha. The faucet page shows one drip per GitHub account and gives no amount before sign-in | https://docs.whitechain.io/learn/get-started/get-testnet-wbt.md ; https://faucet.testnet.whitechain.io | 22:00 | verified-on-chain (settled by main, 22:12) | The founder says 2 WBT a day. The docs still say 0.5, as on 3 Nov. The amount only shows after a GitHub sign-in, which was not done. Plan on 0.5 until the founder sees 2 in the faucet UI. FUNDER holds 1.825745 WBT now. **Settled:** FUNDER rose by exactly 2 WBT at 22:12 IST, the founder's drip, so plan on 2 WBT a day per GitHub account |
| Sepolia base fee | 19 wei (block 12,070,610); 20 wei at 22:04 (block 12,070,692) | `cast base-fee --rpc-url SEP`; `cast rpc eth_feeHistory 20 latest '[0,1,5,10,25,50]' --rpc-url SEP` | 21:47, 22:04 | verified-on-chain | The pack had about 17 wei (15:30 IST) |
| Sepolia suggested tip | **3 wei** (`eth_maxPriorityFeePerGas` = `0x3`, same at 22:04) | `cast rpc eth_maxPriorityFeePerGas --rpc-url SEP` | 21:47, 22:04 | changed (about 1,000 wei → 3 wei) | Fee history, last 20 blocks: the lowest percentiles are mostly 3 wei, so 3-wei tips are being mined. 25th percentile 0.05 gwei; median about 1 gwei (999,999,981 wei) |
| Sepolia `eth_gasPrice` | 22 wei (`0x16`); 23 wei at 22:04 | `cast rpc eth_gasPrice --rpc-url SEP`; `cast gas-price` | 21:47, 22:04 | verified-on-chain | The pack had about 19 wei (4 Nov) |
| ENS-track gas rule (stop if base fee + tip > 0.5 gwei) | 19 + 3 = **22 wei** (23 wei at 22:04), about 0.000000022 gwei. **Not triggered.** OPERATOR holds 0.094999998650647766 ETH (floor 0.05) | readings above; `cast balance 0x531D49A595946a72b9C47b78D287Ff6e6B3CfF32 --ether --rpc-url SEP` | 22:04 | verified-on-chain | The rule would only trip if someone hard-coded a 1 gwei tip, which is today's median paid tip. Use the node's suggested tip. At 23 wei, 75M gas costs about 1.7e-9 ETH |
| Sepolia 1-wei transfer to a new address | **207,391 gas** (same for two different random addresses). The same transfer to an existing account (OPERATOR) costs 21,000 | `cast estimate --from 0x5c359FC0Edb28f918C8D8E44418339CA55c67e65 --value 1 <random address> --rpc-url SEP`. Recipients `0x6B96f980A2B159Bd3C9A772d85f0b7A3aDd76A93` and `0xd52EAd9c7B119553E26197d2a87E1525aee3335C`: nonce 0, no code, balance 0 | 21:48 | verified-on-chain | The Glamsterdam new-account surcharge is still active. This matches the expected ~207,000 (the lab mined 204,600). Never use 21,000 |
| Whitechain 1-wei transfer to a new address | 21,000 on both RPCs | same `cast estimate`, `--rpc-url WC1` and `--rpc-url WC2` | 21:48 | verified-on-chain | |
| Rabdi 1-wei transfer to a new address | 21,000 | same `cast estimate`, `--rpc-url RAB` | 21:48 | verified-on-chain | |
| Glamsterdam EIPs | EIP-8037 and EIP-2780 are both still **Last Call** | https://eips.ethereum.org/EIPS/eip-8037 ; https://eips.ethereum.org/EIPS/eip-2780 | 22:03 | verified | The values can still change, so keep estimating gas |
| Arkiv faucet amount per claim | Not shown. The page says one claim per wallet per cooldown window; the claim form only loads with a wallet | https://hub.arkiv.network/faucet ; https://docs.arkiv.network/networks/rabdi/ (links to the faucet, no amount) | 22:00 | open (founder) | FUNDER holds 2.858493637 tGLM |
| Arkiv rate limit (no key) | `ratelimit: limit=2000, remaining=1997, reset=4` | `curl -D - -X POST --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' RAB` | 22:00 | verified-on-chain | The keyed limit (5000) was not re-checked because no key was used. The monthly quota is still a question for the booth |
| Test USDT supply, holders, FUNDER balance | totalSupply 1,945,273 USDT (6 decimals); **91 holders**; FUNDER holds **153.75208 USDT** | `cast call 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 'totalSupply()(uint256)'` and `'balanceOf(address)(uint256)' <FUNDER>` on `WC2` and `WC1`; https://explorer.testnet.whitechain.io/api/v2/tokens/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 ; `/api/v2/addresses/<FUNDER>/token-transfers?type=ERC-20&token=0xcedf…` | 22:02 | changed (holders 50 → 91; FUNDER 3.75208 → 153.75208) | 150 USDT reached FUNDER at 21:54:54 IST from `0x6031524fb7E5a935D55Ba2bd6EB516c0ABc4aa6B` (tx `0x09919bf6d37b5fe5efa1fa54cbb3d819651d0dc4155ea19e1a964ead99db780a`). Supply is unchanged (the pack had about 1,945,270) |
| ENSv2 Sepolia addresses (12) | The docs page lists all 12 pack addresses unchanged under "Sepolia (ENSv2)", and every one has code: RootRegistry 16,000 bytes, ETHRegistry 16,000, ETHRegistrar 8,037, StandardRentPriceOracle 8,355, MockUSDC 4,309, MockDAI 4,309, VerifiableFactory 1,524, UserRegistryImpl 18,982, PermissionedResolverImpl 15,608, UniversalResolverV2 18,792, UR proxy 2,491, UniversalHelper 4,933 | https://docs.ens.domains/learn/deployments/ (HTML parsed); `cast code <address> --rpc-url SEP` | 21:48 | verified-on-chain | All are verified on Sourcify. ETHRegistry and RootRegistry are `PermissionedRegistry` (exact match); the UR proxy (`UpgradableUniversalResolverProxy`) is an exact match. The page also lists `ManagedUniversalResolverProxy` `0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1`, which is not in the pack; see the next row. MockUSDC `decimals()` = 6 |
| ENSv2 cross-links (address verifier) | `ETHRegistrar.ETH_REGISTRY()` = ETHRegistry. `ETHRegistrar.rentPriceOracle()` = the oracle. `RootRegistry.getSubregistry("eth")` = ETHRegistry. `ETHRegistry.getParent()` = (RootRegistry, "eth"). UR proxy `0xeEeE…EeEe` `.implementation()` = `0x6d80…e6F1`, whose `.implementation()` = UniversalResolverV2 `0x24e1…2d72`. `UniversalResolverV2.ROOT_REGISTRY()` = RootRegistry. `isENSv2()` through the proxy = true | `cast call <address> '<view>()(...)' --rpc-url SEP` for each | 21:50 | verified-on-chain | The proxy reaches UniversalResolverV2 in **two hops**. An address verifier that expects `implementation() == UniversalResolverV2` will fail; it needs to follow both |
| Registration constants (side check) | MIN/MAX commitment age 60 s / 86,400 s; MIN_REGISTER_DURATION and GRACE_PERIOD 2,419,200 s; 1 year for a 10-letter label = 8,000,021 MockUSDC units (premium 0) | `cast call 0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3 'MIN_COMMITMENT_AGE()(uint64)'` etc.; `'getRegisterPrice(string,uint64,address)(uint256,uint256)' graphpay2x 31536000 0x240b…14aa` | 21:50 | verified-on-chain | Matches the pack |
| `graphpay.eth` | `getState(labelhash)` = (status **2 = REGISTERED**, expiry **1825315020** = 2027-11-04 07:57:00 UTC, latestOwner **OPERATOR**, tokenId = resource = `0x320146c7…bbc00000000`), so **epoch 0**. `ownerOf(tokenId)` = OPERATOR. `getResolver("graphpay")` = **0x0**. `getSubregistry("graphpay")` = **0x0**. OPERATOR's roles on the token = `0x1110…01100000`: SET_SUBREGISTRY and SET_RESOLVER with their admins, plus CAN_TRANSFER_ADMIN. `isAvailable("graphpay")` = false. Universal Resolver `resolve` reverts `ResolverNotFound` | `cast call 0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4 'getState(uint256)((uint8,uint64,address,uint256,uint256))' $(cast keccak graphpay) --rpc-url SEP`; `'getResolver(string)(address)' graphpay`; `'getSubregistry(string)(address)' graphpay`; `'roles(uint256,address)(uint256)' <tokenId> <OPERATOR>`. ABI from https://sourcify.dev/server/v2/contract/11155111/0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4?fields=abi ; Status enum order (AVAILABLE, RESERVED, REGISTERED) from the verified `IPermissionedRegistry.sol` | 21:50 | verified-on-chain | Still owned by OPERATOR and still bare. Labelhash `0x320146c7c755e3f9df8c71e0d57ad72b85b487866fe361de07160bbcb9c72ea0` |
| PermissionedResolverImpl ABI | Setters take a DNS-encoded `bytes name`, not a node. `grantSetterRoles(bytes setter, address account)` scopes by key or coin type and never by name. `grantRoles` is disabled (it always reverts). `DataUpdated` exists. Full signatures in (c) | https://sourcify.dev/server/v2/contract/11155111/0x115eb53f0c60696633855f90b138178fb40b2b2c?fields=abi (and `?fields=sources`) | 21:52 | verified | Live check on the lab resolver of `payer.vitalik.gp-lab.eth` (`0x3b47…7589`): agent `0xc42d…b0eb` holds SET_TEXT (16) only on `keccak256("agent-endpoint[mcp]")`, has 0 root roles and nothing on `graphpay.status`. `VerifiableFactory.verifyContract` = true |
| Universal Resolver proxy `resolve` | `resolve(bytes name, bytes data) view returns (bytes, address)`, selector `0x9061b923`, on UniversalResolverV2 (reached through the proxy). Live reads of `text(graphpay.kind)` return "root", "human" and "agent" for `gp-lab.eth`, `vitalik.gp-lab.eth` and `payer.vitalik.gp-lab.eth` | `cast call 0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe 'resolve(bytes,bytes)(bytes,address)' <dns name> <text(bytes32,string) calldata> --rpc-url SEP` | 21:51 | verified-on-chain | The proxy's own ABI has only `admin`, `implementation`, `upgradeTo` and `renounceAdmin`; every other call is delegated |
| viem | 2.57.16 = npm `latest` (2026-11-03 09:44 UTC) and the newest 2.x | `npm view viem version dist-tags time --json` | 21:54 | verified | |
| `@ensdomains/ensjs` and `ensjs-abi` | `@ensdomains/ensjs` 5.2.12 = `latest` (2026-11-02). It pins `@ensdomains/ensjs-abi` to exactly `5.0.5`, which is also that package's `latest` (2026-10-27). No `ensjs-abi` 5.2.12 exists | `npm view @ensdomains/ensjs@5.2.12 dependencies`; `npm view @ensdomains/ensjs-abi versions dist-tags time --json` | 21:54 | verified | Keep generating ABIs from Sourcify |
| ENSIP-31 entry for test USDT | `0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7`, **28 bytes**, recomputed here. The draft's own vectors (27, 28, 7 and 62 bytes) reproduce byte for byte | https://docs.ens.domains/ensip/31 (status: draft, created 2026-09-10; key `payment-preference`; ENSIP-24 data record; ERC-7930 v1 entries concatenated; one malformed entry voids the whole record); `gh api 'repos/ensdomains/ensips/commits?path=ensips/31.md'` | 21:53 | verified (draft) | The last change was on 2026-10-14 (`b9a2d8b`), so the pin "draft as of 2026-11-03" is current |
| ERC-7930 encoding | Version (2 bytes) + ChainType (2) + ChainReferenceLength (1) + ChainReference + AddressLength (1) + Address. eip155 ChainType = `0x0000`. The chain reference is the chain id as a minimal big-endian integer with no leading zeros (1874 → `0x0752`). The spec's Example 1 reproduces | https://eips.ethereum.org/EIPS/eip-7930 (status **Review**); https://raw.githubusercontent.com/ChainAgnostic/namespaces/main/eip155/caip350.md | 21:53 | verified | The ERC was last edited on 2026-05-24 |
| ENSIP-11 coin type for 1874 | `0x80000752` = **2147485522** (`0x80000000` OR 1874) | https://docs.ens.domains/ensip/11 (status final) | 21:53 | verified | |
| ENSIP-26 record keys | `agent-context` (any format) and `agent-endpoint[<protocol>]` with protocols `mcp`, `a2a`, `web`. An endpoint value must be a valid URL (ipfs:// is allowed). Both are ENSIP-5 text records | https://docs.ens.domains/ensip/26 (status draft; last change 2026-05-06, `223d4e2`) | 21:53 | verified (the pack had from-research) | Other protocol values may be added |
| `@arkiv-network/sdk` | 1.0.1 = npm `latest` (2026-11-02 19:53 UTC) and the latest GitHub release (`v1.0.1`, `e9fa8dd`). Peers `viem ^2.0.0`, `typescript >=5.0.0`; no dependencies | `npm view @arkiv-network/sdk version dist-tags time --json`; `gh api repos/Arkiv-Network/arkiv-sdk-js/releases/latest` | 21:56 | verified | Ignore the other dist-tag (`advanced` = 0.8.0-advanced.3) |
| Arkiv docs vs the published SDK | The API reference on docs.arkiv.network lists `ne`, `not`, a `tiramisu` chain, `MimeType`, `NoMoreResultsError` and `Bytes32Value`. **None of them is in the published 1.0.1** types or JS | https://docs.arkiv.network/networks/rabdi/ (sidebar index); text search of the extracted 1.0.1 package | 21:59 | decided (main): code against SDK 1.0.1 | Write code against the 1.0.1 `.d.ts` files (section c), not against the docs' API reference |
| Node | Newest 22.x = **v22.23.4** (2026-10-20, "Jod", a security release). Line 22 has been in Maintenance since 2025-10-21 and reaches end of life on 2027-04-30. 26.13.0 ("Lithium") has been Active LTS since 2026-10-28; 24.22.2 ("Krypton") has been in Maintenance since 2026-10-20 | https://nodejs.org/dist/index.json ; https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | 21:55 | verified | |
| pnpm | 10.34.9 = `latest-10` (2026-10-25); npm `latest` = 12.16.1 | `npm view pnpm version dist-tags time --json` | 21:54 | verified | |
| Foundry | **v1.9.0** is the latest stable release (2026-11-02 21:28 UTC). Its tag commit `6056c58` matches the local `cast 1.9.0-Homebrew`. Only nightlies are newer | `gh api repos/foundry-rs/foundry/releases/latest`; `cast --version` | 21:55 | verified | |
| forge-std | The pinned tag `v1.9.7` exists and points to `77041d2ce690` (released 2025-04-28). The latest release is **v1.17.0** (`f3dae6e6ee38`, 2026-09-30); ten tags are newer than the pin | `gh api repos/foundry-rs/forge-std/releases/latest`; `gh api repos/foundry-rs/forge-std/git/ref/tags/v1.9.7` | 21:55 | changed (the pin v1.9.7 is not the newest; latest is v1.17.0) | v1.17.0 came out before the pack's 3 Nov check, so the pin was already behind then. The lab's tests passed on v1.9.7 |
| OpenZeppelin Contracts | **v5.7.0** is the latest release (2026-07-29); its tag points to `cab19933c33c` | `gh api repos/OpenZeppelin/openzeppelin-contracts/releases/latest`; `…/git/ref/tags/v5.7.0` | 21:55 | verified | |
| x402 (`@x402/core`, `evm`, `hono`, `fetch`) | The pin 2.29.0 still exists (2026-10-28). npm `latest` is **2.30.0** for all four (2026-11-04: core 20:04, evm 20:08, fetch and hono 20:13 UTC). `@x402/evm@2.30.0` depends on `@x402/core ~2.30.0` | `npm view @x402/<pkg> version dist-tags time --json`; `npm view @x402/evm@2.30.0 dependencies`; changelogs at `typescript/packages/*/CHANGELOG.md` in x402-foundation/x402 | 21:54 | changed (2.29.0 → 2.30.0 latest) | 2.30.0 changes behaviour: `onSettleFailure` hooks now fire only once the facilitator has been reached; a new cancellation reason `settlement_preflight_failed`; the exact-EVM facilitator now reports `invalid_exact_evm_payload` instead of `invalid_payload`. Keep all four on the same version |
| AI SDK | `ai` 7.0.162 → `latest` 7.0.163; `@ai-sdk/anthropic` 4.0.96 → 4.0.97; `@ai-sdk/mcp` 2.0.90 → 2.0.91 (all published 2026-11-05 around 01:12 UTC). The pinned versions still exist | `npm view <pkg> version dist-tags time --json` | 21:54 | changed (patch releases) | |
| zod | 4.6.7 = `latest` (2026-10-12) | `npm view zod …` | 21:54 | verified | |
| hono / `@hono/node-server` / tsx | 4.13.16 / 2.1.6 / 4.23.15, each = `latest` | `npm view <pkg> …` | 21:54 | verified | |
| graphql | The pin 16.14.2 exists. The newest 16.x is now **16.15.0** (`latest-16`, 2026-11-04 20:17 UTC; performance backports from v17). npm `latest` = **17.1.0** (2026-11-04 20:20 UTC) | `npm view graphql …`; `gh api repos/graphql/graphql-js/releases/tags/v16.15.0` | 21:54 | changed (the pack had 16.14.2 as newest 16.x and 17.0.2 as latest) | |
| graphql-yoga | 5.24.6 is the newest 5.x (2026-10-15); `latest` = 6.0.1 (2026-10-23) | `npm view graphql-yoga …` | 21:54 | verified | Still avoid 6 |
| dataloader | 2.2.3 = `latest` (2024-12-03) | `npm view dataloader …` | 21:54 | verified | |
| next | The pin 16.4.4 exists. `latest` = **16.4.5** (2026-11-03 18:01 UTC), a **security release** that fixes 7 moderate advisories: `use cache` / Cache Components leaks and poisoning, an image-optimizer SVG bypass, HttpOnly cookie exposure on the Edge runtime, and response injection in self-hosted apps | `npm view next …`; `gh api repos/vercel/next.js/releases/tags/v16.4.5` | 21:54 | changed (16.4.4 → 16.4.5 latest, security) | |
| react / react-dom | 19.3.1 = `latest` (2026-10-14) | `npm view react …`, `npm view react-dom …` | 21:54 | verified | |
| typescript / eslint | TS 5.9.3 is the newest 5.x (`latest` 7.0.2). ESLint 9.39.5 is the newest 9.x and carries the `maintenance` tag (`latest` 10.14.0) | `npm view typescript …`, `npm view eslint …` | 21:54 | verified | |
| vitest | 5.1.0 = `latest` (2026-11-02) | `npm view vitest …` | 21:54 | verified | |
| `@modelcontextprotocol/sdk` | 1.32.2 = `latest` (2026-10-23) | `npm view @modelcontextprotocol/sdk …` | 21:54 | verified | |
| sigma, graphology | sigma `latest` = **4.0.4** (2026-10-27; 4.0.0 since 2026-10-08); the newest 3.x is 3.0.3 (2026-04-30). graphology `latest` = 0.26.0 (2025-01-26) | `npm view sigma …`, `npm view graphology …` | 21:54 | changed (the pack had "sigma 3"; 4 is now `latest`) | Pin `sigma@3.0.3` if the R1 notes assume the v3 API |
| `@ethersphere/bee-js` | 13.2.0 = `latest` (2026-10-15) | `npm view @ethersphere/bee-js …` | 21:54 | verified | The `upcoming` tag is a 13.3.0 prerelease |
| Vercel CLI | The pin 65.10.0 exists (2026-11-03 00:35 UTC); `latest` = 65.11.0 (2026-11-03 19:38 UTC) | `npm view vercel …` | 21:54 | verified | As the pack already noted: the pin is not the newest |
| `actions/checkout@v7` | Tag `v7` → `3d3c42e5aac5` = v7.0.1, the latest release (2026-07-20) | `gh api repos/actions/checkout/git/ref/tags/v7`; `…/releases/latest` | 21:56 | verified | |
| `actions/setup-node@v7` | Tag `v7` → `949feb2413d6` = v7.1.0, the latest release (2026-10-08) | `gh api repos/actions/setup-node/git/ref/tags/v7`; `…/releases/latest` | 21:56 | verified | |
| `pnpm/action-setup@v6` | Tag `v6` (annotated) → `73e46992e05b` = v6.1.1, the latest release (2026-11-03 13:50 UTC) | `gh api repos/pnpm/action-setup/git/ref/tags/v6`; `…/releases/latest` | 21:56 | verified | |
| `foundry-rs/foundry-toolchain@v1.9.2` | Tag `v1.9.2` → `dba66c27052e` = the latest release (2026-10-22). Tag `v1` points to the same commit | `gh api repos/foundry-rs/foundry-toolchain/git/ref/tags/v1.9.2`; `…/releases/latest` | 21:56 | verified | |
| Model id | **`claude-haiku-5-5`** is listed as the Claude API ID and alias for Claude Haiku 5.5. Bedrock uses `anthropic.claude-haiku-5-5`; Google Cloud and Foundry use `claude-haiku-5-5`. Retirement is not before 2027-10-07 | https://platform.claude.com/docs/en/models/overview (docs.claude.com/en/docs/about-claude/models/overview redirects here) | 22:01 | verified (docs) | No key was used; the live API check runs separately |
| ETHGlobal deadline and submission | Saturday 7 Nov 2026, 09:00 IST, and late submissions are not accepted. You may select up to 3 partner prizes. A finalist session is 7 min (4 min demo, 3 min Q&A) | https://ethglobal.com/events/mumbai/info/start ; https://ethglobal.com/events/mumbai/info/details | 22:03 | verified | The two pages disagree on booths: the details page says partners judge from the submission and a booth visit is optional; the start page says you present at partner booths. Ask an organiser |
| Whitechain tracks | Four tracks, $15,000 in total: Operate (stablecoin payments for business) $5,000 = 2,500 / 1,500 / 1,000; Tokenize (real-world finance) $4,000 = 2,500 / 1,500; Scale (payments nobody notices) $3,000 = 2,000 / 1,000; Continuity (bring your product) $3,000 = 1,500 / 1,500 | https://ethglobal.com/events/mumbai/prizes | 22:02 | verified | |
| Whitechain qualification (Operate and Scale; Tokenize is the same) | Contracts deployed on Whitechain Sepolia (1874) and **verified on the Whitechain explorer**. At least **one payment in USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`** settled in the main flow, with the explorer link in the README (a self-minted test token does not count). A README line on why the flow needs onchain stablecoin settlement on Whitechain. A public repo that shows steady progress, with a README covering setup, architecture and limitations. A **2 to 4 minute demo video** that shows each party. A **`WHITECHAIN_FEEDBACK.md`** | https://ethglobal.com/events/mumbai/prizes (paraphrased) | 22:02 | verified | The **drop-in** (a widget, SDK, payment-link API or plugin that a separate demo app adds in about 20 lines) and showing both the merchant and the customer views are on Operate's "what we want to see" list, not its qualification list. Scale wants a payer flow with no visible crypto steps, plus an explanation of who pays gas, how the relayer gets WBT and what stops anyone draining it. Scale won't place a flow where the payer signs a transaction that costs them gas |
| Whitechain prizes per project | The Whitechain section sets no per-project limit. ETHGlobal's details page says that when a partner has several tracks you are "eligible for all of them while only counting as 1 Partner Prize" | https://ethglobal.com/events/mumbai/prizes ; https://ethglobal.com/events/mumbai/info/details | 22:03 | decided (ADR-0032) | The founder's "one Whitechain prize per project" is not on either public page. Being eligible for several tracks is not the same as being able to win several. Ask at the Whitechain booth. **Settled:** the founder enters Operate; the product stays general |
| ETHGlobal rules (prior work, AI) | Wording unchanged from the pack. Classic track: work starts after the official start, and prior project-specific code is barred unless it comes from public libraries or starter kits. Pre-existing work must be disclosed. Version control is required; large single commits may be disqualified. AI tools are generally permitted. Spec-driven work must include all spec files, prompts and planning artifacts in the repo. No text-to-speech or AI voiceover in the video | https://ethglobal.com/events/mumbai/info/details ; https://ethglobal.com/rules (not re-read) | 22:03 | verified (pages read); open (founder) for the "ask an organiser" step | |

## Changes against the pack

1. **Next.js 16.4.5** is a security release (7 moderate advisories). The pinned 16.4.4 does not have those fixes.
2. **x402 2.30.0** is now npm `latest` for core, evm, hono and fetch, and it changes hook and error behaviour. 2.29.0 is still available. Move all four together or none.
3. **AI SDK** has patch releases: `ai` 7.0.163, `@ai-sdk/anthropic` 4.0.97, `@ai-sdk/mcp` 2.0.91.
4. **graphql**: the newest 16.x is now 16.15.0 (the pack had 16.14.2), and `latest` is 17.1.0 (the pack had 17.0.2).
5. **sigma**: `latest` is 4.0.4; the newest 3.x is 3.0.3. The pack says "sigma 3".
6. **forge-std**: the latest release is v1.17.0 (2026-09-30). The pin v1.9.7 (`77041d2`) still resolves.
7. **Sepolia gas**: the suggested tip fell from about 1,000 wei to 3 wei; the base fee is 19 to 20 wei. The ENS gas rule is **not** triggered.
8. **Test USDT**: FUNDER now holds 153.75208 USDT (it was 3.75208) after a 150 USDT transfer in at 21:54:54 IST. Holders went from 50 to 91.
9. **ENSIP-26** is now verified against the spec (it was from-research). The keys match the pack.
10. **Universal Resolver**: the pack's proxy `0xeEeE…` reaches UniversalResolverV2 through `ManagedUniversalResolverProxy` `0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1`. This is new detail rather than a changed address, but the address verifier must follow both hops.
11. **Settled at M0:** the Whitechain faucet amount (docs 0.5 WBT per 24 h; FUNDER rose by 2 WBT at 22:12, matching the founder) and the number of Whitechain prizes (no limit on the public pages; the founder enters Operate, ADR-0032).
12. **Arkiv docs**: the API reference lists symbols that are missing from SDK 1.0.1 (`ne`, `not`, `tiramisu`, `MimeType`, …). Decided: code against the installed 1.0.1 types.
13. Side note, not a 9 pm row: the ENS deployments page now says the ENSv2 contracts are deployed on mainnet ahead of launch, and that mainnet resolution still goes through ENSv1. That is consistent with "do not claim mainnet".

Unchanged: all chain ids; all 12 ENSv2 Sepolia addresses; the `graphpay.eth` state; the Glamsterdam transfer gas; the ERC-7930 / ENSIP-31 entry; ENSIP-11; viem; ensjs and ensjs-abi; the Arkiv SDK; zod; hono, `@hono/node-server` and tsx; graphql-yoga; dataloader; react; TS; ESLint; vitest; the MCP SDK; bee-js; pnpm; Node 22.23.4; Foundry 1.9.0; OpenZeppelin 5.7.0; the four Actions tags; the model id; the deadline.

**Blocks a track?** Nothing found blocks a track. ENS: gas is far below the 0.5 gwei stop, and `graphpay.eth` is still bare and owned by OPERATOR. Whitechain: the qualification rules match the plan (verified contracts, a real USDT payment, `WHITECHAIN_FEEDBACK.md`, a 2 to 4 minute video). Both former booth items (the prize-count rule and the faucet drip) are settled above.

## API notes (verified at M0; code against these, not memory)

### ENS PermissionedResolver (impl `0x115eb53f0c60696633855f90b138178fb40b2b2c`, Sourcify "PermissionedResolver", solc 0.8.25)

Every record setter takes the **DNS-encoded name** (`bytes`) first. The contract hashes it on-chain with `NameCoder.namehash(name, 0)` ("@param name The DNS-encoded name"). A setter creates the record the first time and emits `Linked`. A name with no record reads the default record, which is written through the root name `0x00`.

```solidity
// setters                                                     selector     role (bit)            role resource
setText(bytes name, string key, string value)                  0xc7279f88   SET_TEXT    1<<4      keccak256(bytes(key))
setAddress(bytes name, uint256 coinType, bytes addressBytes)   0xb4436dde   SET_ADDRESS 1<<0      keccak256(abi.encode(coinType))
setData(bytes name, string key, bytes value)                   0xeb4b73bb   SET_DATA    1<<24     keccak256(bytes(key))
setABI(bytes name, uint256 contentType, bytes data)                         SET_ABI     1<<12     per contentType
setInterface(bytes name, bytes4 interfaceId, address implementer)           SET_INTERFACE 1<<16   per interfaceId
setContenthash(bytes name, bytes hash)                                      SET_CONTENTHASH 1<<8  root only
setName(bytes name, string primaryName)                                     SET_NAME    1<<20     root only
linkToNode(bytes sourceName, bytes32 targetNode)                            LINK        1<<28     root only
linkToRecord(bytes sourceName, uint256 recordId)                            LINK                  root only (recordId 0 = unlink)
multicall(bytes[] calls) returns (bytes[] results)
multicallWithNodeCheck(bytes32, bytes[] calls) returns (bytes[])
initialize((address account, uint256 roleBitmap)[] grants, bytes[] calls)   // grants ROOT roles; role checks are skipped while initializing

// roles
grantSetterRoles(bytes setter, address account) returns (bool)            0xccd3eaff
grantRootRoles(uint256 roleBitmap, address account) returns (bool)         0x072d5d77
revokeRoles(uint256 resource, uint256 roleBitmap, address account) returns (bool)   0xdfa70d8b
revokeRootRoles(uint256 roleBitmap, address account) returns (bool)
grantRoles(uint256 resource, uint256 roleBitmap, address account) returns (bool)    // declared pure; ALWAYS reverts EACCannotGrantRoles ("disabled, use grantSetterRoles")
decodeSetter(bytes setter) view returns (bytes arg, uint256 resource, uint256 roleBitmap)
hasRoles(uint256 resource, uint256 roleBitmap, address account) view returns (bool)  // effective roles = root | resource
roles(uint256 resource, address account) view returns (uint256)
ROOT_RESOURCE() view returns (uint256)   // = 0

// reads
resolve(bytes name, bytes data) view returns (bytes)     // ENSIP-10 on the resolver itself
getRecordId(bytes32 node) view returns (uint256)
getRecordCount() view returns (uint256)
supportsFeature(bytes4 feature) view returns (bool)
```

How scoping works. `grantSetterRoles` decodes an ABI-encoded setter call (`setAddress`, `setText`, `setData`, `setABI` or `setInterface`; any other selector reverts `UnsupportedResolverProfile`). Only the selector and the second argument (the key, coin type, content type or interface id) are used; **the name argument is discarded**, so `setText(0x, "agent-endpoint[mcp]", "")` works. The grant is therefore **per record key and never per name**: whoever holds it can write that key on every name the resolver serves. The pack's one-resolver-per-agent design is what keeps agents apart. The caller must hold the admin bit of the role. The first grant on a resource emits `ResourceArgument`. `setContenthash` and `setName` take no key, so only root roles can set them. No per-name role exists.

Events (records are keyed by `recordId`, not by node; map recordId to node through `Linked`):

```solidity
TextUpdated(uint256 indexed recordId, string indexed keyHash, string key, string value)    // topic 0x14cf4389d9a790cb32a054e033d7e3d3b78119dee4fea3c0983aac1db3f54015
DataUpdated(uint256 indexed recordId, string indexed keyHash, string key, bytes value)     // topic 0xdbde59187c9a9313f0304849d2ec5200e67fb37bf090416487dae4b601ec3db5  (yes, it exists)
AddressUpdated(uint256 indexed recordId, uint256 coinType, bytes addressBytes)             // topic 0x5856fffa4d8f7605f45813e1cc223ac63a6fa1f09ca60f0e6a6525317bc7fa41
Linked(uint256 indexed recordId, bytes32 indexed node, bytes name)                         // topic 0x66fd1d4edf16fc35ee08adaecfdf6fd5f75283da903b50f642558d6e0ba630ff
ContenthashUpdated(uint256 indexed recordId, bytes hash)
ABIUpdated(uint256 indexed recordId, uint256 indexed contentType)
InterfaceUpdated(uint256 indexed recordId, bytes4 indexed interfaceId, address implementer)
NameUpdated(uint256 indexed recordId, string primaryName)
Cleared(uint256 indexed recordId)
EACRolesChanged(uint256 indexed resource, address indexed account, uint256 oldRoleBitmap, uint256 newRoleBitmap)
ResourceArgument(uint256 indexed resource, bytes arg)
ResolverCreated()  Initialized(uint64 version)  Upgraded(address indexed implementation)
```

Universal Resolver. `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` (UpgradableUniversalResolverProxy) → `0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1` (ManagedUniversalResolverProxy, the same proxy contract) → `0x24e1d8e068620b647ca097f961a61055f4f42d72` (UniversalResolverV2, `ROOT_REGISTRY()` = RootRegistry).

```solidity
resolve(bytes name, bytes data) view returns (bytes, address)                          // 0x9061b923
findResolver(bytes name) view returns (address resolver, bytes32 node, uint256 offset)
requireResolver(bytes name) view returns ((bytes,uint256,bytes32,address,bool) info)
resolveWithGateways(bytes name, bytes data, string[] gateways) view returns (bytes, address)
reverse(bytes lookupAddress, uint256 coinType) view returns (string, address, address)
isENSv2() pure returns (bool)   // true through the proxy
```

Related, checked on the same ABIs. Registry `getState(uint256 anyId)` returns `(uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource)`, with `Status { AVAILABLE, RESERVED, REGISTERED }`. Registry events also include `LabelReserved(uint256 indexed tokenId, bytes32 indexed labelHash, string label, uint64 expiry, address indexed sender)`, which pack §8 does not list; the `sim` reservation emits it. UserRegistry has `initialize((address,uint256)[] grants)`, `register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)` and `setParent(address parent, string label)`. VerifiableFactory has `deployProxy(address implementation, uint256 salt, bytes data)`, `predictProxyAddress(address deployer, uint256 salt)` and `verifyContract(address proxy) view`.

### Arkiv SDK `@arkiv-network/sdk` 1.0.1 (published type declarations)

File paths are inside the package's `dist/`. The hashed names are build chunks; each one's `//#region src/...` comment names the source file. Every chunk has a `.d.cts` twin. Imports: `"@arkiv-network/sdk"` (clients, `ExpirationTime`), `"/schema"`, `"/query"`, `"/chains"` (`rabdi({ accessKey })`; `""` uses the public RPC).

**Create with an expiry** (`dist/index.d.ts`, `WalletArkivActions`; options in `dist/changeOwnership-CV-auKHv.d.ts`, region `src/actions/wallet/createEntity.d.ts`):

```ts
createEntity: <S extends Schema>(schema: S, values: CreateEntityValues<S>, options: CreateEntityOptions, txParams?: TxParams) => Promise<CreateEntityReturnType>;
type CreateEntityOptions = { expiration: Expiry; flags?: CreationFlags | undefined; salt?: SaltInput | undefined };
type CreateEntityReturnType = { entityKey: Hex; txHash: Hash; expiresAt: bigint };   // expiresAt = block height from the EntityCreated event
```

`Expiry` (`dist/expiry-S2PUL8Hg.d.ts`) is a branded `{ readonly minLifetime: bigint; readonly expiresAt: bigint | Date }`; build one only through `ExpirationTime` (`dist/expirationTime-C9rz8--Q.d.ts`). The helpers are `fromSeconds`, `fromMinutes`, `fromHours`, `fromDays`, `fromWeeks`, `fromMonths` (30 days), `fromYears` (365 days) and `fromBlocks`, each returning `Lifetime`; plus `max()`, `atBlock(block: bigint, options?: { atLeast?: Lifetime })` and `atDate(date: Date, options?)`, which return `Expiry`. A duration must be a whole number of 2 s blocks, and `atDate` rounds up. The engine uses `max(expiresAt, currentBlock + minLifetime)`. `MAX_LIFETIME = 7884000n` blocks (about 182.5 days; `dist/index-CL3rAR9T.d.ts`), so `fromYears(1)` is refused before sending.

**Readonly** (`dist/index-CL3rAR9T.d.ts`, region `src/entity/flags.d.ts`). The exact option is `flags: { readonly: true }`:

```ts
type CreationFlags = { readonly?: boolean; permissionlessExtension?: boolean };   // both default false, fixed for life
type ResolvedCreationFlags = { readonly: boolean; permissionlessExtension: boolean; raw: number };
```

A readonly entity's attributes can never change. Its expiry can still be extended, it can still be transferred, and it can still be deleted (this matches lab G-3). `permissionlessExtension` lets anyone extend the entity.

**Indexed or stored-only.** Not every attribute is indexed: you choose per column. The schema API is in `dist/index-DaMIgZgJ.d.ts`:

```ts
declare function defineSchema<const C extends Columns>(name: string, columns: C): Schema<C>;   // named: adds indexed str "arkiv.schema" (SCHEMA_ATTRIBUTE)
declare function defineSchema<const C extends Columns>(columns: C): Schema<C>;
// column constructors: bool() i32() u64() u256() dec() str() addr() key() bytes()  -> Column<T, false, false, false>
// refinements: .indexed() (all types except bytes), .optional(), .default(value)
// illustration (ours, not from the package):
const Orders = defineSchema("orders", { shop: str().indexed(), amount: u64().indexed(), lat: i32().indexed(), note: str() /* stored only */, blob: bytes() /* never indexed */ });
```

On the wire, indexing is bit 7 of the type byte (`INDEXED_FLAG = 128`, so `str` is `8` unindexed and `0x88` indexed). Only indexed attributes can be filtered on. Through a schema, a filter on an unindexed column is a compile error, or `InvalidPredicateError` at runtime. Without a schema the SDK sends the predicate as written; per the pack's node-spec row ("Non-indexed filter") it then matches nothing, which was not re-checked here. Limits: `MAX_ATTRIBUTES = 32` (one fewer for a named schema), `MAX_NAME_BYTES = 32`, `MAX_STRING_BYTES = 128`, `bytes` up to 128 KiB. Type ids: bool 1, i32 2, u64 3, u256 4, dec 5, bytes 7, str 8, addr 9, key 10.

**Query builder** (`dist/changeOwnership-CV-auKHv.d.ts`, region `src/query/expression.d.ts`; builder in `dist/index-CBvzb16i.d.ts`):

```ts
type ComparisonOperator = "=" | "<" | "<=" | ">" | ">=";      // there is NO ne / != and NO not() in 1.0.1
declare function eq<N extends string, V extends PredicateValue>(name: N, value: V): ComparisonNode<ValueRef<N, V>>;   // same shape: gt, gte, lt, lte
declare function between<N extends string, L extends PredicateValue, H extends PredicateValue>(name: N, low: L, high: H & SameTypeCheck<L, H>): BetweenNode<ValueRef<N, L>>; // inclusive
declare function startsWith<N extends string>(name: N, prefix: string | StrValue): StartsWithNode<…>;   // str only
declare function exists<N extends string>(name: N): ExistsNode<…>;
declare function hasType<N extends string, T extends IndexableTypeTag>(name: N, tag: T): TypeOfNode<…>;
declare function and(...expressions): Expression; declare function or(...expressions): Expression;
declare const QUERYABLE_SYSTEM_ATTRIBUTES: { readonly $key: "key"; readonly $owner: "addr"; readonly $creator: "addr"; readonly $expiresAt: "u64" };
// $createdAt, $updatedAt and $creationFlags can be selected but not filtered or sorted on
```

- `$owner` can be filtered with `eq("$owner", addr(account))` or with the builder's `ownedBy(owner: Hex): this`, which is shorthand for that filter (calling it again replaces it). `createdBy(creator: Hex)` filters on `$creator`.
- Equality: `eq("shop", str("kesar-kingdom"))` or a bare string. A bare `number` is `i32`, a bare `bigint` is **`u256`**, a bare `string` is `str`. A `u64` has to be tagged: `gte("amount", u64(1_000_000n))`, `gt("$expiresAt", u64(1_200_000n))`. Without a schema, a value of the wrong type is not an error to the engine; the query just matches nothing.
- **Negative numbers are supported for `i32`**: `I32_MIN = -2147483648`, `I32_MAX = 2147483647`, and `i32(-42)` is fine. Comparisons on i32, u64, u256 and dec are numeric. Latitude and longitude as degrees × 1,000,000 (±90,000,000 and ±180,000,000) fit in an i32. `dec` is a signed 18-decimal-place value and also supports ranges.
- Builder: `client.select(selection?) → SelectQueryBuilder`, then `.from(schema, { onMismatch?: "throw" | "skip" })`, `.where(...expressions)` (repeated calls are ANDed), `.ownedBy()`, `.createdBy()`, `.orderBy(key)`, `.limit(n)`, `.offset(n)`, `.withCount()`, and `.fetch(): Promise<QueryResult<Row, TCount>>`. `QueryResult` is `{ entities, blockNumber, skipped, count }`. Also `client.count()…fetch(): Promise<bigint>`, `client.getEntity(key[, schema])`, and `client.query(expression | rawString, { select?, orderBy?, limit?, offset?, count? }): Promise<{ entities; blockNumber; count }>`. A query needs at least one filter, and a named schema's tag counts as one.

**Extend and renew** (`dist/index.d.ts`; params in `dist/changeOwnership-CV-auKHv.d.ts`, region `src/actions/wallet/extendEntity.d.ts`):

```ts
extendEntity: (data: ExtendEntityParameters, txParams?: TxParams) => Promise<ExtendEntityReturnType>;
type ExtendEntityParameters = { entityKey: Hex; expiration: Expiry };
type ExtendEntityReturnType = { entityKey: Hex; txHash: Hash; expiresAt: bigint };
```

An extension **sets** a new expiry measured from now; it does not add to the old one. The engine rejects anything that would move the expiry earlier, and an extension to the current expiry is a no-op. `ExpirationTime.max()` pushes the expiry back out to `MAX_LIFETIME`. `executeBatch({ creates?, patches?, deletes?, extensions?, ownershipChanges? }, txParams?)` runs everything in one transaction.

**Ordering and paging** (`dist/changeOwnership-CV-auKHv.d.ts`, region `src/query/order.d.ts`; `dist/index-CBvzb16i.d.ts`):

```ts
declare function asc<N extends string>(name: N): OrderTerm<…>;  declare function asc<N extends string, T extends IndexableTypeTag>(name: N, type: T): OrderTerm<…>;
declare function desc<N extends string>(name: N): OrderTerm<…>; declare function desc<N extends string, T extends IndexableTypeTag>(name: N, type: T): OrderTerm<…>;
orderBy<const K extends OrderTerm>(key: K & OrderCheck<K, TSchema>): this;   // exactly ONE key; calling again replaces it
limit(limit: number): this;    // 1..100 (MAX_LIMIT = 100)
offset(offset: number): this;
```

- You can sort on any non-bytes attribute, indexed or not, and on `$key`, `$owner`, `$creator` and `$expiresAt`. Without a schema, a user attribute needs its type: `desc("score", "u256")`.
- `asc` puts entities that lack the attribute (or hold another type) first; `desc` puts them last. Ties come out in the node's own order.
- Offset paging reads the latest block on every request, so concurrent writes can repeat or skip rows. For reading every row exactly once, the declarations recommend keyset paging: `orderBy(asc("$key"))` plus `gt("$key", key(lastKey))`, with `onMismatch: "throw"` when going through a schema.
- Rows a schema skips still count toward `limit` and `offset` (`QueryResult.skipped`).

## Added by main at M0

| fact | value | source | checked (IST) | status | note |
|---|---|---|---|---|---|
| Agent model id, live | `GET https://api.anthropic.com/v1/models/claude-haiku-5-5` with the imported key: HTTP 200, id `claude-haiku-5-5`, display name "Claude Haiku 5.5" | one API call (status and id printed only) | 22:21 | verified-live | *main* |
| Arkiv access key | the keyed Rabdi endpoint answered chain id 7794095 and carried every M0 funding read and send | funding script (`rpc label "Arkiv Rabdi keyed"`) | 22:20 | verified-on-chain | *main* |
| Whitechain faucet amount | FUNDER's WBT rose from 1.825745 (21:59) to 3.825745 (22:12), a 2 WBT drip, matching the founder's "2 WBT a day" | balance reads | 22:12 | founder-reported, consistent on-chain | *main*; the docs page still says 0.5 |
| Founder's tGLM | FUNDER held 12.858493 tGLM at 22:12 (the pack expected 2.858 before the founder's top-up) | balance read on `RAB` | 22:12 | verified-on-chain | *main*; enough for the M city and the mirror |
| Founder's Sepolia ETH | FUNDER held 0.283894 ETH at 22:12 (the pack had 0.0139) | balance read on `SEP` | 22:12 | verified-on-chain | *main* |
| Test USDT at FUNDER | 153.752080 USDT (`balanceOf`, 6 decimals) | `cast call 0xcedf…55a7 'balanceOf(address)(uint256)' <FUNDER>` on `WC2` | 22:08 | verified-on-chain | *main*; distributed at M0 (ADR-0045) |
| Gas of the M0 funding transfers | Whitechain and Rabdi 21,000 each; Sepolia to a new account 204,600 used (207,391 estimated); USDT `transfer` 60,923 | the 29 M0 receipts (`docs/technical/WALLETS.md`) | 22:20 | measured | *main* |
| Load-balanced Sepolia RPC | a nonce read right after a receipt answered one behind and the send was refused ("Missing or invalid parameters"); fixed by counting the nonce locally after each confirmed receipt | M0 funding run | 22:15 | measured | *main*; `docs/problems/PROBLEM_LOG.md` P-foundation-2 |
| Vercel project | `graphpay-event`, id `prj_I3XDMAm2tg7lU6vPVzcYyouIqV0m`, team `hrizzup` (`team_m0d8TiC9xuPrm9qI8ob6byBM`); root `apps/web`, framework `nextjs`, Node `22.x` (set with `PATCH /v9/projects/<id>`; the default was 26.x) | `vercel project create`; `vercel api /v9/projects/graphpay-event` | 22:14 | verified | *main* |
| Vercel production domain | `https://graphpay-event.vercel.app` answers HTTP 200 (public); deployment URLs answer 302 (Vercel Authentication, `ssoProtection: all_except_custom_domains`) | `curl -w '%{http_code}'` | 22:23 | verified | *main*; config `site.url` |
| Vercel Git link | `vercel git connect` refused until the founder grants the Vercel GitHub app access to the repo | CLI 65.10.0 | 22:24 | open (founder) | *main*; CLI deploys from `origin/main` meanwhile |
| Claude Code deny rules | `Read` of `.env` refused: "File is in a directory that is denied by your permission settings."; `cat .env` refused | M0 A3 self-check | 21:53 | verified | *main*; the pack's expected wording differs, the block holds |
| Founder's Ankr RPC (`WHITECHAIN_RPC_URL`) | stored by the founder through the hidden setter (which refuses any chain but 1874); `resolveRpc('whitechain')` picks it first, chain 1874, nothing refused; `eth_blockNumber` 12,302,914 in 168 ms. Free tier: HTTPS only (its WSS is locked), so live events poll over HTTPS (ADR-0055) | `pnpm secrets:status`; a label-only `resolveRpc` check | 22:51 | verified (value never printed) | *main* |
| Agent model presets (ADR-0048) | `testing` and `video` (`claude-opus-5-5`, `xhigh`) and `live` (`claude-haiku-5-5`, `xhigh`) all accepted: 2.2 s / 1.6 s / 0.9 s for a one-word reply; live three-turn exchange 0.9 / 0.9 / 1.9 s, correct answers, no empty reply, no `max_tokens` stop; once the same short answer came in two text blocks (read only the final block); total $0.0012 | `pnpm agents:probe` (Anthropic SDK 1.5.0, `output_config.effort`) | 22:54 | verified-live | *main* |
| Model prices | Opus 5.5 $4 / $20 per million input / output tokens (cache read $0.20); Haiku 5.5 $0.10 / $0.50 up to 100K-token prompts ($0.50 / $2.50 beyond); `effort` levels low, medium, high, xhigh, max (default medium on both) | the claude-api reference's model table (cached 2026-10-06); config `models` | 22:50 | from the API reference; check the pricing page before quoting publicly | *main* |
| Vercel Git link | `graphpay-event` linked to `Zugzwang-world/graphpay` (production branch `main`) at 22:42 IST by the founder; fork deployments need approval (`gitForkProtection` true); PR comments on, commit comments off | `vercel api /v9/projects/<id>` | 22:49 | verified | *main* |
| Vercel ignored build step | set: a build runs only if the commit touches `apps/web`, `packages/`, the root manifests, the lockfile, `.node-version`, `tsconfig.base.json` or `.vercelignore` (docs-only commits skip); tested on a scratch repo (docs-only exit 0 = skip, web exit 1 = build) | `PATCH /v9/projects/<id>` `commandForIgnoringBuildStep` | 22:50 | verified | *main* |
| Vercel public access | only `https://graphpay-event.vercel.app` answers without a login (200); the team alias `graphpay-event-hrizzup.vercel.app` and generated deployment URLs answer 302 (Vercel Authentication). `graphpay.vercel.app` answers `DEPLOYMENT_NOT_FOUND` (no deployment holds it; free only if Vercel accepts it when added) | `curl` without cookies | 22:49 | verified | *main*; not added (the founder picks) |
| Required checks | branch protection requires only `ci` (GitHub Actions, app 15368); no Vercel check | `gh api …/branches/main/protection/required_status_checks` | 22:49 | verified | *main* |

## Track rows

Each track adds its own rows here (under `### <activity>`), with source, time and status.

### identity

| fact | value | source | checked (IST) | status | note |
|---|---|---|---|---|---|
| ENSIP-31 vectors | USDC on Ethereum 27 bytes, USDC on Base 28, native ETH 7, the three concatenated 62 bytes; the test-USDT entry for chain 1874 is 28 bytes and equals the config's `erc7930` | https://docs.ens.domains/ensip/31 (raw `ensips/31.md`); `packages/ens/test/unit.test.mjs` | 2026-11-06 01:05 | verified (draft) | the encoder reproduces all four vectors; a malformed entry voids the whole record |
| Real namespace run | 60 transactions, 72,668,520 gas in all, finished 2026-11-06 01:58 IST at 19 wei gas price; per step: root resolver 3.16M, owner registry 1.02M, owner resolver 1.94–2.41M, agent resolver 2.66–2.77M, agent registration 0.27–0.39M, setters 0.50M, wildcard resolver 1.38M | `docs/sessions/identity/namespace.json` | 01:58 | measured | within the pack's lab figure (77 tx, 68.4M gas, other root) |
| Both setter grants in one transaction | `grantSetterRoles` for `agent-context` and for coin type 2147485522 go through one `multicall` on the agent's resolver: 495,925–495,949 gas; an agent with its own wallet takes 3 transactions, an owner-held agent 2 | the 5 `C3` transactions in `namespace.md`; the fork rehearsal | 01:20 | measured | closes the amendment's "3, or 4 if one call cannot carry both" |
| Setter scope | an agent's key can `setText` `agent-context` and `setAddress` 2147485522 on its own resolver; `setText` of `graphpay.cap_micro`, `graphpay.status`, `x-graphpay-accepts`, `agent-endpoint[mcp]`, `graphpay.principal`, `graphpay.kind`, `setAddress(60)` and `setContenthash` revert `EACUnauthorizedAccountRoles` | `packages/ens/test-fork/namespace.fork.test.mjs` on an anvil fork | 01:30 | verified (fork and real Sepolia) | on real Sepolia (`node scripts/ens/b3-real.mjs --send`, 02:25 IST): the acceptance agent's own `setText` of `agent-context` landed, 59,046 gas, [0x12f009…456e](https://sepolia.etherscan.io/tx/0x12f009dfe98a8a5a7b4cab317774cb4d79fc40c64a16bff8cb9093052c7e456e); the five refused writes revert in simulation and were not sent; `acceptance.mjs` reads the roles (none on the root, cap, status, accepts, endpoint, principal, kind or coin type 60) |
| Transfers | `safeTransferFrom` reverts `TransferUnsafeUntilRegistryIsEmancipated`; `unsafeTransfer` reverts `TransferDisallowed` | same fork test | 01:30 | verified (fork) | |
| Registry roles | verified against `RegistryRolesLib` and `EACBaseRolesLib` source from Sourcify: `ALL_ROLES` is 64 nybbles of 1, admin = role << 128, `CAN_TRANSFER_ADMIN` = `(1<<28)<<128` | https://sourcify.dev/server/v2/contract/11155111/<UserRegistryImpl>?fields=sources | 01:00 | verified | matches `planning/SPEC/IDENTITY_ENS.md` §3 |
| Wildcard | `<anything>.sim.graphpay.eth` reads `graphpay.synthetic=true`, kind `agent`, status and cap empty, with no transaction | `node scripts/ens/acceptance.mjs` on real Sepolia | 02:05 | verified-on-chain | B5 |
| Anvil fork | `anvil --fork-url` at the latest block fails ("block not found") on the load-balanced RPC; pin `--fork-block-number` ten blocks behind the head. Anvil's default tip is 1 gwei, so impersonated signers need `anvil_setBalance` | rehearsal | 01:10 | measured | |

### payments

| fact | value | source | checked (IST) | status | note |
|---|---|---|---|---|---|
| Test USDT EIP-2612 domain | the configured domain (`Tether USD`, version `1`, chain 1874, the proxy) hashes to the token's `DOMAIN_SEPARATOR()`; both `permit` overloads approve Permit2; a permit signed under another name reverts | Foundry fork tests at block 12,310,000 (`packages/contracts/test/Digests.t.sol`) | 01:30 | verified-on-chain (fork) | the start-up check of M3 relies on it |
| Permit2 domain | `{ name: "Permit2", chainId: 1874, verifyingContract: <Permit2> }` hashes to the deployed Permit2's `DOMAIN_SEPARATOR()` | same | 01:30 | verified-on-chain (fork) | |
| Checkout gas (fork, execution only) | first agent settle with the gasless approval 318,377 (merchant holds a float) / 333,479 (merchant at zero); re-order 251,143; partial refund 81,275; createSubscription with first charge 482,697; renew 218,399; cancelWithSig 43,073 | `forge test -vv` gas logs | 01:45 | measured (fork) | a receipt adds about 33,000; real receipts replace these at M2/M3 |
| GraphPayCheckout (test USDT) | `0x75233b7341B9e86407e4b31599f07b8936716FcA`, deploy block 12,313,887, tx `0x0cf2fc15…01f6` (3,873,126 gas); `USDT()` = test USDT; verified on the explorer (`is_verified` true, `is_fully_verified` false) | `scripts/whitechain/deploy-checkout.mjs`, `verify.mjs`, explorer API `/api/v2/smart-contracts/<addr>` | 01:55 | verified-on-chain | config `whitechain.contracts.checkout`; details `docs/sessions/payments/m2-deploy.md` |
| Setup gas (real receipts) | `setRelayer` 53,196; token `approve` 53,376; `setPolicy` new 95,177–95,237 | `docs/sessions/payments/txlog.jsonl` | 01:57 | measured | the lab had 95,233 for a new policy |

### arkiv (T3, M7a, 2026-11-06)

| fact | value | source | checked (IST) | status | note |
|---|---|---|---|---|---|
| Keyed Rabdi rate limit | `ratelimit: limit=5000`, lowest remaining seen 4,916 | header read by the metered transport (smoke and probe runs) | 01:29 | verified-on-chain | no 429, every response 200 |
| Predicate budget | 64 leaves (project, type, owner and 61 OR terms) accepted; 65 refused with JSON-RPC `-32004` | `pnpm -s --filter @graphpay/money-graph smoke` | 01:24 | verified-on-chain | matches the pack |
| Typed literals | `u64(20398n)` renders `day = u64(20398)`; a bare `20398n` renders `day = u256(20398)` | same smoke run (SDK 1.0.1 `render`) | 01:24 | verified | the bare bigint matches nothing on a u64 column |
| First live probe event (W_LEDGER, 7 creates: edge, 4 tallies, link, checkpoint; 1-day rows) | 1,301,681 gas, block 261502, [0xe249…1dec](https://rabdi.explorer.arkiv.network/tx/0xe2499c099a2d0b61157a07678a6ac16111bd942e498e0f871351ac1b70361dec) | `pnpm -s --filter @graphpay/money-graph probe` | 01:29 | measured | lab 977,978 for 6 creates; ours adds the checkpoint and the merged columns |
| Steady live event (1 create, 6 patches incl. link and checkpoint) | **377,893 gas** (lab 310,527; 333,320 with the link), block 261505, [0x247a…68d0](https://rabdi.explorer.arkiv.network/tx/0x247a78a3919c679d4c2565fab59eeec4a1a433534212ec9d4fe073dd0c8a68d0) | same probe run | 01:29 | measured | the reference for M11 and the seeding estimates |
| Readonly edge | the probe edge `0x88b9…53d0` reads back `creationFlags { readonly: true, raw: 1 }`; a simulated `amount_micro` patch from W_LEDGER reverts; a simulated tally patch passes | probe run (eth_call, nothing sent) | 01:29 | verified-on-chain | acceptance D9's mechanics |
| Indexed attributes as written | the probe edge's `attributeSchema`: `day, from_epoch, from_node, kind, project, ref, to_epoch, to_node, ts, type` indexed; `amount_micro, dataset, from_ens, schema_v, synthetic, to_ens` stored only; the node reports `key` columns as type `bytes32` | `smoke <edge key>` (raw `arkiv_query`, `attributeSchema`) | 01:30 | verified-on-chain | ADR-0041 |
| i32 box query | a W_DIRECTORY probe shop at the persona's point (1-day row, [0xbf9a…09aa](https://rabdi.explorer.arkiv.network/tx/0xbf9ac8f4cf76f9e14d6b0d110b31e15d5f434ca934f2cdd3e13be887845309aa)) is found by a 1 km box in 1 call; a box 0.05° north finds none | probe run | 01:29 | verified-on-chain | ADR-0058 (no u64 fallback) |
| Mumbai neighbourhood points for the synthetic shops | 8 OpenStreetMap place nodes within 3.4 km of the persona's point: Kurla West, Kolivery Village, Kurla East, Bandra Kurla Complex, Kalina, Vidya Vihar West, Vakola, Bandra East (values and node links in `packages/config/story.json` `locations.neighbourhoods`) | Overpass `node[place~"^(suburb|neighbourhood|quarter|village)$"](around:3500,19.0760,72.8777)` and the node pages | 01:58 | verified | verifier agent; Santacruz East, Khar East and Vile Parle East have no OSM place node; Wikidata puts BKC 0.8 km from OSM's node |
| S city seeded, graph store (W_SEED_EVENT) | 97 txs, 2,200 creates (1,003 edges, 92 nodes, 871 tallies, 234 links) and 940 patches, 494,005,013 gas = **0.494 tGLM**, 8.9 min; first [0xbd78…ef52](https://rabdi.explorer.arkiv.network/tx/0xbd7827ffd5738f187fdd1c128aa306d64ab548a5d87005d467e7b1656bb4ef52), last [0x107c…aa7d](https://rabdi.explorer.arkiv.network/tx/0x107c508fd54d185de388b54984f93d4f811378afd1b7fd14e7ba0e5ed4bfaa7d); 1,432 responses all HTTP 200, lowest ratelimit remaining 4,834 | `docs/sessions/arkiv/city/seed-S-graph.json` | 02:06 | measured | synthetic; lab S graph store 88 txs, 0.491 tGLM before the merged columns |
| S city seeded, shop directory (W_DIRECTORY) | 12 rows (3 cast, 9 synthetic) in 1 tx, 2,241,503 gas, [0x444c…de35](https://rabdi.explorer.arkiv.network/tx/0x444c80fa8f7dba6ab60cfec9e4ad999e01b1d59d03e5a0d2578fe92c02e6de35) | `docs/sessions/arkiv/city/seed-S-directory.json` | 02:05 | measured | |
| S city read back through GraphQL on Rabdi | Q2 top 10 by sales equals the identity truth in **2 calls** (35 KB); Q1 verified by `count()` (RAW_VERIFIED); Q3, Q5 (3 hops) and the re-registered shop (empty in its new epoch) equal the truth; discovery returns exactly the 3 cast shops (11 with the synthetic opt-in) in 1 call | `node packages/city/scripts/check.mjs --size S --end 2026-11-05` → `docs/sessions/arkiv/city/check-S.json` | 02:12 | measured | synthetic data, size S |
| Plain store run 1 stopped | after 24 txs (91 profiles, 550 records), an RPC read timed out ("The request took too long to respond") before a send; resumed with `--resume`, which skips the rows already written | `docs/sessions/arkiv/city/seed-S-plain-run1.json`, `seed-S-plain.json` | 03:02 | measured | the writer now retries its reads |
| Live benchmark at S (M9) | Q2 top 10: **Graph Arkiv 2 reads against plain 5** (6 with every page in flight; R = 490 payment and renewal rows), 34.5 KB against 131.9 KB; all six questions right both ways (plain wrong by identity on Q2 only); 543 responses, none non-200, lowest ratelimit remaining 4,921 | `node bench/run.mjs --size S --end 2026-11-05`, blocks 265307–265376, commit 667b236; `bench/results/*.csv`, `bench/BENCHMARK-LIVE.md` | Fri 03:38 | measured | synthetic data; D6 passes; times only in the CSVs (ADR-0042) |
| Swarm gateway probe (anonymous, zero batch id) | `POST https://api.gateway.ethswarm.org/bytes` with `swarm-postage-batch-id` = 64 zeros and a 76-byte labelled test file: HTTP 201, a 64-hex reference; `GET /bytes/<ref>` returned the same bytes (sha-256 equal). `POST /bzz?name=menu.json` also 201; `GET /bzz/<ref>/menu.json` and `/bzz/<ref>/` 200 with the content type; `GET /bzz/<ref>` (no file name) 302 to a "forbidden" page on `bzz.link`; an unknown reference 404 | `curl` against the gateway | Fri 09:49 | verified | ADR-0061; the gateway keeps data for a limited time |
| Cast menus on Swarm and Arkiv | 3 `menu` rows from W_DIRECTORY on Rabdi (kesar-kingdom, jamun-junction, syrup-street; synthetic story data) with 64-hex references and sha-256 hashes; read back through `readMenu` on the keyless Rabdi node and the gateway, all verified | `pnpm -s --filter @graphpay/money-graph menus --execute`; `docs/sessions/arkiv/swarm-menus.json` | Fri 09:52 | measured | first tx [0xe088…35b2](https://rabdi.explorer.arkiv.network/tx/0xe08819acde1f50d2a21fc93c1b39abee3145c3f7362b35cdda3480d5200835b2); the test story's names, replaced with the founder's final story |
| SDK entity address | the SDK sends every operation to its fixed entity address (the config's `arkiv.entityContract`), whatever the caller passes | SDK 1.0.1 `src/utils/arkivTransactions.ts` | 01:10 | verified | ArkivSim and the writer take it from the config |
| 256 KiB limit through the SDK | a batch over 256 KiB fails at `eth_estimateGas` as `EntityMutationError` "Execution error without revert data", with `HttpRequestError` status 413 three causes down | ArkivSim (same viem HTTP path) | 01:15 | verified (emulated) | the writer halves on it |

### website

| item | value | source | time (IST) | status |
|---|---|---|---|---|
| Arkiv explorer routes | `/tx/<hash>`, `/entity/<key>`, `/address/<addr>`, `/blocks` (list; `/block` takes no number in the path), `/entity-explorer?q=<query>` (its query page; `/entity/<key>` itself resolves to `$key = key(<key>)` there) | the explorer's own client bundle (`rabdi.explorer.arkiv.network/assets/index-*.js`: its route table and path matchers), read 6 Nov | 01:05 | verified in code; `/entity-explorer?q=` answers 200 |
| Whitechain explorer (Blockscout) | `/tx/<hash>`, `/address/<addr>`, `/block/<n>`, `/token/<addr>` answer 200 (a single-page app answers 200 for any path, so only the tx page was checked against a known transaction) | HTTP GET on `explorer.testnet.whitechain.io`, 6 Nov | 01:15 | verified for tx (known hash); others standard Blockscout |
| Sepolia explorer | Etherscan `/tx/`, `/address/`, `/block/` | HTTP GET on `sepolia.etherscan.io/block/1000` → 200 | 01:15 | verified |
| Next.js file tracing of `@graphpay/config` | its two JSON files are read at run time (`readFileSync` next to `index.mjs`) and the trace misses them; `outputFileTracingIncludes` in `apps/web/next.config.ts` adds them (the route's `.nft.json` then lists both) | local `next build` on Node 22.23.4 | 00:40 | verified locally; first Vercel deploy confirms |

### records

| fact | value | source | checked (IST) | status | note |
|---|---|---|---|---|---|
| npm name `@graphpay_ethglobal/arkiv-graph` (renamed from `@graphpay/arkiv-graph` by the Coordinator at 09:40, ADR-0063) | not on the registry (404) | `npm view @graphpay_ethglobal/arkiv-graph name version` | Fri 09:45 | verified (free now) | the founder's npm account must own the scope `graphpay_ethglobal`; re-check right before publishing |
| npm name `@graphpay/arkiv-graph` | not on the registry (E404) | `npm view @graphpay/arkiv-graph name version` | Fri 01:02 | verified (free now) | ADR-0057; re-check right before publishing |
| npm scope `graphpay` | no organisation and no user: the registry answers 404 for `/-/org/graphpay/package` and `/-/user/graphpay/package` (an existing organisation, `vercel`, and user, `sindresorhus`, answer 200); a scope search lists no packages | `curl https://registry.npmjs.org/-/org/graphpay/package`, `…/-/user/graphpay/package`, `…/-/v1/search?text=scope:graphpay` | Fri 01:05 | verified (unclaimed now) | publishing `@graphpay/…` needs the founder's npm account to own the scope (a free npm organisation `graphpay`) |
| npm name `arkiv-graph` (unscoped) | taken: version 1.1.2, "Interactive graphs and tables for Arkiv entities, with scoped queries and optional wallet-signed Lifetime Extension", repository `github.com/SantiagoDevRel/arkiv-graph` | `npm view arkiv-graph name version description repository.url` | Fri 01:02 | verified | a different Arkiv project; our README credits it and says how ours differs (the pack's reach row already credits it) |
| Plan usage | weekly limit, all models: 70% used at 01:08 and 01:10, 71% at 01:16 and 01:20 (about one point every 6–12 minutes); 74% at 03:04, 75% at 03:15, 76% at 03:36, 77% at 03:46, 78% at 03:56, 79% from 04:12 to 04:33 (the burn slowed after the step-downs and fresh starts); resets Fri 6 Nov 21:30 IST; Fable's own weekly limit 0%; extra usage off | the app's usage card (`get_usage`) | Fri 01:08–01:20 | measured | `docs/thinking-partner/OPEN.md` "Founder now" item 1 |
| Session models | all seven event sessions (T1–T5, Join, Coordinator) report `claude-opus-5-5` at effort `max`; the plan has Sonnet 5.5 at high for T2, T4, T5, Opus 5.5 at xhigh for T1, T3, Join, and Opus 5.5 at high for the Coordinator | the app's session metadata (`get_session`) | Fri 01:08 | measured | switched to the plan at 01:22 by the Coordinator (`set_session_model`, `set_session_effort`), each from its next turn; the Coordinator's own setting is the founder's |

### agentpay

| fact | value | source | checked (IST) | status | note |
|---|---|---|---|---|---|
| Whitechain public RPCs, `eth_getLogs` block-range cap | `rpc.testnet.whitechain.io`: at most **10,000** blocks (10,001 answered at 05:00; 12,400 and 20,000 refused with -32602 "query exceeds max block range 10000"). Public Ankr (`rpc.ankr.com/whitechain_testnet`): about **1,000** (1,001 answered; 1,024 and above refused with -32062 "Block range is too large") | raw `eth_getLogs` on the checkout address ending at the head, after `eth_chainId` = 1874 on each, from a scratch script (no key) | Fri 05:00–05:10 | verified-on-chain | T5 reported the 10,000 cap first. The keyed Ankr URL was not measured. AgentPay reads 10,000 at a time and drops to a tenth on a range refusal |
| M4 hosted (T1, 05:12 IST) | on `https://graphpay-event.vercel.app` both health endpoints answer 200 with signer FACILITATOR; C6: every protected route answers 401 without its passcode or bearer; `pay:public` 0.40 as a human payer, no payer gas ([tx](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), repeat answered `alreadyPaid`; cron renewal as RENEWER ([tx](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)) | T1's M4 run, PRs #58 and #62 | Fri 05:12 | verified-on-chain | copied by the Coordinator at T1's request |
| npm names for the SDKs (ADR-0063) | `@graphpay_ethglobal/arkiv-graph` and `@graphpay_ethglobal/agentpay` are not on the registry (E404); the organisation `graphpay_ethglobal` exists (`/-/org/graphpay_ethglobal/package` answers 200) and is the founder's; `graphpay` stays unclaimed (404) | `npm view …`, `curl https://registry.npmjs.org/-/org/<org>/package` | Fri 09:30 | verified | the `@graphpay/…` rows above are superseded by ADR-0063 |
| `@graphpay_ethglobal/arkiv-graph` 0.1.0 on npm | **published**: version 0.1.0 at 04:44:16 UTC (10:14 IST), after npm's `0.0.0-stage` placeholder at 04:42:40 UTC; `dist-tags.latest` 0.1.0; MIT; 21 files, 42.7 kB packed, 137,850 bytes unpacked; shasum `daf753ffd2a6eebd5996db5aaba5ba1e0613116c`; dependencies `@arkiv-network/sdk` 1.0.1 and `viem` ^2.57.16; https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph | `npm view @graphpay_ethglobal/arkiv-graph versions time dist-tags license dist`. Installed from the registry in an empty folder: the README quickstart (`examples/quickstart.mjs`) printed `grace: { follows: 1n, likes: 2n }` and its explain trace | Fri 10:50 | verified | published with `pnpm publish --access public --publish-branch main` from the main checkout (package source as of #74); the founder approved npm's web 2FA |
| `@graphpay_ethglobal/agentpay` 0.1.0 on npm | **published**: version 0.1.0 at 05:10:14 UTC (10:40 IST), after the `0.0.0-stage` placeholder at 05:08:06 UTC; `dist-tags.latest` 0.1.0; MIT; 32 files, 75.5 kB packed, 270,628 bytes unpacked; shasum `44f665ef42f6ec43fb4482fa112d13846a42283b`; dependencies `@modelcontextprotocol/sdk` 1.32.2, `ai` 7.0.162, `viem` 2.57.16, `zod` 4.6.7; https://www.npmjs.com/package/@graphpay_ethglobal/agentpay | `npm view @graphpay_ethglobal/agentpay versions time dist-tags license dist`. Installed from the registry in an empty folder: `examples/sweets.mjs` paid 4,800,000 micro-USDT and `examples/cab.mjs` paid 3,200,000 (driver assigned) on a local anvil fork of Whitechain Sepolia (Foundry 1.9.0); nothing touched the real chain | Fri 10:52 | verified | source as of #80. The published manifest still lists the test-only workspace devDependencies `@graphpay/config`, `contracts` and `facilitator` at 0.0.0 (never installed by users); 0.1.1 drops them (T6). Two web 2FA links expired (about 5 minutes each) before the third was approved |
| `@graphpay_ethglobal/arkiv-graph` 0.1.1 on npm | **published**: version 0.1.1 at 06:04:22 UTC (11:34 IST); `dist-tags.latest` 0.1.1; 21 files, 43.5 kB packed, 140.5 kB unpacked; shasum `28232f410b82022a0e1e21674e3bc9bfc9fe8a58`; the writer's replacement fix (#97, #98); dependencies unchanged | `npm view @graphpay_ethglobal/arkiv-graph version time`. Installed from the registry in an empty folder on Node 22.23.4: `examples/quickstart.mjs` printed `grace: { follows: 1n, likes: 2n }` with its explain trace, `examples/leaderboard.mjs` ranked three players in 1 read; the installed `src/writer.mjs` carries `sentHashes` | Fri 11:36 | verified | published by the Coordinator from the main checkout at 29daec5; the founder approved npm's web 2FA once |
| `@graphpay_ethglobal/agentpay` 0.1.1 on npm | **published**: version 0.1.1 at 06:05:55 UTC (11:35 IST); `dist-tags.latest` 0.1.1; 32 files, 75.6 kB packed, 270.8 kB unpacked; shasum `a03f42950b14cfdba01fc5496139a51b91511a68`; the published manifest's only devDependency is `@x402/core` 2.30.0 (no `@graphpay/` names, #99); dependencies unchanged | `npm view @graphpay_ethglobal/agentpay version time dist-tags`. Installed from the registry in an empty folder on Node 22.23.4: `examples/sweets.mjs` paid 4,800,000 micro-USDT and `examples/cab.mjs` 3,200,000 on a local anvil fork | Fri 11:38 | verified | published right after arkiv-graph 0.1.1; npm reused the same approval |
| Kimi API (verifier, Fri 10:00 IST) | international base `https://api.moonshot.ai/v1` (China `.cn`; keys not interchangeable); `POST /v1/chat/completions`, `Authorization: Bearer`, OpenAI-compatible | https://platform.kimi.ai/docs/api/overview.md, docs/guide/troubleshooting.md | Fri 10:00 | verified | the docs moved to platform.kimi.ai; the API host did not |
| Kimi models | `kimi-k3.1-pro` and `kimi-k3.1-pro-highspeed` exist exactly; 1,048,576-token context; always reasoning; highspeed is the same model at about 2–3x the speed | https://platform.kimi.ai/docs/models.md, api/models-overview.md | Fri 10:00 | verified | access needs an account top-up of at least $1 |
| Kimi reasoning and history | `reasoning_effort` takes low, high or max (default max; no xhigh); send the full assistant message back each turn, `reasoning_content` and `tool_calls` included; one `role: tool` message per call; temperature fixed at 1.0 | https://platform.kimi.ai/docs/guide/use-reasoning-effort.md, guide/use-thinking-models.md, guide/use-kimi-api-to-complete-tool-calls.md | Fri 10:00 | verified | ADR-0048's "read only the final text block" applies to display, not to what is sent back |
| Kimi prices (USD per 1M tokens) | `kimi-k3.1-pro`: input $2.00, cached $0.20, output $10.00; `kimi-k3.1-pro-highspeed`: input $4.00, cached $0.20, output $20.00 (5-minute cache write = the input price) | https://platform.kimi.ai/docs/pricing/chat (modified 2026-10-30) | Fri 10:00 | verified | `prompt_tokens` includes cached and cache-write tokens; `completion_tokens` includes reasoning |
| Kimi rate limits | by total top-up: Tier0 ($1) 1 concurrent and 3 RPM; Tier1 ($10) 15 concurrent and 100 RPM; limits count input plus `max_completion_tokens` | https://platform.kimi.ai/docs/pricing/limits | Fri 10:00 | verified | set `maxOutputTokens` explicitly |
| Kimi key format | keys start `sk-` (admin keys `sk-admin-`); the length is not documented | https://platform.kimi.ai/docs/admin-api/api-key.md | Fri 10:00 | verified (prefix only) | the scan rule `kimi-api-key` uses `sk-` plus 32 or more characters |
| `@ai-sdk/moonshotai` | 3.0.85 is latest (2026-11-05); with `ai` 7.0.162 pin 3.0.84 (same code, matching provider pins) or move `ai` to 7.0.163 with 3.0.85 in one lockfile PR | `npm view @ai-sdk/moonshotai …` | Fri 10:00 | verified | its provider option `reasoningEffort` rejects xhigh |

