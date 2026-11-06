# @graphpay/checkout-kit

Take payments in test USDT on Whitechain from a browser wallet, with no gas for the buyer, in about 20 lines. **It sits on `@graphpay_ethglobal/agentpay` (the merchant, the 402 flow, refunds and the CSV export) and on GraphPay's x402 facilitator, which verifies and settles the payment; it adds a catalog, a browser-wallet client and a button, and uses only the SDK's public exports.** **Testnets only** (Whitechain Sepolia, chain 1874). Not published to npm.

## The shop: 20 lines

```ts
// lib/shop.ts
import { createGraphPayShop } from '@graphpay/checkout-kit';

export const shop = createGraphPayShop({
  shopEns, merchant, catalog, publicClient,  // your shop's name, payout address, items, a Whitechain client
  facilitatorUrl: process.env.FACILITATOR_URL!, facilitatorToken: process.env.FACILITATOR_AUTH_TOKEN!,
  passcode: process.env.DEMO_PASSCODE,       // required (or `open: true`): the relayer pays gas, so gate who may pay
});

// app/api/catalog/route.ts and app/api/order/route.ts (Next.js)
export const GET = shop.catalog; // the items and prices
export const GET = shop.order;   // 402 with the quote; settles when the request carries a signature

// the page (client component)
import { GraphPayButton } from '@graphpay/checkout-kit/react';
<GraphPayButton shopUrl="/api" item="box-12" qty={1} network={network} />
```

`catalog` is `[{ sku, name, unit?, unitPriceMicro }]` (6-decimal units). `passcode` is required unless you pass `open: true`. A page on another origin needs CORS on `/api` (the kit sends `x-agentpay-payer` and `PAYMENT-SIGNATURE` headers). The app can pin the payee and the largest amount it accepts with `expect={{ payTo, maxAmountMicro }}`. `network` is `networkForClient(shop.network)`, passed from a server component. Prices come from the catalog only: the request chooses an item and a quantity, never a price.

## What a payment is

1. The button connects the wallet and switches it to chain 1874.
2. `GET /order?item=&qty=` answers **402** with exactly one option: the order, its amount and the payee. The button checks it against the network the app configured (chain, token, checkout, amount, payee, deadline) and shows it: "Pay 4.80 USDT to shop, no gas".
3. On confirm, the wallet asks for a signature over that order (a Permit2 witness, so payee, amount, deadline and order id are inside it) and, the first time, for a gasless approval of exactly the order amount. They go back as `PAYMENT-SIGNATURE`. Our facilitator verifies and settles; it pays the gas and cannot redirect the money.
4. The receipt shows the settlement with its explorer link. A payment that cannot be confirmed (a timeout, a 5xx) is never re-quoted: the button offers "Check again", which re-sends the same signature (it can never pay twice) until the order is resolved or its deadline has passed.

A **re-order** is the same route with `?parent=<order id>`: the parent must be a paid order of this shop by the same payer. For anything beyond the button, `graphpayCheckout`, `getQuote`, `payQuote` and `connectWallet` are exported from `@graphpay/checkout-kit/client` (viem only, no Node modules). The shop's own `shop.merchant` is the `@graphpay_ethglobal/agentpay` merchant: refunds, delivery marks, subscriptions and the accountant CSV (`exportCsv`).

## Deviations from `WEBSITE_SPEC.md` §10

- The spec names `{ catalog, quote, pay, reorder }`; x402 uses one URL for the quote (402) and the payment, so `quote`, `pay` and `reorder` are the same handler as `order`.
- `GraphPayButton` has a confirm step (the exact quote, then the signature); `graphpayCheckout` takes `approve(quote)` for the same.
- Subscriptions (the Sunday box) go through `shop.merchant` and agentpay's `signSubscription`; the kit's button does not offer them yet.

## Tests

`pnpm --filter @graphpay/checkout-kit test`: the signer's shapes equal `@graphpay/contracts` and its signatures equal the SDK buyer's byte for byte; the whole loop offline (quote, one signature, receipt, tampered quotes refused before anything is signed, passcode, failed and unknown settlements, re-orders).
