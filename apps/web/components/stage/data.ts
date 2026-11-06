'use client';

// The stage's own reads, each made once when it is needed: the three shops' receipts and
// scoreboards (one GraphQL request), an explain trace (fetched at once: ids live in one server
// instance only), a package's version on npm, the Swarm links the phones' build read, and the race.

import { useEffect, useState } from 'react';

export interface ReceiptEdge {
  kind: string;
  from: { ens: string; key: string | null; tally?: { orders: string; refunds: string } | null };
  to: { ens: string; key: string | null; tally?: { orders: string; refunds: string } | null };
  amountMicro: string;
  ref: string;
  orderId: string | null;
  synthetic: boolean;
  ts: string;
}

export interface ShopNode {
  ens: string;
  key: string | null;
  recent: ReceiptEdge[];
  refunds: ReceiptEdge[];
}

export interface Receipts {
  shops: ShopNode[];
  payer: { ens: string; key: string | null; tally: { orders: string; refunds: string; paidMicro: string } | null } | null;
  calls: number | null;
  bytes: number | null;
  explainId: string | null;
  at: number;
}

// Light on purpose (one request, about a dozen Arkiv reads): each shop's newest payments and two
// refunds, and the payer's own scoreboard. The shops' scoreboards come from the errand's own read.
const EDGE = 'kind from { ens key } to { ens key } amountMicro ref orderId synthetic ts';
const SHOP = `ens key recent: in(kind: "pay", sinceDay: $since, limit: 6) { ${EDGE} } refunds: out(kind: "refund", limit: 2) { ${EDGE} }`;

export function receiptsQuery(count: number): string {
  const vars = Array.from({ length: count }, (_, i) => `$s${i}: String!`).join(', ');
  const fields = Array.from({ length: count }, (_, i) => `s${i}: node(ens: $s${i}) { ${SHOP} }`).join(' ');
  return `query Receipts(${vars}, $since: Int, $payer: String!) { ${fields} payer: node(ens: $payer) { ens key tally(window: "all") { orders refunds paidMicro } } }`;
}

export function useReceipts(shops: string[], payer: string, key: string | null): Receipts | null {
  const [data, setData] = useState<Receipts | null>(null);
  const list = shops.join(',');
  useEffect(() => {
    let live = true;
    const names = list.split(',').filter(Boolean);
    const variables: Record<string, unknown> = Object.fromEntries(names.map((n, i) => [`s${i}`, n]));
    variables.since = Math.floor(Date.now() / 86_400_000) - 1;
    variables.payer = payer;
    const params = new URLSearchParams({ query: receiptsQuery(names.length), variables: JSON.stringify(variables) });
    fetch(`/api/graphql?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { data?: Record<string, unknown>; extensions?: { arkiv?: { calls?: number; bytes?: number; explainId?: string } } } | null) => {
        if (!live || !body?.data) return;
        const nodes = names.map((_, i) => body.data?.[`s${i}`] as ShopNode | null).filter((n): n is ShopNode => Boolean(n));
        const a = body.extensions?.arkiv;
        setData({ shops: nodes, payer: (body.data.payer as Receipts['payer']) ?? null, calls: typeof a?.calls === 'number' ? a.calls : null, bytes: typeof a?.bytes === 'number' ? a.bytes : null, explainId: typeof a?.explainId === 'string' ? a.explainId : null, at: Date.now() });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [list, payer, key]);
  return data;
}

export interface Explain {
  explainId: string;
  calls: number;
  bytes: number;
  queries: string[];
  entityKeys: string[];
}

export function useExplain(id: string | null): Explain | null {
  const [data, setData] = useState<Explain | null>(null);
  useEffect(() => {
    if (!id || !/^[0-9a-f]{12}$/.test(id)) return;
    let live = true;
    fetch(`/api/explain/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Explain | null) => live && j && setData(j))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id]);
  return data;
}

export function useNpmVersion(name: string | null): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!name) return;
    let live = true;
    fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { version?: unknown } | null) => live && typeof j?.version === 'string' && setVersion(j.version))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [name]);
  return version;
}

export interface SwarmLinks {
  menus: Record<string, string>;
  storefronts: Record<string, string>;
  dishes: Record<string, string>;
}

export function useSwarmLinks(): SwarmLinks | null {
  const [data, setData] = useState<SwarmLinks | null>(null);
  useEffect(() => {
    fetch('/phones/swarm.json', { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SwarmLinks | null) => setData(j))
      .catch(() => undefined);
  }, []);
  return data;
}

// One side of the live race (GET /api/race): the counted reads, from the `call` frames that carry
// `ms` (the first one, without it, is not a counted read), then the answer.
export interface RaceSide {
  reads: number;
  bytes: number;
  calls: number | null;
  correct: boolean | null;
  done: boolean;
  error: string | null;
}

export function useRace(mode: 'plain' | 'graph', run: number): RaceSide {
  const [side, setSide] = useState<RaceSide>({ reads: 0, bytes: 0, calls: null, correct: null, done: false, error: null });
  useEffect(() => {
    if (run === 0) return;
    setSide({ reads: 0, bytes: 0, calls: null, correct: null, done: false, error: null });
    const source = new EventSource(`/api/race?question=Q2&mode=${mode}&size=S`);
    source.addEventListener('call', (msg) => {
      try {
        const c = JSON.parse((msg as MessageEvent<string>).data) as { ms?: unknown; bytes?: unknown };
        if (typeof c.ms !== 'number') return;
        setSide((s) => ({ ...s, reads: s.reads + 1, bytes: s.bytes + (typeof c.bytes === 'number' ? c.bytes : 0) }));
      } catch {
        // skipped
      }
    });
    source.addEventListener('answer', (msg) => {
      try {
        const a = JSON.parse((msg as MessageEvent<string>).data) as { calls?: unknown; bytes?: unknown; correct?: unknown };
        setSide((s) => ({ ...s, calls: typeof a.calls === 'number' ? a.calls : s.reads, bytes: typeof a.bytes === 'number' ? a.bytes : s.bytes, correct: a.correct === true, done: true }));
      } catch {
        // skipped
      }
      source.close();
    });
    source.addEventListener('error', () => {
      setSide((s) => (s.done ? s : { ...s, error: 'The race did not answer. It runs again when this scene opens.' }));
      source.close();
    });
    return () => source.close();
  }, [mode, run]);
  return side;
}
