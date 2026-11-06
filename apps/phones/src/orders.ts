// The shop's ledger rows (the accountant's CSV and the merchant stream) folded into the
// team's Order shape. Pure functions, so tests run without a network. Every value comes
// from a chain-backed row; a row with no settlement transaction is the seeded history,
// which the phones cannot label yet, so it never becomes an order here.

import type { Link, Money, Order, Refund } from '@/demo/contract';

export interface LedgerRow {
  kind: string;
  orderId: string | null;
  // The buyer agent's owner and the agent that paid (ENS names).
  owner: string;
  payer: string;
  shop: string;
  amountMicro: bigint;
  tx: string | null;
  ref: string;
  // Unix seconds.
  ts: number;
}

export interface FoldProduct {
  shop: string;
  name: string;
  short: string;
  // One piece's name, for an order of a few pieces.
  unitName: string;
  priceMicro: bigint;
  quantity: number;
}

export interface FoldContext {
  persona: { name: string; ens: string };
  shops: { ens: string; name: string }[];
  products: FoldProduct[];
  txLink: (tx: string) => Link;
}

const HASH = /^0x[0-9a-fA-F]{64}$/;
const CHAIN_REF = /^\d+:(0x[0-9a-fA-F]{64}):\d+$/;

export function microToAmount(micro: bigint): string {
  const negative = micro < 0n;
  const abs = negative ? -micro : micro;
  // Two decimals, rounded half up, as the phones show money.
  const cents = (abs + 5_000n) / 10_000n;
  return `${negative ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function amountToMicro(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) throw new Error(`not an amount: ${amount}`);
  const micro = BigInt(match[2]!) * 1_000_000n + BigInt((match[3] ?? '').padEnd(6, '0'));
  return match[1] === '-' ? -micro : micro;
}

const usdt = (micro: bigint): Money => ({ amount: microToAmount(micro), currency: 'USDT' });

// The settlement transaction of a chain event's ref (`<chain id>:<tx hash>:<log index>`).
export function txOfRef(ref: string): string | null {
  const match = CHAIN_REF.exec(ref);
  return match ? match[1]!.toLowerCase() : null;
}

// One CSV line into its cells (RFC 4180 quotes; the export quotes cells with commas or quotes).
export function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      cells.push(cell);
      cell = '';
    } else cell += c;
  }
  cells.push(cell);
  return cells;
}

// The accountant's CSV (`/api/merchant/export.csv`) into ledger rows, by its header names.
export function rowsFromCsv(csv: string): LedgerRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
  const header = csvCells(lines[0] ?? '');
  const col = (name: string) => header.indexOf(name);
  const at = { date: col('date_utc'), order: col('order_id'), kind: col('kind'), owner: col('buyer_ens'), payer: col('payer_ens'), shop: col('shop_ens'), amount: col('amount_usdt'), tx: col('tx_hash'), ref: col('ref') };
  if (Object.values(at).some((i) => i < 0)) throw new Error('the export has an unexpected header');
  const rows: LedgerRow[] = [];
  for (const line of lines.slice(1)) {
    const c = csvCells(line);
    const tx = c[at.tx] ?? '';
    const ts = Date.parse(c[at.date] ?? '');
    if (!Number.isFinite(ts)) continue;
    rows.push({
      kind: c[at.kind] ?? '',
      orderId: c[at.order] || null,
      owner: c[at.owner] ?? '',
      payer: c[at.payer] ?? '',
      shop: c[at.shop] ?? '',
      amountMicro: amountToMicro(c[at.amount] || '0'),
      tx: HASH.test(tx) ? tx.toLowerCase() : null,
      ref: c[at.ref] ?? '',
      ts: Math.floor(ts / 1000),
    });
  }
  return rows;
}

// The parent of an ENS name: an agent's owner (`<agent>.<owner>` → `<owner>`).
export const parentName = (ens: string): string => ens.slice(ens.indexOf('.') + 1);
const firstLabel = (ens: string): string => ens.split('.')[0] ?? ens;

// A merchant stream frame (`event: edge`) into a ledger row. Edges arriving at the shop come
// from the buyer agent; refunds and deliveries leave the shop towards it.
export function rowFromEdge(e: { kind: string; from: string; to: string; amountMicro: string; orderId: string | null; ref: string; ts: string; settlementTx: string | null }, shopEns: string): LedgerRow {
  const payer = e.from === shopEns ? e.to : e.from;
  return { kind: e.kind, orderId: e.orderId, owner: parentName(payer), payer, shop: shopEns, amountMicro: BigInt(e.amountMicro), tx: e.settlementTx ?? txOfRef(e.ref), ref: e.ref, ts: Number(e.ts) };
}

export const rowKey = (r: Pick<LedgerRow, 'kind' | 'ref'>): string => `${r.kind}|${r.ref}`;

// The items of an order, from the shop's catalogue: the product at that price, else the
// product whose unit price divides the amount (a re-order of a few pieces).
export function itemsFor(shop: string, total: bigint, products: FoldProduct[]): Order['items'] {
  const own = products.filter((p) => p.shop === shop);
  const exact = own.find((p) => p.priceMicro === total);
  if (exact) return [{ name: exact.name, qty: 1, price: usdt(total) }];
  for (const p of own) {
    const unit = p.priceMicro / BigInt(p.quantity);
    if (unit > 0n && total % unit === 0n) return [{ name: p.unitName, qty: Number(total / unit), price: usdt(unit) }];
  }
  return [];
}

// Every order in the rows, oldest first. Rows without an order id or a settlement
// transaction (the seeded history) are left out.
export function foldOrders(rows: LedgerRow[], ctx: FoldContext, isNew: (orderId: string) => boolean = () => false): Order[] {
  const real = rows.filter((r) => r.orderId && r.tx).sort((a, b) => a.ts - b.ts || (a.ref < b.ref ? -1 : 1));
  const byOrder = new Map<string, LedgerRow[]>();
  for (const r of real) byOrder.set(r.orderId!, [...(byOrder.get(r.orderId!) ?? []), r]);

  // The buyer's record with this shop in the rows read: paid orders and refunds.
  const paidBy = new Map<string, number>();
  const refundsBy = new Map<string, number>();
  const firstBy = new Map<string, number>();
  for (const r of real) {
    if (!firstBy.has(r.payer)) firstBy.set(r.payer, r.ts);
    if (r.kind === 'pay' || r.kind === 'renew') paidBy.set(r.payer, (paidBy.get(r.payer) ?? 0) + 1);
    if (r.kind === 'refund') refundsBy.set(r.payer, (refundsBy.get(r.payer) ?? 0) + 1);
  }

  const orders: Order[] = [];
  for (const [orderId, trail] of byOrder) {
    // A subscription row alone is a plan, not an order.
    if (!trail.some((r) => r.kind === 'order' || r.kind === 'pay' || r.kind === 'renew')) continue;
    const first = trail[0]!;
    const pay = trail.find((r) => r.kind === 'pay' || r.kind === 'renew');
    const total = pay?.amountMicro ?? trail.find((r) => r.kind === 'order')?.amountMicro ?? 0n;
    const refunds: Refund[] = [];
    let status: Order['status'] = 'ordered';
    let paidAt: number | undefined;
    let deliveredAt: number | undefined;
    for (const r of trail) {
      const at = r.ts * 1000;
      if (r.kind === 'pay' || r.kind === 'renew') {
        status = 'paid';
        paidAt = at;
      } else if (r.kind === 'deliver') {
        if (status === 'paid') status = 'delivered';
        deliveredAt = at;
      } else if (r.kind === 'request') {
        refunds.push({ id: r.ref, amount: usdt(r.amountMicro), full: r.amountMicro >= total, reason: '', status: 'requested', requestedAt: at, links: r.tx ? [ctx.txLink(r.tx)] : [] });
      } else if (r.kind === 'refund') {
        const open = refunds.find((f) => f.status === 'requested' || f.status === 'accepted');
        const links = r.tx ? [ctx.txLink(r.tx)] : [];
        if (open) Object.assign(open, { status: 'refunded', amount: usdt(r.amountMicro), full: r.amountMicro >= total, decidedAt: at, settledAt: at, links: [...open.links, ...links] });
        else refunds.push({ id: r.ref, amount: usdt(r.amountMicro), full: r.amountMicro >= total, reason: '', status: 'refunded', requestedAt: at, decidedAt: at, settledAt: at, links });
      }
    }
    const paid = paidBy.get(first.payer) ?? 0;
    const refunded = refundsBy.get(first.payer) ?? 0;
    const ownerName = first.owner === ctx.persona.ens ? ctx.persona.name : firstLabel(first.owner);
    orders.push({
      id: orderId,
      number: orderId.slice(2, 6).toUpperCase(),
      kind: trail.some((r) => r.kind === 'renew') ? 'renewal' : 'order',
      shop: { ens: first.shop, name: ctx.shops.find((s) => s.ens === first.shop)?.name ?? firstLabel(first.shop) },
      items: itemsFor(first.shop, total, ctx.products),
      total: usdt(total),
      status,
      createdAt: first.ts * 1000,
      paidAt,
      dispatchedAt: deliveredAt,
      deliveredAt,
      buyer: { ens: first.payer, role: firstLabel(first.payer), owner: first.owner },
      owner: { name: ownerName, ens: first.owner },
      reputation: { orders: paid, refunds: refunded, since: String(new Date(firstBy.get(first.payer)! * 1000).getUTCFullYear()) },
      risk: { level: refunded === 0 ? 'safe' : 'warn', text: `${paid} paid, ${refunded} refunded` },
      links: pay?.tx ? [ctx.txLink(pay.tx)] : [],
      refunds,
      isNew: isNew(orderId),
      synthetic: false,
    });
  }
  return orders;
}
