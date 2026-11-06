// The customer phone's state (WEBSITE_SPEC.md §7): the payer agent's status (ENS on
// Sepolia and the AgentPolicy), cap and spend today (the checkout contract), and its last
// order (the money graph). Public reads; nothing here signs.
import { allowed } from '../../graphql/arkiv.server.ts';
import { json } from '../../../../lib/http.ts';
import { sharedCustomerState } from '../../../../lib/customer-state.server.ts';

// Requests a minute per client on this instance. A whole venue can sit behind one IP (ADR-0069), so this is a
// ceiling against a runaway client, not a limit a crowd reaches; each read is shared and cached behind it.
const READ_LIMIT = 400;

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  if (!allowed(request, READ_LIMIT)) return json({ error: 'too many requests' }, 429);
  try {
    return json(await sharedCustomerState());
  } catch {
    // One source did not answer: say so, never a guess (the phone shows its status as unknown).
    return json({ error: 'a source did not answer; try again in a moment' }, 502);
  }
}
