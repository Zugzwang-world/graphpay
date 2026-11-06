// A fixed-fare cab ride on the same SDK: the fare is known before the ride, so it is a
// fixed-price order (variable fares need pre-authorisation: V2). Names and the fare come
// from the story config.
import { createBuyerAgent, createMerchant } from '@graphpay_ethglobal/agentpay';
import { config, story } from '@graphpay/config';

const ride = story.agentpayExamples.ride;
const at = (area) => story.locations.neighbourhoods.find((n) => n.area === area);
export const operatorName = `${ride.operator.label}.${config.root.ens}`;

// The operator: GET /ride books the fixed-fare ride; a paid request dispatches it.
export function cabOperator({ address, facilitator, publicClient, walletClient }) {
  const merchant = createMerchant({ name: operatorName, address, facilitator, publicClient, walletClient });
  const handler = merchant.route(
    () => ({ items: [{ sku: ride.sku, name: `${ride.name}, ${ride.from} to ${ride.to}`, unitPriceMicro: ride.fareMicro }], fulfilment: { type: 'ride', details: { vehicle: ride.vehicle, pickup: at(ride.from), dropoff: at(ride.to), pickupMinutes: ride.pickupMinutes } } }),
    (_req, { order }) => ({ status: 'driver assigned', orderId: order.orderId, pickupMinutes: ride.pickupMinutes }),
  );
  return { merchant, handler };
}

// The rider's agent: pays only this operator, at most one fare per ride.
export function riderAgent({ account, publicClient, name, fetch }) {
  return createBuyerAgent({ account, publicClient, name, fetch, pass: { capMicro: story.order.budgetMicro, period: 'day', perPaymentMaxMicro: ride.fareMicro, merchants: [operatorName] } });
}
