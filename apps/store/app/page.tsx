import { config } from '@graphpay/config';
import { networkForClient } from '@graphpay/checkout-kit';
import { Shelf } from '@/components/shelf';
import { catalog, shop, shopName } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default function Home() {
  const items = catalog.map((i) => ({ sku: i.sku, name: i.name, unit: i.unit ?? null, unitPriceMicro: String(i.unitPriceMicro) }));
  return (
    <>
      <h1>{shopName}</h1>
      <p>
        Pay in test USDT with a browser wallet on {shop.network.name}. You pay no gas: you sign in your wallet and our facilitator sends the transaction. The order and your receipt are on the chain; this is a
        testnet demo with synthetic goods.
      </p>
      <Shelf items={items} network={networkForClient(shop.network)} rpcUrl={config.networks.whitechain.publicRpcs[0]?.url ?? ''} />
    </>
  );
}
