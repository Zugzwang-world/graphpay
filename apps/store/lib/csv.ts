// The shop's orders as the chain has them, parsed from the SDK merchant's CSV export (one row
// per order from the OrderCreated, PaymentSettled and Refunded logs of this shop). No imports:
// it is tested on its own.

export interface ChainOrder {
  orderId: string;
  kind: string;
  status: string;
  amountMicro: bigint;
  refundedMicro: bigint;
  payer: string;
  paidDay: string;
  paidTx: string;
  explorer: string;
}

// RFC 4180: quoted fields with doubled quotes, CRLF or LF rows.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const micro = (usdt: string): bigint => {
  const [whole = '0', frac = ''] = usdt.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0').slice(0, 6));
};

export function chainOrdersFrom(csv: string): ChainOrder[] {
  const [head, ...rows] = parseCsv(csv);
  const col = (r: string[], name: string) => r[(head ?? []).indexOf(name)] ?? '';
  return rows.map((r) => ({
    orderId: col(r, 'order_id'),
    kind: col(r, 'kind'),
    status: col(r, 'status'),
    amountMicro: micro(col(r, 'amount_usdt')),
    refundedMicro: micro(col(r, 'refunded_usdt')),
    payer: col(r, 'payer'),
    paidDay: col(r, 'paid_day_utc'),
    paidTx: col(r, 'paid_tx'),
    explorer: col(r, 'explorer'),
  }));
}

