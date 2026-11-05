// The replay tool's hold on raw sends (D2): a fetch wrapper that passes every JSON-RPC
// request carrying `eth_sendRawTransaction` through a hook. It sits at the transport,
// because viem's `extend` copies the client and the SDK sends through an earlier copy, so
// a patched `walletClient.request` never sees the send.

import { keccak256, parseTransaction } from 'viem';

function rawOf(body) {
  try {
    const msg = JSON.parse(body);
    const call = (Array.isArray(msg) ? msg : [msg]).find((m) => m?.method === 'eth_sendRawTransaction');
    return call?.params?.[0] ?? null;
  } catch {
    return null;
  }
}

// hook({ send, raw, hash, nonce }) → a Response; `send()` forwards the request.
export function withRawSendHook(fetchFn, hook) {
  return async (input, init) => {
    const body = typeof init?.body === 'string' ? init.body : null;
    const raw = body && body.includes('eth_sendRawTransaction') ? rawOf(body) : null;
    if (!raw) return fetchFn(input, init);
    let nonce = null;
    try {
      nonce = parseTransaction(raw).nonce ?? null;
    } catch {
      // not a transaction viem can parse: still held by the hook
    }
    return hook({ send: () => fetchFn(input, init), raw, hash: keccak256(raw), nonce });
  };
}
