// pause the payer agent (WEBSITE_SPEC.md §3, §7): the owner wallet sets graphpay.status
// to paused on the agent's ENS name (Ethereum Sepolia). The passcode is checked first; the
// agent is the story's payer agent, never a name from the request.
import { json, notLive } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { Busy, EFFECTIVE_WITHIN_S, OWNER_WAITING_FOR, changeStatus, failureKind, ownerConfigured } from '../../../../lib/owner-actions.server.ts';

export const dynamic = 'force-dynamic';
// A change waits for its Sepolia receipt (up to 180 s) and for the new state to be visible.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!ownerConfigured()) return notLive(OWNER_WAITING_FOR);
  try {
    const change = await changeStatus(true);
    return json({ ...change, effectiveWithinS: EFFECTIVE_WITHIN_S });
  } catch (error) {
    if (error instanceof Busy) return json({ error: 'another status change is still running; wait for it' }, 429);
    // The kind only: a chain error's message can name an RPC. None reaches the browser.
    console.error('customer pause failed:', failureKind(error));
    // The transaction may have landed even when the wait failed: the status chip is the truth.
    return json({ error: 'the status could not be confirmed; check the status, then try again if it did not change' }, 502);
  }
}
