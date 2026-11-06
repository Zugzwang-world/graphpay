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
| Fri 05:0x | DISPOSABLE_1 joins the fresh roles (config) for the kill check; `--plan usdt` for real: DISPOSABLE_1 1 test USDT | [0xfd8a…1681](https://explorer.testnet.whitechain.io/tx/0xfd8a818daf82e6dd2fcfb4bfc966429783282ea00096a8752ec55b00e69b1681) |
| Fri 05:0x | the same run, payers back to their plan targets: ACCEPTANCE_PAYER 4.8 · PAYER 4 · VITALIK 0.4 · REHEARSAL_PAYER 6.01 test USDT | [0x4065…b419](https://explorer.testnet.whitechain.io/tx/0x406521b913687733d76b30e5e855f055cc22da9a6844173041f6456bb52fb419) · [0x4302…f60c](https://explorer.testnet.whitechain.io/tx/0x43021328c21d84df2ca37efb239d9fd520582191eef59a66e6e6982bc949f60c) · [0x7b74…c989](https://explorer.testnet.whitechain.io/tx/0x7b7465ceea17f5c1b9b1207666add57d86d178a74d501516952554396136c989) · [0xcecc…200e](https://explorer.testnet.whitechain.io/tx/0xcecc0860308dc6b54f534a10df4d89ea859a6b0ee22e3ffa375d0d978d46200e) |
| Fri 05:1x | `--plan m0` on Whitechain for real: DISPOSABLE_1 0.005 WBT (a Permit2 lockdown) | [0x8c5c…be91](https://explorer.testnet.whitechain.io/tx/0x8c5cf941a8e6121af0b9c34df2ade23d6f10e2b6648d2859c6011378d7b4be91) |
| Fri 05:1x | the same run: FACILITATOR 0.010329 · RENEWER 0.003496 · POLICY_WRITER 0.000565 · SHOP_KESAR 0.002134 WBT back to target | [0xdcf3…aa16](https://explorer.testnet.whitechain.io/tx/0xdcf316b63f4ff2ac2bca55bdb0bee64361078c9d8bb642b752602f600399aa16) · [0xe176…b146](https://explorer.testnet.whitechain.io/tx/0xe176a02b9505f994ba69b45a25b32a24f232ba2f2003102b48fe86e16220b146) · [0x6daa…31af](https://explorer.testnet.whitechain.io/tx/0x6daac50dd3752e41c98ad211f590dba31406cbe0f1e6cd2c06606b3e064f31af) · [0xf2df…ee83](https://explorer.testnet.whitechain.io/tx/0xf2dff636bbae900643c3d864de358d0b60b5a324010d1a8acc8f982fe735ee83) |
| Fri 05:1x | FUNDER after both runs: 15.54208 test USDT, about 2.5946 WBT | the runs' own summaries |
| Fri 11:44 | in: the founder sent 150 test USDT to FUNDER (from 0x6031…aa6b, block 12,349,311); FUNDER then held 165.54208 test USDT | [0x7aeb…0535](https://explorer.testnet.whitechain.io/tx/0x7aeb681a7395a53c67a93a328f44777528b6ea2218954c995989b78942e10535) |
| Fri 12:4x | `--plan usdt` for real with PAYER's target raised to 125 (the 1240 brief: Vitalik's payer pass at 100 a day): PAYER 99.8 · ACCEPTANCE_PAYER 5.2 · VITALIK 5.2 · REHEARSAL_PAYER 1.2 test USDT | [0xf925…6a91](https://explorer.testnet.whitechain.io/tx/0xf92569acdcb66e1c38376831d44a6ed7edfd695d99da0cbf6a3135de7bc66a91) · [0xcb88…48cd](https://explorer.testnet.whitechain.io/tx/0xcb8842cb4c07d5ee204210c4f85dac21763dca3adf611e909096fec7602248cd) · [0x4538…92e5](https://explorer.testnet.whitechain.io/tx/0x453822a93696922c1e25ecef41a409fcca942682c3706c302728a358be6b92e5) · [0x6aec…434c](https://explorer.testnet.whitechain.io/tx/0x6aec5d3ac9b490b9c18708d70462f5d19e9030b2355a51ec8cd8f13e79d5434c) |
| Fri 12:4x | `--plan m0` on Sepolia for real with VITALIK's target raised to 0.02 (pauses and resumes): VITALIK 0.018 Sepolia ETH | [0xcbe6…cd67](https://sepolia.etherscan.io/tx/0xcbe60c65f4ae30a3581a0bfa9b68ba7e1670b963f5459a61f9410a268714cd67) |
| Fri 12:4x | after both runs: PAYER 125 test USDT; FUNDER 54.14208 test USDT, about 2.5935 WBT, 0.256894 Sepolia ETH | the runs' own summaries, `cast balance` |
| Fri 23:0x | the payer's pass is 300 a day for tonight (W5 brief, ADR-0071 amendment): POLICY_WRITER's `setPolicy` on the checkout, cap 300,000,000, all else unchanged (`scripts/whitechain/policy-cap.mjs payer --yes`; 38,370 gas) | [0x608a…b8fd](https://explorer.testnet.whitechain.io/tx/0x608ae1b6a9e380eee452735f311eaef1ad8ac502ee9b16268bacb1eebc30b8fd) |
| Fri 23:0x | the same pass in ENS: VITALIK sets `graphpay.cap_micro` = 300000000 on payer.vitalik.graphpay.eth (`scripts/ens/owner.mjs cap … --real`; 54,740 gas, Sepolia) | [0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc) |
| Fri 23:0x | `--plan usdt` on Whitechain for real (W5): PAYER 66.8 test USDT, back to its 125 target. FUNDER held 199.14208 test USDT before the run (145 more than the 12:4x row; the incoming transfer is not traced here) and 132.34208 after | [0xa47d…3fe0](https://explorer.testnet.whitechain.io/tx/0xa47dc8907a91e0426ce16961972a07451473d20ac6ca3ab0f52fc16137643fe0) |
| Fri 23:30 | W1's spare for the kill (`node scripts/ens/spare.mjs --yes`): `disposable-2.vitalik.graphpay.eth` on Sepolia. OPERATOR: its resolver (2,769,794 gas) and registration (385,285); VITALIK: its two setter grants (495,949) | [0xeea8…16b9](https://sepolia.etherscan.io/tx/0xeea817653bc0f30628c840fb9e265810e1786c4580a75853c9fc7585137216b9) · [0x4d82…ab43](https://sepolia.etherscan.io/tx/0x4d82116c0a356789652cf33ed5c5f55f7ec5e342a293d5280fef546deca1ab43) · [0xace7…67e5](https://sepolia.etherscan.io/tx/0xace7d1b80334a76c1d0ead5c0fefe070f995c2f3e9a8131680e0552688f767e5) |
| Fri 23:30 | the same run: POLICY_WRITER's `setPolicy` for disposable-2 → DISPOSABLE_2 `0xd2f6C7403B8197985fD2c68DaBDBabC5Aa4557E9`, epoch 0, cap 1.00 a day, 14 days (95,225 gas) | [0xbe08…604c](https://explorer.testnet.whitechain.io/tx/0xbe08647b142b7c49523c6d8f5376c345c491fd90de6c79a062238a34a112604c) |
| Fri 23:31 | the same run: FUNDER → DISPOSABLE_2 1 test USDT, the story's disposable cap (60,923 gas); 1 of the 4 the Coordinator approved for spares tonight | [0x1fd6…35e5](https://explorer.testnet.whitechain.io/tx/0x1fd6f43462497fa5409c296fb6752fdf1c68faaf9d7433fb34c720aedeab35e5) |
| Fri 23:3x | the spare pool: DISPOSABLE_4 `0xaAa08b8511DF9A95Ae572B313944bbB7A7CC8167` · DISPOSABLE_5 `0xF90F3c3Da01ad65A26a351d9e55DfA607CbC0366` · DISPOSABLE_6 `0x87E6816fB9DbB455EfddC19f9d727a71964eE4c5` · DISPOSABLE_7 `0xf47C5009B7Be22806Ba7be77940472b1b5aa3e7c` · DISPOSABLE_8 `0x8ed958161bdEC4566a6781dEada95a6ff5cF291e` · DISPOSABLE_9 `0xD80dbcD11FdD895a973C39Fd1C10cFdc80077196` generated into `.env` (`pnpm wallet:gen --only …`, one per run; unfunded until the keeper uses one); DISPOSABLE_2 to DISPOSABLE_9 keys pushed to Vercel production as Sensitive (`pnpm -s secrets:vercel`) | no transaction |
| Fri 23:5x | RENEWER's new jobs (W3, `/api/customer/subscribe` and `/unsubscribe`): it sends `createSubscription` (floor 700,000 gas; about 0.0035 WBT at 5 gwei) and `cancelWithSig` for the payer agent's Sunday box, beside the cron's `renew`. Subscribe refuses once RENEWER would fall under the cron's 0.02 WBT floor (`RENEWER_LOW`). Watch its balance: 0.0967 WBT at 23:30 IST | the routes' own answers |
| Sat 00:16 | the first production kill (`node scripts/ens/kill-proof.mjs --yes`, W1): VITALIK unregisters `disposable-2.vitalik.graphpay.eth` through the site's `POST /api/customer/kill-disposable` (Sepolia block 12,078,424); the watcher's POLICY_WRITER revokes its pass 9 s later (Whitechain block 12,394,425); its next payment is refused `ENS_EXPIRED_OR_REVOKED`, recorded on Arkiv. DISPOSABLE_2 keeps its 1 test USDT (never spent) | [0x08f1…fff5](https://sepolia.etherscan.io/tx/0x08f116fc2ceebb93e1de209fcbb2f60ac53c094c25b3b06d7da6eb16f194fff5) · [0x40d5…233a](https://explorer.testnet.whitechain.io/tx/0x40d51ac52b440bc33bb6ec2686fe53c53b77be370a84970a0790a744bbd8233a) |
| Sat 00:18 | the fresh spare (`node scripts/ens/spare.mjs --yes`, by hand: the running workers predate #175): `disposable-3.vitalik.graphpay.eth`. OPERATOR: resolver (2,769,806 gas), registration (385,285); VITALIK: setter grants (495,949) | [0x5f1c…10ad](https://sepolia.etherscan.io/tx/0x5f1c91b29e2f198805f48822d4ed0deda18dbbf624d527592252cd56defc10ad) · [0xe19f…21f7](https://sepolia.etherscan.io/tx/0xe19f27fa4e65db93119f23301f56ed145a7d131893dde4e93c85ee86505821f7) · [0xbec8…5145](https://sepolia.etherscan.io/tx/0xbec80ebc4024e52cd648a6577ee21efa719f926c4bfbd5c8a3eb829129555145) |
| Sat 00:19 | the same run: POLICY_WRITER's `setPolicy` for disposable-3 → DISPOSABLE_3 `0x9c785b145F4FFcAc63E9639aF2080946c0e3b8BD`, epoch 0, 1.00 a day, 14 days (95,225 gas); FUNDER → DISPOSABLE_3 1 test USDT (60,923 gas): 2 of the 4 approved for spares tonight | [0x5825…d608](https://explorer.testnet.whitechain.io/tx/0x5825d9ffaeb375b6d0f67750747deddf7aaadef6ed9d8d2ada003fc7a2afd608) · [0x83a3…30d1](https://explorer.testnet.whitechain.io/tx/0x83a3de586ab8039365065ab241219694b7fd8b08893a66786f75d4d9c84130d1) |
| Sat 01:3x | the payer from the shop's takings (W5, `scripts/ops/payer-topup.mjs --from shop --execute --real`): SHOP_KESAR (Filter & Fold's merchant wallet) 63.2 test USDT to PAYER, back to its 125 target; the shop keeps 118.81 (its refund float is 20) | [0xd94a…6f97](https://explorer.testnet.whitechain.io/tx/0xd94af7b0a27a90b1d1c631972dd489c2642e3912b0777f29a73f4f277b926f97) |

## 3. Still to fund (waits on later steps)

| what | who | when |
|---|---|---|
| DISPOSABLE_<n>: 0.005 WBT and 1 test USDT each, fresh key per kill | FUNDER, by script | when M5/M6 provision one |
| W_DIRECTORY top-up to 0.5 tGLM | FUNDER, by script | before M8 writes the synthetic directory |
| stand-in token mint (only if T1 deploys a stand-in; ADR-0045) | DEPLOYER | M2 |
