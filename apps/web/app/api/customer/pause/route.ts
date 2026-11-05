// pause the payer agent (WEBSITE_SPEC.md §3, §7): the owner wallet sets graphpay.status
// to paused on the agent's ENS name (Ethereum Sepolia). The passcode is checked first; the
// agent is the story's payer agent, never a name from the request.
import { json, notLive } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { EFFECTIVE_WITHIN_S, OWNER_WAITING_FOR, changeStatus, ownerConfigured } from '../../../../lib/owner-actions.server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!ownerConfigured()) return notLive(OWNER_WAITING_FOR);
  try {
    const change = await changeStatus(true);
    return json({ ...change, effectiveWithinS: EFFECTIVE_WITHIN_S });
  } catch (error) {
    // The class only: a chain error can name an RPC. None reaches the browser.
    console.error('customer pause failed:', error instanceof Error ? error.name : 'error');
    return json({ error: 'the status could not be changed; try again' }, 502);
  }
}
