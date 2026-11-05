# e2e:food transcript (test errand, real networks (SYNTHETIC story))

2026-11-05T23:01:33.117Z → 2026-11-05T23:02:39.950Z (66.8 s), real network, receipts WHITECHAIN, model testing: claude-opus-5-5 @ xhigh. API cost 0.2289 USD. The story and its history are synthetic.

## Assertions

| id | result | measured | expected |
|---|---|---|---|
| A | pass | {"explainId":"f3d1bb972a81","chosen":"kesar-kingdom.graphpay.eth","scores":[{"ens":"kesar-kingdom.graphpay.eth","score":0.9152605195518567,"eligible":true},{"ens":"syrup-street.graphpay.eth","score":0.8632476215644365,"eligible":true},{"ens":"jamun-junction.graphpay.eth","score":0.7508551857689739," | good > runner-up, trap excluded, no trap order or payment, trap balance unchanged |
| B | FAIL (status paid; PaymentSettled for the order; payer paid the price; the good shop received it; the receipt is labelled) | {"status":"refused","orderId":null,"settle":null,"payerDelta":"-0.00","shopDelta":"+0.00","receipt":null} | PaymentSettled; payer −4.80, shop +4.80; receipt WHITECHAIN |
| C | FAIL (cursor at or past the settle block; trail kinds in order) | {"cursorBlock":12323387,"settleBlock":null,"trail":[]} | cursor ≥ settle block; trail order → pay → deliver; refs 1874:<tx>:<logIndex> |
| D | FAIL (good TODAY orders +1; good TODAY paid +price; good TODAY delivered +1; good TODAY on time +1; good all-time orders +1; payer TODAY paid +price) | {"goodToday":{"orders":"9","refunds":"1","delivered":"4","onTime":"4","paidMicro":"12010000","refundedMicro":"800000"},"goodAllOrders":"250","payerToday":{"orders":"6","refunds":"0","delivered":"0","onTime":"0","paidMicro":"6810000","refundedMicro":"0"},"explainIds":["5420d0ce639d","5420d0ce639d"]} | TODAY +1 order, +4.80, +1 delivered, +1 on time; all-time +1; payer TODAY +4.80 |

## The errand

- **vitalik.graphpay.eth → concierge.vitalik.graphpay.eth:** Just landed in Mumbai. Get me the best gulab jamun near me under 6 USDT by 8 pm.
- guard G1 ok: mandate from the human's words: at most 6.000000 USDT, by 2026-11-06T20:00:00+05:30 (hash 0x0c5a80df0c98786229a9427ac38c4d4a5286d6b848d8329687d2af4b8751195d)
- guard G1 ok: concierge.vitalik.graphpay.eth: the need matches the human's words
- **concierge.vitalik.graphpay.eth → scout.vitalik.graphpay.eth:** find 12 × gulab jamun in Mumbai
- **concierge.vitalik.graphpay.eth → analyst.vitalik.graphpay.eth:** rank shops for gulab jamun in Mumbai by trust
- guard G2 ok: ranking recomputed in code from its own 90-day query (explain f3d1bb972a81): kesar-kingdom.graphpay.eth 0.915 > syrup-street.graphpay.eth 0.863 > jamun-junction.graphpay.eth 0.751 excluded (refund rate 18.2% is above 10.0% (90 days); on-time rate 70.9% is below 80.0% (90 days))
- **scout.vitalik.graphpay.eth → concierge.vitalik.graphpay.eth:** 3 offers (SYNTHETIC)
- **analyst.vitalik.graphpay.eth → concierge.vitalik.graphpay.eth:** best eligible: kesar-kingdom.graphpay.eth
- guard G2 ok: kesar-kingdom.graphpay.eth is eligible in code's ranking (score 0.915) and its offer fits the budget and deadline
- **concierge.vitalik.graphpay.eth → rehearsal.vitalik.graphpay.eth:** pay kesar-kingdom.graphpay.eth: 12 × gulab jamun, at most 4.80 USDT
- **rehearsal.vitalik.graphpay.eth → storefront.kesar-kingdom.graphpay.eth:** quote 12 × gulab jamun
- **storefront.kesar-kingdom.graphpay.eth → risk.kesar-kingdom.graphpay.eth:** vet rehearsal.vitalik.graphpay.eth
- guard G9 refused: declined rehearsal.vitalik.graphpay.eth: no readable standing on Arkiv: no readable standing for rehearsal.vitalik.graphpay.eth; risk agent: Declined: the buyer's cancel rate is 1 cancel out of 6 orders, about 16.7%. The policy limit is 15%. All figures here are synthetic/mock demo data. The ENS records call this agent part of a 'Synthetic demo cast'. The GraphQL node reports synthetic=false and reputation source TALLY.; risk agent: Name passes: ens_check shows rehearsal.vitalik.graphpay.eth as REGISTERED with status ACTIVE (graphpay.status active, principal vitalik.graphpay.eth). GraphQL also shows status active and verified true.; risk agent: Disputes pass: 0 disputes, against a limit of 5 (synthetic data).; risk agent: Daily cap passes: today (day 20762) the agent has spent 6,810,000 micro, or 6.81 USDT, across 5 payments to kesar-kingdom.graphpay.eth. Adding this 4.80 USDT order makes 11.61 USDT, under the 30,000,000 micro (30 USDT) cap (synthetic data).; risk agent: The only failing check is the cancel rate, and that alone is enough to decline under the policy. The GraphQL explain id is 08cf93932803.
- **risk.kesar-kingdom.graphpay.eth → storefront.kesar-kingdom.graphpay.eth:** decline
- guard G8 refused: SHOP_REFUSED: no readable standing on Arkiv: no readable standing for rehearsal.vitalik.graphpay.eth; risk agent: Declined: the buyer's cancel rate is 1 cancel out of 6 orders, about 16.7%. The policy limit is 15%.
- **rehearsal.vitalik.graphpay.eth → concierge.vitalik.graphpay.eth:** refused (SHOP_REFUSED)

## On-chain


## Mirrored to Arkiv


## GraphQL answers

- tallies before: explain `5420d0ce639d`
- tallies after the payment: explain `5420d0ce639d`
- the order trail: explain `null`

