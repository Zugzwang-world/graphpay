# WALLETS (event addresses and funding)

Public addresses only. Keys live in the git-ignored `.env` (and, for hosted services, the Vercel environment as Sensitive values). Roles and purposes: `planning/WALLETS.md` §1 and `packages/config/graphpay.config.json` (`wallets`). Only FUNDER and OPERATOR came from the lab (ADR-0024); every other key was generated at M0 on 2026-11-05 between 22:08 and 22:10 IST, one role per run.

## 1. Role addresses (derived from `.env` by `pnpm wallets:addresses`)

| role | address | source |
|---|---|---|
| FUNDER | `0x5c359FC0Edb28f918C8D8E44418339CA55c67e65` | carried over (matches) |
| OPERATOR | `0x531D49A595946a72b9C47b78D287Ff6e6B3CfF32` | carried over (matches) |
| DEPLOYER | `0xb30Ff56eFe8020b320c4E84a6d04D33B493A72C3` | fresh |
| FACILITATOR | `0x1AB82871c3E1Be64717269D45F08cA9d54C1EBf6` | fresh |
| RENEWER | `0x4dcb3564EdE867001179bA695ef298e73005869c` | fresh |
| POLICY_WRITER | `0xB2F8F8b5b71cF742984238b72A33b11Dd4e597f1` | fresh |
| W_SYNC | `0x7c32D2a9Cc01Fb855Ab7877E99886bE8d846ED71` | fresh |
| W_LEDGER | `0x7DeAF022B3829C53c73031B7d28Ed9746F517665` | fresh |
| W_DIRECTORY | `0x146002b43A9Fb8EB963699e77Ed18579dC30A6e4` | fresh |
| W_SEED_EVENT | `0x9DA407FfDbF6e4dee5f972f7adcFA873D72B60D0` | fresh |
| W_SEED_M_EVENT | `0x734Fc394248777046fb80d55AD1f0b0C142a0d64` | fresh |
| VITALIK | `0x5cB23cCEFE5585ff1d9E81330AC88DbEb0119b6e` | fresh |
| SHOP_KESAR | `0x26940565cb470e25B06F5a39cB4E3B98b3e0d03E` | fresh |
| SHOP_JAMUN | `0x0674ABc7Ee4c403b599f9f114eE7fA4f2F56f26a` | fresh |
| SHOP_SYRUP | `0xc5698726c0b67D3fBF095cE2CCa48e1e4bcdD892` | fresh |
| PAYER | `0x5b00CC8F9aF2eC91f6461613589d0d0dEbF16321` | fresh |
| DEAL_HUNTER | `0xf11b49E5D216BF324794890369d077718F9a4F8f` | fresh |
| REHEARSAL_PAYER | `0x884Fb7EE08CD4C4A8e4d5D8F64ce76aF14D3163e` | fresh |
| ACCEPTANCE_PAYER | `0x1A2A5A6c6FD1a8Cff8632814EF8fa395726B837F` | fresh |

**A5 result:** ok. FUNDER and OPERATOR equal `planning/WALLETS.md` §1; no other role's address appears in `planning/WALLETS.md` §5 (the lab wallets); no two roles share an address. DISPOSABLE_<n> keys are generated later, one per kill (M5/M6).

## 2. Funding at M0 (every transfer from FUNDER; dry run first, then `--execute --real`)

Plan: `scripts/funding/plan.json` (`planning/WALLETS.md` §3; plus W_DIRECTORY, ADR-0033; and test USDT, ADR-0045). Gas was estimated for every transfer. FUNDER before (22:12 IST): 3.825745 WBT, 0.283894 Sepolia ETH, 12.858493 tGLM, 153.75208 test USDT.

