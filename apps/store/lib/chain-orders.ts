// The shop's orders as the chain has them: one row per order from the SDK merchant's export.
import { chainOrdersFrom, type ChainOrder } from './csv';
import { shop } from './store';

export type { ChainOrder };

export async function chainOrders(): Promise<ChainOrder[]> {
  return chainOrdersFrom(await shop.merchant.exportCsv());
}
