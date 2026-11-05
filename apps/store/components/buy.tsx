'use client';

// graphpay:begin
import { GraphPayButton } from '@graphpay/checkout-kit/react';
// graphpay:end
import { useState } from 'react';
import { usePasscode } from './passcode';
import type { ClientNetwork } from '@/lib/types';

export interface Receipt {
  orderId: string;
  item: string;
  qty: number;
  explorer: string | null;
  paidAt: number;
}

const KEY = 'graphpay-store.receipts';

export function loadReceipts(): Receipt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Receipt[];
  } catch {
    return [];
  }
}

// The receipts live in this browser only; the chain is the record.
function saveReceipt(item: string, qty: number, then?: (r: Receipt) => void) {
  return (paid: { orderId: string; explorer: string | null }) => {
    const receipt = { orderId: paid.orderId, item, qty, explorer: paid.explorer, paidAt: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify([receipt, ...loadReceipts()].slice(0, 20)));
    } catch {
      // storage blocked: the receipt still shows on screen
    }
    then?.(receipt);
  };
}

export function Buy({ item, name, network, rpcUrl, parent, onPaid }: { item: string; name: string; network: ClientNetwork; rpcUrl: string; parent?: string; onPaid?: (r: Receipt) => void }) {
  const [qty, setQty] = useState(1);
  const passcode = usePasscode();
  return (
    <div className="buy">
      <label>
        <span className="small">Quantity</span>
        <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} aria-label={`Quantity of ${name}`} />
      </label>
      {/* graphpay:begin */}
      <GraphPayButton shopUrl="/api" item={item} qty={qty} parent={parent} network={network} rpcUrl={rpcUrl} passcode={passcode} onPaid={saveReceipt(item, qty, onPaid)} />
      {/* graphpay:end */}
    </div>
  );
}
