// A sweet shop and a customer agent: the agent pays a 402 with one signature and no gas.
// Everything runs on a local anvil fork of Whitechain Sepolia (needs Foundry's `anvil`);
// the keys are made for this run and nothing touches the real chain.
//   node sweets.mjs
import { createBuyerAgent, createMerchant, createReferenceRelayer, issueSpendingPass, usdt } from '@graphpay_ethglobal/agentpay';
import { startSandbox } from '@graphpay_ethglobal/agentpay/sandbox';

const sb = await startSandbox();
try {
  const { network, publicClient, accounts, wallet } = sb;
  const shopName = 'corner-sweets.example';
  const agentName = 'errands.sam.example';

  // The shop: one priced route. Your own relayer settles (the anti-drain limits are on by default).
  const relayer = createReferenceRelayer({ walletClient: wallet(accounts.relayer), publicClient, network, allowedMerchants: [accounts.merchant.address] });
  const shop = createMerchant({ name: shopName, address: accounts.merchant.address, facilitator: relayer, publicClient, network });
  const route = shop.route(
    () => ({ items: [{ sku: 'box-12', name: 'box of 12 sweets', unitPriceMicro: usdt('4.80') }], fulfilment: { type: 'delivery', details: { etaMinutes: 25 } } }),
    (_req, { order }) => ({ status: 'preparing', orderId: order.orderId }),
  );
  shop.on('paid', ({ order }) => console.log('shop: paid order', order.orderId, '(on the local fork)'));

  // The spending pass, written once by the policy writer: this wallet may spend up to 6 USDT a day.
  await issueSpendingPass({ walletClient: wallet(accounts.policyWriter), publicClient, network, name: agentName, wallet: accounts.buyer.address, dailyCapMicro: usdt('6') });

  // The customer agent: no gas, pays only this shop. Its fetch goes straight to the shop's handler.
  const agent = createBuyerAgent({
    account: accounts.buyer, publicClient, network, name: agentName,
    pass: { capMicro: usdt('6'), period: 'day', merchants: [shopName] },
    fetch: (url, init) => route(new Request(url, init)),
  });
  const result = await agent.pay('https://corner-sweets.example/box');
  console.log('agent:', result.status, result.amountMicro, 'micro-USDT, answer', await result.response.json());
  if (result.status !== 'paid') process.exitCode = 1;
} finally {
  sb.stop();
}
