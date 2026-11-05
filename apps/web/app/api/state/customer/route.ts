import { notLive } from '../../../../lib/http.ts';
import { waitingFor } from '../../../../lib/routes.ts';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return notLive(waitingFor('/api/state/customer'));
}
