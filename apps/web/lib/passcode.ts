// The demo passcode guard (WEBSITE_SPEC.md §1 rule 3, §7; acceptance F2). Every
// route that makes the relayer, a merchant or an owner sign calls this first and
// sends nothing unless it passes. The passcode travels only in the
// X-Demo-Passcode header, never in a URL; it is compared in constant time.

import { createHash, timingSafeEqual } from 'node:crypto';
import { PASSCODE_HEADER } from './passcode-header.ts';

export { PASSCODE_HEADER };
export const MIN_PASSCODE_LENGTH = 24;
const MAX_PASSCODE_LENGTH = 512;

type Env = Record<string, string | undefined>;

export type PasscodeCheck = { ok: true } | { ok: false; status: 401 | 503; error: string };

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export function checkPasscode(request: Request, env: Env = process.env): PasscodeCheck {
  const given = request.headers.get(PASSCODE_HEADER) ?? '';
  if (given === '') return { ok: false, status: 401, error: 'passcode required' };
  const expected = env.DEMO_PASSCODE ?? '';
  // No passcode configured means spending is off, never open.
  if (expected.length < MIN_PASSCODE_LENGTH) return { ok: false, status: 503, error: 'spending is off: no passcode is configured' };
  if (given.length > MAX_PASSCODE_LENGTH) return { ok: false, status: 401, error: 'wrong passcode' };
  // Equal-length digests, so the comparison takes the same time for any input.
  if (!timingSafeEqual(digest(given), digest(expected))) return { ok: false, status: 401, error: 'wrong passcode' };
  return { ok: true };
}

// null when the request may go on; otherwise the refusal to return as is.
export function requirePasscode(request: Request, env: Env = process.env): Response | null {
  const check = checkPasscode(request, env);
  if (check.ok) return null;
  return Response.json({ error: check.error }, { status: check.status, headers: { 'cache-control': 'no-store' } });
}
