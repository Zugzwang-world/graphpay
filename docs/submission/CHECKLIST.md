# Submission-day checklist

`planning/SPONSOR_CHECKLIST.md` §6, row by row, each done with its evidence or named as a founder action. Tracks: Arkiv "Build on Arkiv" with the Swarm bonus, ENS "Best Use of ENSv2", Whitechain Operate (ADR-0051; Scale is not entered). Checked Fri 6 Nov, about 23:40 IST; W7 updates it as the night streams land.

| item | sponsor | status | evidence, or the founder's action |
|---|---|---|---|
| Re-read the prize pages and the rules page | all | done | read at M0, Thu 22:02–22:03 IST: [`docs/technical/FACTS.md`](../technical/FACTS.md) (ETHGlobal and Whitechain rows) |
| Ask the booth and workshop questions; log the answers | all | closed | no answers came; the founder's defaults are final (ADR-0044); the open ones are listed in [`arkiv/friction.md`](../../arkiv/friction.md) |
| Fund the writer wallets with tGLM | Arkiv | done | [`docs/technical/WALLETS.md`](../technical/WALLETS.md) §2 |
| Seed the synthetic city; measure the race | Arkiv | done at size S | S: acceptance D6 passes, [`bench/BENCHMARK-LIVE.md`](../../bench/BENCHMARK-LIVE.md). M was only partly seeded before the founder stopped it (Sat 00:58 IST); race mode stays at S (the founder, 01:24 IST), and no M number is claimed |
| README with the writer wallets and a runnable query | Arkiv | done | [README, Arkiv](../../README.md#arkiv-the-money-graph) and its [keyless query](../../README.md#query-arkiv-yourself-one-command-no-keys) |
| `schema.md`, `friction.md`, `why-arkiv.md`, `how-you-use-arkiv.md` | Arkiv | done | [`arkiv/`](../../arkiv/); every friction row has an event-day repro |
| `reach.md`; the package published; a live GraphQL URL | Arkiv | done | [`arkiv/reach.md`](../../arkiv/reach.md); [npm](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph); [GraphQL](https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22filter-and-fold.graphpay.eth%22%29%7Bcategory%20tally%7Borders%20refunds%7D%7D%7D) |
| `swarm.md`, seven items | Arkiv (Swarm) | done, item 6 waits for the video | [`arkiv/swarm.md`](../../arkiv/swarm.md) |
| Test USDT `0xcedf…55a7` in hand | Whitechain | done | ADR-0045; [`docs/technical/WALLETS.md`](../technical/WALLETS.md) |
| The relayer funded with WBT | Whitechain | done | 0.774 WBT against a 0.3 floor at 23:05 IST: [health](https://graphpay-event.vercel.app/api/facilitator/health) |
| Contracts deployed and verified on 1874 | Whitechain | done | [`GraphPayCheckout`](https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract) (acceptance C1) |
| The qualifying USDT payment, linked in the README | Whitechain | done | [0x8750…2c00](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00): 4.80 test USDT, payer gas 0. The regenerated report shows C7 as a fail because its runner reads the 1.20 re-order's transfer instead (a runner bug, [`docs/sessions/coordinator/handover.md`](../sessions/coordinator/handover.md)); the transaction itself is above |
| A README line on why on-chain settlement | Whitechain | done | [README, Whitechain](../../README.md#whitechain-payments) |
| A drop-in checkout of about 20 lines in a separate demo store | Operate | done in code; not deployed | [`apps/store`](../../apps/store): 12 lines; one real kit payment, [0xf1e7…3f89](https://explorer.testnet.whitechain.io/tx/0xf1e76a91d855af352e7b38122f94c337be2a74e25ce087eb396b7945be343f89). `graphpay-store.vercel.app` answers 404: the Coordinator deploys it, or the README's local run stands |
| Merchant and customer views; refund, renewal, export | Operate | done | the [live stage](https://graphpay-event.vercel.app); [refund](https://explorer.testnet.whitechain.io/tx/0xcd442a5e6675e0eae8a66bc17ee3913af1b673e39a54a28d4a14a0fab58bc425); [renewal](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f); [accountant CSV](https://graphpay-event.vercel.app/api/merchant/export.csv) |
| The facilitator's health page; the gas and drain section | (Scale, not entered) | done anyway | [health](https://graphpay-event.vercel.app/api/facilitator/health); [README, Whitechain](../../README.md#whitechain-payments) |
| `WHITECHAIN_FEEDBACK.md` from the event build's runs | Whitechain | done | [`WHITECHAIN_FEEDBACK.md`](../../WHITECHAIN_FEEDBACK.md) |
| The root name, registries, resolvers and agents on Sepolia | ENS | done | [`docs/sessions/identity/namespace.md`](../sessions/identity/namespace.md); [`ENS.md`](ENS.md) |
| The ENS moments rehearsed on the live URL | ENS | mostly | Pause and resume run from the phones; the kill is a button on `/customer` since #175 (when a spare agent is ready), run once on production at 00:16 IST (#183); the refused cap write is proven by acceptance (B3) and has no button |
| The live demo opens for judges | ENS, all | done | public, no passcode (ADR-0069): https://graphpay-event.vercel.app |
| `AI_USAGE.md` and the disclosure, linked from the README | all | done | [`AI_USAGE.md`](../../AI_USAGE.md); the README's "How this was built" |
| A public repo: commits through the event, a license, no secrets | all | done | MIT [`LICENSE`](../../LICENSE); acceptance A2 and F1 pass ([`ACCEPTANCE_REPORT.md`](../../ACCEPTANCE_REPORT.md)) |
| The written pre-event disclosure, sent to ETHGlobal | all | **founder** | paste [`docs/plan/DISCLOSURE_MESSAGE.md`](../plan/DISCLOSURE_MESSAGE.md) into the Hacker Dashboard, if not sent |
| A 2 to 4 minute video showing every party | Whitechain, all | **founder** | record from [`VIDEO.md`](VIDEO.md), in your own voice |
| Every team member on the ETHGlobal project | all | **founder** | confirm; the README's Team section names `Zugzwang-world` and `ajatshatru01` |
| The ETHGlobal submission: tracks, repo, live link, video, partner files | all | **founder** | paste from [`ETHGLOBAL.md`](ETHGLOBAL.md) by 08:00 IST |
