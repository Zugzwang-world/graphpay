// Response helpers for the website's routes. Spending routes are never cached
// (planning/SPEC/SECURITY_AND_OPS.md §6); errors carry no internals.

import type { NotLive } from './contracts.ts';

export const NO_STORE = { 'cache-control': 'no-store' } as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

// A route whose source (another track's milestone) has not landed answers this
// rather than inventing data: the shipped site has no fake path.
export function notLive(waitingFor: string): Response {
  const body: NotLive = { error: 'not live yet', waitingFor };
  return json(body, 503);
}

export function badRequest(error: string): Response {
  return json({ error }, 400);
}

// Reads a JSON object body of at most `limit` bytes; null when it is not one.
export async function readJsonObject(request: Request, limit = 4096): Promise<Record<string, unknown> | null> {
  // Refuse by the declared length before reading; the read is checked again below.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > limit) return null;
  const text = await request.text();
  if (text.length > limit) return null;
  try {
    const value: unknown = JSON.parse(text === '' ? '{}' : text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
