// The one way to reach an Arkiv node: viem's HTTP transport with no retries and a
// 15 s timeout (a quota error otherwise retries for its whole Retry-After), a fetch
// layer that meters calls and bytes and reads the `ratelimit` header (waiting for
// `reset` when under 10% remains), and redaction: an access key travels in the RPC
// URL and viem puts URLs in its errors, so every error leaves here with every
// secret replaced while keeping its JSON-RPC code, data and HTTP status.

import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { defineChain, http } from 'viem';

export function newStats() {
  return { calls: 0, requestBytes: 0, responseBytes: 0, status: {}, lowestRemaining: null, limit: null, waits: 0, byMethod: {} };
}

// "limit=5000, remaining=4990, reset=10" → { limit, remaining, reset }
export function parseRateLimit(header) {
  if (typeof header !== 'string') return null;
  const out = {};
  for (const part of header.split(',')) {
    const [k, v] = part.split('=').map((x) => x.trim());
    if (k && v && /^\d+$/.test(v)) out[k] = Number(v);
  }
  return Number.isInteger(out.limit) && Number.isInteger(out.remaining) ? out : null;
}

const REDACTED = '<redacted>';
const STRING_FIELDS = ['message', 'shortMessage', 'details', 'url', 'stack', 'docsPath'];

// Replaces every secret in an error and its cause chain, in place, and returns it.
export function redactError(error, secrets) {
  const list = [...new Set((secrets ?? []).filter((s) => typeof s === 'string' && s.length >= 6))].sort((a, b) => b.length - a.length);
  if (list.length === 0) return error;
  const clean = (text) => {
    let out = String(text);
    for (const s of list) out = out.split(s).join(REDACTED).split(encodeURIComponent(s)).join(REDACTED);
    return out;
  };
  const seen = new Set();
  for (let e = error, depth = 0; e && typeof e === 'object' && depth < 12 && !seen.has(e); e = e.cause, depth += 1) {
    seen.add(e);
    for (const field of STRING_FIELDS) {
      try {
        if (typeof e[field] === 'string') e[field] = clean(e[field]);
      } catch {
        // a getter-only field: leave it
      }
    }
    if (Array.isArray(e.metaMessages)) e.metaMessages = e.metaMessages.map(clean);
  }
  return error;
}

// Walks an error's cause chain for an HTTP 413 (the node's 256 KiB request limit).
export function isRequestTooLarge(error) {
  for (let e = error, depth = 0; e && depth < 12; e = e.cause, depth += 1) {
    if (e.status === 413) return true;
    const text = `${e.details ?? ''} ${e.shortMessage ?? ''}`;
    if (/request body too large|payload too large|\b413\b/i.test(text)) return true;
  }
  return false;
}

// A viem transport to one Arkiv URL. `fetchFn` swaps the network (ArkivSim's fetch);
// `secrets` are redacted from errors; `stats` collects calls, bytes, statuses and the
// lowest `ratelimit` remaining; `log` gets { method, status, ms, ratelimit } per call,
// never the URL.
export function arkivTransport({ url, fetchFn = globalThis.fetch, secrets = [], timeout = 15_000, stats = newStats(), log = null, lowWater = 0.1, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  if (typeof url !== 'string' || url === '') throw new Error('arkiv-graph: an RPC URL is required');
  let waitUntil = 0;
  const metered = async (input, init = {}) => {
    const now = Date.now();
    if (waitUntil > now) {
      stats.waits += 1;
      await sleep(waitUntil - now);
    }
    const body = typeof init.body === 'string' ? init.body : '';
    const method = /"method":"([^"]+)"/.exec(body)?.[1] ?? 'batch';
    const started = Date.now();
    stats.calls += 1;
    stats.byMethod[method] = (stats.byMethod[method] ?? 0) + 1;
    stats.requestBytes += Buffer.byteLength(body);
    const response = await fetchFn(input, init);
    stats.status[response.status] = (stats.status[response.status] ?? 0) + 1;
    const rl = parseRateLimit(response.headers.get('ratelimit'));
    if (rl) {
      stats.limit = rl.limit;
      if (stats.lowestRemaining === null || rl.remaining < stats.lowestRemaining) stats.lowestRemaining = rl.remaining;
      if (rl.remaining < rl.limit * lowWater && Number.isInteger(rl.reset)) waitUntil = Date.now() + rl.reset * 1000;
    }
    try {
      stats.responseBytes += Buffer.byteLength(await response.clone().text());
    } catch {
      // the body could not be read twice; the count stays as it is
    }
    log?.({ method, status: response.status, ms: Date.now() - started, ratelimit: rl });
    return response;
  };
  const inner = http(url, { fetchFn: metered, retryCount: 0, timeout });
  const transport = (config) => {
    const t = inner(config);
    return {
      ...t,
      async request(args) {
        try {
          return await t.request(args);
        } catch (error) {
          throw redactError(error, [...secrets, url]);
        }
      },
    };
  };
  transport.stats = stats;
  return transport;
}

// A chain object for a network id, with no RPC URLs in it (URLs, which may carry an
// access key, stay in the transport).
export function arkivChain({ id, name = `Arkiv ${id}`, symbol = 'GLM' }) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('arkiv-graph: a chain id is required');
  return defineChain({ id, name, nativeCurrency: { name: symbol, symbol, decimals: 18 }, rpcUrls: { default: { http: [] } } });
}

// Public and wallet clients from the stock SDK over one transport.
export function arkivClients({ transport, chain, account = null, pollingInterval = 1_000 }) {
  const publicClient = createPublicClient({ chain, transport, pollingInterval });
  const walletClient = account ? createWalletClient({ chain, transport, account, pollingInterval }) : null;
  return { publicClient, walletClient, chain, stats: transport.stats };
}

// Refuses a node that answers another chain id (call before anything is signed).
export async function assertChain(publicClient, expected) {
  const id = await publicClient.getChainId();
  if (id !== expected) throw new Error(`arkiv-graph: refused, the node reports chain ${id}, not ${expected}`);
  return id;
}
