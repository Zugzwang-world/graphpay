// resume a buyer agent (WEBSITE_SPEC.md §3, §7): the owner wallet sets graphpay.status to
// active on the agent's ENS name (Ethereum Sepolia). The passcode is checked first. The agent
// is the tapped card's ({ agent: <ENS name> }; none named is the payer), and only one with a
// spending pass: the others are refused in words.
import { badRequest, json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { Busy, EFFECTIVE_WITHIN_S, OWNER_WAITING_FOR, changeStatus, failureKind, ownerConfigured, pickAgent } from '../../../../lib/owner-actions.server.ts';

export const dynamic = 'force-dynamic';
// A change waits for its Sepolia receipt (up to 180 s) and for the new state to be visible.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  const body = await readJsonObject(request);
  if (!body) return badRequest('the body must be a JSON object, { agent } or empty');
  const pick = pickAgent(body.agent);
  if (!pick.ok) return json({ error: pick.error, reason: pick.reason }, pick.status);
  if (!ownerConfigured(process.env, pick.agent.ens)) return notLive(OWNER_WAITING_FOR);
  try {
    const change = await changeStatus(false, { agent: pick.agent.ens });
    return json({ ...change, agent: pick.agent.ens, effectiveWithinS: EFFECTIVE_WITHIN_S });
  } catch (error) {
    if (error instanceof Busy) return json({ error: 'another status change is still running; wait for it' }, 429);
    // The kind only: a chain error's message can name an RPC. None reaches the browser.
    console.error('customer resume failed:', failureKind(error));
    // The transaction may have landed even when the wait failed: the status chip is the truth.
    return json({ error: 'the status could not be confirmed; check the status, then try again if it did not change' }, 502);
  }
}
