import type { Metadata } from 'next';
import { MerchantActions } from '@/components/merchant-actions';
import { ordersOf, txOfRef } from '@/lib/orders';
import { shop, shopEns } from '@/lib/store';

export const metadata: Metadata = { title: 'Merchant' };
export const dynamic = 'force-dynamic';

const usdt = (micro: string) => (Number(BigInt(micro)) / 1e6).toFixed(2);

export default async function Merchant() {
  const rows = await ordersOf(shopEns);
  const explorer = shop.network.explorer.replace(/\/+$/, '');
  return (
    <>
      <h1>Merchant view</h1>
      <p>
        Orders from Graph Arkiv (a money graph on the chain&rsquo;s records), newest first. Dispatch and refund sign with the shop&rsquo;s own key on the server, behind the demo
        passcode. <a href="/api/merchant/export.csv">Download the accountant export</a> (one row per order, read from the chain).
      </p>
      {rows === null ? (
        <p role="alert">The graph did not answer just now. Try again in a moment.</p>
      ) : rows.length === 0 ? (
        <p>No orders yet for {shopEns}.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Event</th>
              <th scope="col">Amount (USDT)</th>
              <th scope="col">Buyer</th>
              <th scope="col">Transaction</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tx = txOfRef(r.ref);
              return (
                <tr key={`${r.kind}-${r.ref}`}>
                  <td>{new Date(Number(r.ts) * 1000).toLocaleString('en-GB')}</td>
                  <td>{r.kind}</td>
                  <td>{usdt(r.amountMicro)}</td>
                  <td>{r.from.ens === shopEns ? r.to.ens : r.from.ens}</td>
                  <td>{tx ? <a href={`${explorer}/tx/${tx}`} target="_blank" rel="noopener noreferrer">{tx.slice(0, 10)}…</a> : ''}</td>
                  <td>{r.kind === 'pay' && r.orderId ? <MerchantActions orderId={r.orderId} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