| network | to | amount | transaction |
|---|---|---:|---|
| Whitechain 1874 | DEPLOYER | 0.1 WBT | [0x43cf…3688](https://explorer.testnet.whitechain.io/tx/0x43cf4ec809c102e7ec02b59e1ddcc4b9e9233b0569b9254073b8092165b13688) |
| Whitechain 1874 | FACILITATOR | 0.8 WBT | [0xc0d5…99b9](https://explorer.testnet.whitechain.io/tx/0xc0d5c6ab0a2f7cf12ace9b9fff06846d7b1a88040185b37d0eb83f3878f999b9) |
| Whitechain 1874 | RENEWER | 0.1 WBT | [0x1238…ff8a](https://explorer.testnet.whitechain.io/tx/0x1238f1cdd1a3ab7d6f031b5a7b3bb2899259a36906857090c7f6d67bbd2aff8a) |
| Whitechain 1874 | POLICY_WRITER | 0.05 WBT | [0x7702…f666](https://explorer.testnet.whitechain.io/tx/0x7702c91b9eb7239a7349454f5e205af49f6c6dbbf912e77734bcf900e8daf666) |
| Whitechain 1874 | SHOP_KESAR | 0.05 WBT | [0xac6e…0dac](https://explorer.testnet.whitechain.io/tx/0xac6ea715362ee4c9b51dcb5d7417ae097ff17961221083a4443d66f515e10dac) |
| Whitechain 1874 | SHOP_JAMUN | 0.02 WBT | [0x27d6…3b35](https://explorer.testnet.whitechain.io/tx/0x27d6c3dee95a9c8263496a6856bfebf9c1d35ad43f33c8bb41c6d555af513b35) |
| Whitechain 1874 | SHOP_SYRUP | 0.02 WBT | [0xe560…e51b](https://explorer.testnet.whitechain.io/tx/0xe56018b5ae4723ab9d7c499d5b41bced2f4ab5a3c8b844ce70fa52242ac6e51b) |
| Whitechain 1874 | VITALIK | 0.02 WBT | [0xe4c9…6cb2](https://explorer.testnet.whitechain.io/tx/0xe4c9be11e912f349f7e1d365102b51921266799aec300aac8ea4c1ba9a3c6cb2) |
| Whitechain 1874 | PAYER | 0.005 WBT | [0x3107…b135](https://explorer.testnet.whitechain.io/tx/0x31075d69e61504d1556de0cd99e2019d8de7ebbf4456316779b1501f25b8b135) |
| Whitechain 1874 | DEAL_HUNTER | 0.005 WBT | [0xdc33…39cb](https://explorer.testnet.whitechain.io/tx/0xdc33f73839e9f2aed8c72a4037c67ec6998775789a663ba79f041738a3b939cb) |
| Whitechain 1874 | REHEARSAL_PAYER | 0.005 WBT | [0x2e3b…22f5](https://explorer.testnet.whitechain.io/tx/0x2e3b1f4554c6136137d1c2f8b53bc6f42a0ffa39096eaea3e63de5d389b022f5) |
| Whitechain 1874 | ACCEPTANCE_PAYER | 0.005 WBT | [0x1b45…2bdc](https://explorer.testnet.whitechain.io/tx/0x1b4565ad0b1e81b0678e38387f0f74e2a91060c29406f430e42fb8ee1a282bdc) |
| Sepolia 11155111 | VITALIK | 0.002 ETH | [0xc055…dadc](https://sepolia.etherscan.io/tx/0xc0553c831fa729ff1248d685587661d3145000a227ff7eed1399084fc2dbdadc) |
| Sepolia 11155111 | SHOP_KESAR | 0.002 ETH | [0x7f85…d776](https://sepolia.etherscan.io/tx/0x7f85e34b2be96d219ec85732161017853f511effb061255791488207c9f0d776) |
| Sepolia 11155111 | SHOP_JAMUN | 0.002 ETH | [0xe8d2…2766](https://sepolia.etherscan.io/tx/0xe8d285c5320eb8873a6401ea978b433b45a4cd2531bf0d068472601717c72766) |
| Sepolia 11155111 | SHOP_SYRUP | 0.002 ETH | [0xb657…71fe](https://sepolia.etherscan.io/tx/0xb6579cdc40a1a64b83620f4a4ab1f5ddde66b8bfae08bc36fa1cf88f56e571fe) |
| Sepolia 11155111 | ACCEPTANCE_PAYER | 0.001 ETH | [0xc321…4c57](https://sepolia.etherscan.io/tx/0xc3216124da3f4d9887b4bc6bf1333ffcf25a66d0e625bb652599658c4d3e4c57) |
| Rabdi 7794095 | W_SEED_EVENT | 0.9 tGLM | [0x722e…3a84](https://rabdi.explorer.arkiv.network/tx/0x722e4f2844cda4976a832606f660701b8f715344676ff3771a0635df67883a84) |
| Rabdi 7794095 | W_LEDGER | 1.5 tGLM | [0x4237…519a](https://rabdi.explorer.arkiv.network/tx/0x4237ffbfa4a032a5b0e23790f9ddadfebcd65654b325097878563a7a1474519a) |
| Rabdi 7794095 | W_SYNC | 0.2 tGLM | [0x1cf9…de1a](https://rabdi.explorer.arkiv.network/tx/0x1cf915ee2d6bfc8cef64adda56d8da8b633020fa6afd77a6b60711cf3761de1a) |
| Rabdi 7794095 | W_DIRECTORY | 0.2 tGLM | [0x7ed1…0440](https://rabdi.explorer.arkiv.network/tx/0x7ed1b5b7740cf080d8cec892a0ab5fe8dc5fae0af1f03962f36c31490f3a0440) |
| Rabdi 7794095 | W_SEED_M_EVENT | 8.5 tGLM | [0x7256…09dd](https://rabdi.explorer.arkiv.network/tx/0x7256c56a254fda3c2d872da55f9fd76fa48257e8b31cc69515cf03c763e609dd) |
| Rabdi 7794095 | W_LEDGER (second part) | 0.5 tGLM | [0x818d…1802](https://rabdi.explorer.arkiv.network/tx/0x818d830abd117a0950612feea62c7944a5e4d5d30806df3f6b0a6943482e1802) |
| Whitechain 1874 | ACCEPTANCE_PAYER | 20 test USDT | [0xbc59…ff63](https://explorer.testnet.whitechain.io/tx/0xbc59cb1b563c59c0a7a235fc5dbfba2f7b7d682e9c1bc9434608a598f35eff63) |
| Whitechain 1874 | PAYER | 30 test USDT | [0x80c4…ff72](https://explorer.testnet.whitechain.io/tx/0x80c46794186041077d7b527e4fdaddc2b3abcb0486b53aad9068159e35a5ff72) |
| Whitechain 1874 | SHOP_KESAR | 20 test USDT | [0x4b85…2874](https://explorer.testnet.whitechain.io/tx/0x4b8571d9ad5fbee9880f5e4ab2c11b195f86434c6d6f04016ba11c5239f52874) |
| Whitechain 1874 | VITALIK | 10 test USDT | [0x6646…3546](https://explorer.testnet.whitechain.io/tx/0x6646a8d071f670c5b0fb7be6c27e80b60c7a75862b0e1b53fcdd011d42df3546) |
| Whitechain 1874 | REHEARSAL_PAYER | 40 test USDT | [0x2ff8…3841](https://explorer.testnet.whitechain.io/tx/0x2ff842299cfaf6448bcdfb5e992d789d6dc660d0be0c3c9d97d08abca4113841) |
| Whitechain 1874 | DEAL_HUNTER | 2 test USDT | [0xf7ed…a7e2](https://explorer.testnet.whitechain.io/tx/0xf7eddd36cba90ec08aab565bdee74e3027b5c45e75517a597e7f0e78ee8ea7e2) |

FUNDER after (22:20 IST): **2.644484 WBT** (reserve floor 0.2), **0.275894 Sepolia ETH**, **1.058367 tGLM**, **31.75208 test USDT**. OPERATOR keeps its own 0.095 Sepolia ETH for the namespace. Sepolia gas at funding time: base fee about 20 wei plus a 3 wei tip, far below the 0.5 gwei stop, so the ENS track's real run is clear.

## 2b. Event top-ups and other uses (the Coordinator)

| time (IST) | what | detail |
|---|---|---|
| Fri 04:10 | RENEWER's second use: the relayer for T6's first real AgentPay SDK payment (rehearsal.vitalik → kesar-kingdom, 0.01 test USDT, gasless, 309,451 gas) | [0xfbd7…4c7e](https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e) |
| Fri 04:2x | top-up to plan targets from FUNDER (`pnpm -s funding --execute --real`): DEPLOYER 0.019635 WBT | [0xd17c…a92a](https://explorer.testnet.whitechain.io/tx/0xd17c8eb56c484e834642a46a92f7cb896d681d8d4cf0d427165799b29635a92a) |
| Fri 04:2x | RENEWER 0.001547 WBT | [0x2029…e2ea](https://explorer.testnet.whitechain.io/tx/0x2029c2670aaa715aae59868766f1dd024c4aee7299211793c4d0455af278e2ea) |
| Fri 04:2x | POLICY_WRITER 0.002380 WBT | [0x149c…441f](https://explorer.testnet.whitechain.io/tx/0x149cab165216f98e50b7243c9240e46d74227367bfa4b7e2ec962d1313c4441f) |
| Fri 04:2x | SHOP_JAMUN 0.000266 WBT | [0x4b01…0291](https://explorer.testnet.whitechain.io/tx/0x4b01da9b0bb34f126cb84796105dbe709eb2335ed0b28989f4715c477df80291) |
| Fri 04:2x | SHOP_SYRUP (back to its 0.02 target) | [0xebe2…b4bf](https://explorer.testnet.whitechain.io/tx/0xebe219aaccde6281fdd43299841860c98aebdc72eb8279be9ba2d12f3774b4bf) |
| Fri 04:25 | after the top-up, every role on all three chains is at target; FUNDER keeps 2.618034 WBT, 0.274894 Sepolia ETH, 15.082973 tGLM | dry run, `pnpm -s funding` |

## 3. Still to fund (waits on later steps)

| what | who | when |
|---|---|---|
| DISPOSABLE_<n>: 0.005 WBT and 1 test USDT each, fresh key per kill | FUNDER, by script | when M5/M6 provision one |
| W_DIRECTORY top-up to 0.5 tGLM | FUNDER, by script | before M8 writes the synthetic directory |
| stand-in token mint (only if T1 deploys a stand-in; ADR-0045) | DEPLOYER | M2 |
