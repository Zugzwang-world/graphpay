import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderTrail } from '@/components/order-trail';

export const metadata: Metadata = { title: 'An order’s trail' };

// An order id is the bytes32 the checkout contract keys orders by.
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) notFound();
  return (
    <div className="page">
      <h1>
        Order <span className="mono">{orderId.slice(0, 10)}…{orderId.slice(-6)}</span>
      </h1>
      <p className="muted">Every record of this order on Arkiv, in order: requested, paid, delivered, refunded. Each receipt cannot be edited.</p>
      <OrderTrail orderId={orderId.toLowerCase()} />
    </div>
  );
}
