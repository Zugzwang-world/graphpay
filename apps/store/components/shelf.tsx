'use client';

import { useEffect, useState } from 'react';
import { Buy, loadReceipts, type Receipt } from './buy';
import type { ClientNetwork } from '@/lib/types';

interface Item {
  sku: string;
  name: string;
  unit: string | null;
  unitPriceMicro: string;
}

const usdt = (micro: string) => `${(Number(BigInt(micro)) / 1e6).toFixed(2)}`;

export function Shelf({ items, network, rpcUrl }: { items: Item[]; network: ClientNetwork; rpcUrl: string }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  useEffect(() => setReceipts(loadReceipts()), []);
  const names = new Map(items.map((i) => [i.sku, i.name]));
  return (
    <>
      <div className="grid">
        {items.map((item) => (
          <section key={item.sku} className="card" aria-label={item.name}>
            <h2>{item.name}</h2>
            <p>
              <span className="price">{usdt(item.unitPriceMicro)} {network.token.symbol}</span>
              {item.unit ? <span className="small"> per {item.unit}</span> : null}
            </p>
            <Buy item={item.sku} name={item.name} network={network} rpcUrl={rpcUrl} onPaid={(r) => setReceipts([r, ...receipts])} />
          </section>
        ))}
      </div>
      <h2>Your orders</h2>
      {receipts.length === 0 ? (
        <p className="small">Nothing yet. Your receipts are kept in this browser; the payment itself is on the chain.</p>
      ) : (
        <ul>
          {receipts.map((r) => (
            <li key={r.orderId} className="card">
              <p>
                {r.qty} x {names.get(r.item) ?? r.item}, {new Date(r.paidAt).toLocaleString('en-GB')}{' '}
                {r.explorer ? <a href={r.explorer} target="_blank" rel="noopener noreferrer">receipt on the explorer</a> : null}
              </p>
              <Buy item={r.item} name={names.get(r.item) ?? r.item} network={network} rpcUrl={rpcUrl} parent={r.orderId} onPaid={(n) => setReceipts([n, ...receipts])} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
