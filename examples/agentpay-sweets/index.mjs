// A sweet shop and a customer agent on the same SDK. Names and prices come from the story config.
import { createBuyerAgent, createMerchant } from '@graphpay_ethglobal/agentpay';
import { config, story } from '@graphpay/config';

const shop = story.shops.find((s) => s.key === story.order.shop);
const box = shop.products.find((p) => p.sku === story.order.sku);
export const shopName = `${shop.label}.${config.root.ens}`;

// The shop: one priced route. A paid request reaches the handler; everything else gets a 402.
export function sweetShop({ address, facilitator, publicClient, walletClient, priceMicro = box.priceMicro }) {
  const merchant = createMerchant({ name: shopName, address, facilitator, publicClient, walletClient });
  const handler = merchant.route(
    () => ({ items: [{ sku: box.sku, name: `${box.name}, ${box.unit}`, unitPriceMicro: priceMicro }], fulfilment: { type: 'delivery', details: { etaMinutes: shop.scenario.etaMinutes } } }),
    (_req, { order }) => ({ status: 'preparing', orderId: order.orderId }),
  );
  return { merchant, handler };
}

// The customer agent: pays only this shop, at most the mandate's budget per day.
export function sweetsBuyer({ account, publicClient, name, fetch }) {
  return createBuyerAgent({ account, publicClient, name, fetch, pass: { capMicro: story.order.budgetMicro, period: 'day', merchants: [shopName] } });
}
