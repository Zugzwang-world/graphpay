## ENS

1. Which record keys carry payout address, spending cap and status, and which are GraphPay-specific?
2. Where is the spending cap enforced rather than merely published?
3. How do you verify that the payer controls its claimed ENS subname?
4. What happens if a parent name expires or changes owner during an order?
5. Can a compromised shop change its payout record after a quote is signed?
6. How do you invalidate cached status records when an agent is paused?
7. What prevents a shut-down agent from spending through an older delegation?
8. How do ENS identity and ERC-8004 registration differ in this implementation?
9. Which resolver and chain are authoritative when records disagree?
10. Why does a resolvable name establish identity continuity but not honest behaviour?

## Arkiv

1. What exact entities, attributes and indexes represent the payment graph?
2. Which two reads answer the shop comparison, and what is counted as one read?
3. What assumptions produce the about-48-read baseline?
4. How does the comparison change when the number of shops and orders grows?
5. Who may write a payment or refund edge, and how is its authenticity checked?
6. How do you prevent fabricated orders from improving a shop’s reputation?
7. What happens to a trust score when underlying entities expire?
8. How do you handle indexing lag, partial writes and chain reorganizations?
9. Can independent clients reproduce each score from the same snapshot?
10. Which customer details are public, and how do you keep sensitive evidence off the graph?

## Whitechain

1. Which chain ID, test USDT contract and settlement contract does the demo use?
2. Who actually pays gas when the payer agent pays none?
3. What does the single signature authorize, and what is outside its scope?
4. How are amount, recipient, chain, expiry and nonce bound into that authorization?
5. Where are the daily spending pass and renewal limits enforced?
6. How do pause and permanent revocation affect previously signed requests?
7. How do you prevent replay and duplicate settlement after a retry?
8. What confirmation threshold turns paid into final, and how do you handle a reorganization?
9. Who authorizes refunds, and what prevents a refund exceeding the original payment?
10. What changes are needed before using real assets rather than test USDT?
