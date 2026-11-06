// Kill a disposable agent (WEBSITE_SPEC.md §3, §7; lib/kill-disposable.server.ts): the owner unregisters
// the spare's ENS name on Sepolia, the watcher revokes its spending pass, and its next payment is refused
// and recorded on Arkiv. The spare is chosen from chain state, never from the request. GET says which
// spare a kill would take now (the phones show the button only when there is one) and which spare
// numbers this server holds keys for (the workers' spare keeper provisions only those).
import { json, notLive } from '../../../../lib/http.ts';
import { Busy, NotReady, currentSpare, killConfigured, killFailureKind, killSpare, spareNumbers } from '../../../../lib/kill-disposable.server.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { waitingFor } from '../../../../lib/routes.ts';

export const dynamic = 'force-dynamic';
// The kill waits for its Sepolia receipt, the watcher's revocation (up to 75 s) and the refused payment.
export const maxDuration = 300;

const PATH = '/api/customer/kill-disposable';

export async function GET(): Promise<Response> {
  const pool = spareNumbers();
  if (!killConfigured()) return json({ spare: null, live: false, pool });
  try {
    const spare = await currentSpare();
    return json({ spare: spare ? { label: spare.name.slice(0, spare.name.indexOf('.')), name: spare.name, epoch: spare.epoch } : null, live: true, pool });
  } catch (error) {
    console.error('kill-disposable spare read failed:', killFailureKind(error));
    return json({ spare: null, live: true, pool, error: 'the spare could not be read; try again' }, 502);
  }
}

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!killConfigured()) return notLive(waitingFor(PATH));
  try {
    return json(await killSpare());
  } catch (error) {
    if (error instanceof Busy) return json({ error: error.message }, 409);
    if (error instanceof NotReady) return json({ error: error.message }, 503);
    // The kind only: a chain error's message can name an RPC. None reaches the browser.
    console.error('kill-disposable failed:', killFailureKind(error));
    // The unregister may have landed even when a later step failed: GET and the explorer are the truth.
    return json({ error: 'the kill could not be confirmed; check the spare (GET), then try again if it is still live' }, 502);
  }
}
