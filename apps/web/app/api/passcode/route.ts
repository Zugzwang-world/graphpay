import { requirePasscode } from '../../../lib/passcode.ts';

export const dynamic = 'force-dynamic';

// Lets the lock chip tell a typed passcode is right before any spending button
// is pressed. It signs nothing and answers nothing but 204, 401 or 503.
export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
