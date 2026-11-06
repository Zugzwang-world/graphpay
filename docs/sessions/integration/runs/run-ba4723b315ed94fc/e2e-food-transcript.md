# e2e:food transcript (test errand, real networks (SYNTHETIC story))

2026-11-06T04:33:06.458Z → 2026-11-06T04:33:23.884Z (17.4 s), real network, receipts WHITECHAIN, model testing: claude-opus-5-5 @ xhigh. API cost 0 USD. The story and its history are synthetic.

## Assertions

| id | result | measured | expected |
|---|---|---|---|
| A | FAIL (the answer carries an explain id; the good shop chosen; good ranks above the runner-up; the trap excluded) | {"explainId":null,"chosen":null,"scores":[],"trapEvents":0} | good > runner-up, trap excluded, no trap order or payment, trap balance unchanged |
| B | FAIL (status paid; PaymentSettled for the order; payer paid the price; the good shop received it; the receipt is on the chain) | {"status":"no-purchase","orderId":null,"settle":null,"payerDelta":"-0.00","shopDelta":"+0.00","receipt":null} | PaymentSettled; payer −4.80, shop +4.80; receipt on eip155:1874 |
| C | FAIL (cursor at or past the settle block; trail kinds in order) | {"cursorBlock":12343232,"settleBlock":null,"trail":[]} | cursor ≥ settle block; trail order → pay → deliver; refs 1874:<tx>:<logIndex> |
| D | FAIL (good TODAY orders +1; good TODAY paid +price; good TODAY delivered +1; good TODAY on time +1; good all-time orders +1; payer TODAY paid +price) | {"goodToday":{"orders":"3","refunds":"1","delivered":"2","onTime":"2","paidMicro":"6000000","refundedMicro":"800000"},"goodAllOrders":"260","payerToday":{"orders":"0","refunds":"0","delivered":"0","onTime":"0","paidMicro":"0","refundedMicro":"0"},"explainIds":["3af73b36ba35","3af73b36ba35"]} | TODAY +1 order, +4.80, +1 delivered, +1 on time; all-time +1; payer TODAY +4.80 |

## The errand

- **vitalik.graphpay.eth → concierge.vitalik.graphpay.eth:** Just landed in Mumbai. Get me the best gulab jamun near me under 6 USDT by 8 pm.
- guard G1 ok: mandate from the human's words: at most 6.000000 USDT, by 2026-11-06T20:00:00+05:30 (hash 0x0c5a80df0c98786229a9427ac38c4d4a5286d6b848d8329687d2af4b8751195d)

## On-chain


## Mirrored to Arkiv


## GraphQL answers

- tallies before: explain `3af73b36ba35`
- tallies after the payment: explain `3af73b36ba35`
- the order trail: explain `null`

