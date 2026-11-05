import { notLive } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { waitingFor } from '../../../../lib/routes.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  return notLive(waitingFor('/api/customer/kill-disposable'));
}
