// The demo passcode guard for the merchant's signing routes (dispatch, refund): the same
// X-Demo-Passcode the payment route uses, compared in constant time, fail closed.
import { createHash, timingSafeEqual } from 'node:crypto';

export function requirePasscode(request: Request, expected = process.env.DEMO_PASSCODE ?? ''): Response | null {
  const given = request.headers.get('x-demo-passcode') ?? '';
  const headers = { 'cache-control': 'no-store' };
  if (expected.length < 24) return Response.json({ error: 'signing is off: no passcode is configured' }, { status: 503, headers });
  const digest = (v: string) => createHash('sha256').update(v, 'utf8').digest();
  if (given === '' || given.length > 512 || !timingSafeEqual(digest(given), digest(expected))) return Response.json({ error: 'passcode required' }, { status: 401, headers });
  return null;
}

// The shop's key sends one transaction at a time on this instance (one nonce), so two clicks
// never race each other into a confusing second send.
let tail: Promise<unknown> = Promise.resolve();
export function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}

// An agentpay error carries a short code (NOT_REFUNDABLE, OVER_REFUNDABLE, ...): a refusal the
// merchant can act on is 409; no code means the chain or the network failed (502). Only the code
// is returned and logged, never a message (a chain error's message can carry an RPC URL).
export function failure(error: unknown, fallbackText: string): Response {
  const raw = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  const code = typeof raw === 'string' ? raw : null;
  console.error('store signing failed:', code ?? (error instanceof Error ? error.name : 'error'));
  return Response.json({ error: code ?? fallbackText }, { status: code ? 409 : 502, headers: { 'cache-control': 'no-store' } });
}
