// A fixed-fare cab ride: the fare is known before the ride, so it is a fixed-price order
// (variable fares need pre-authorisation, which is V2). Same SDK, same flow, a `ride` fulfilment.
// Runs on a local anvil fork of Whitechain Sepolia (needs Foundry's `anvil`); nothing touches the real chain.
//   node cab.mjs
import { createBuyerAgent, createMerchant, createReferenceRelayer, issueSpendingPass, usdt } from '@graphpay_ethglobal/agentpay';
import { startSandbox } from '@graphpay_ethglobal/agentpay/sandbox';

const sb = await startSandbox();
try {
  const { network, publicClient, accounts, wallet } = sb;
  const operatorName = 'city-cabs.example';
  const riderName = 'rides.sam.example';
  const fare = usdt('3.20');

  const relayer = createReferenceRelayer({ walletClient: wallet(accounts.relayer), publicClient, network, allowedMerchants: [accounts.merchant.address] });
  const operator = createMerchant({ name: operatorName, address: accounts.merchant.address, facilitator: relayer, publicClient, network });
  const route = operator.route(
    () => ({
      items: [{ sku: 'ride-fixed', name: 'Fixed-fare ride, Old Town to Station', unitPriceMicro: fare }],
      fulfilment: { type: 'ride', details: { pickup: 'Old Town', dropoff: 'Station', vehicle: 'sedan', pickupMinutes: 6 } },
    }),
    (_req, { order }) => ({ status: 'driver assigned', orderId: order.orderId, pickupMinutes: 6 }),
  );

  await issueSpendingPass({ walletClient: wallet(accounts.policyWriter), publicClient, network, name: riderName, wallet: accounts.buyer.address, dailyCapMicro: usdt('10') });

  // The rider's agent may pay this operator only, and at most one fare per ride.
  const rider = createBuyerAgent({
    account: accounts.buyer, publicClient, network, name: riderName,
    pass: { capMicro: usdt('10'), period: 'day', perPaymentMaxMicro: fare, merchants: [operatorName] },
    fetch: (url, init) => route(new Request(url, init)),
  });
  const result = await rider.pay('https://city-cabs.example/ride');
  console.log('rider:', result.status, result.amountMicro, 'micro-USDT, answer', await result.response.json());
  if (result.status !== 'paid') process.exitCode = 1;
} finally {
  sb.stop();
}
