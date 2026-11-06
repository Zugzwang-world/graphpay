// The owner changes the payer agent's daily cap (the W3 brief, item 4b): the owner's wallet writes the
// ENS record on Sepolia, the policy writer on the Mac applies it to the spending policy (never above the
// payments setup's cap: ADR-0021), and the change is recorded on Arkiv (lib/owner-cap.server.ts). The
// body names the new cap in micro-USDT; the agent is always the story's payer agent.
import { errorNames } from '@graphpay/facilitator';
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { failureKind } from '../../../../lib/owner-actions.server.ts';
import { ownerCapKeysConfigured, liveOwnerCapDeps } from '../../../../lib/owner-cap-live.server.ts';
import { OWNER_CAP_WAITING_FOR, OwnerCapRefusal, setOwnerCap } from '../../../../lib/owner-cap.server.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';

export const dynamic = 'force-dynamic';
// The Sepolia receipt (up to 180 s), the policy writer (up to 90 s, inside a 260 s budget) and the Arkiv write.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!ownerCapKeysConfigured()) return notLive(OWNER_CAP_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'a JSON object is expected' }, 400);
  try {
    return json(await setOwnerCap({ capMicro: body.capMicro }, liveOwnerCapDeps()));
  } catch (error) {
    if (error instanceof OwnerCapRefusal) return json({ error: error.code }, error.status);
    console.error('customer cap change failed:', failureKind(error), errorNames(error));
    return json({ error: 'the cap change could not be confirmed; check the cap, then try again if it did not change' }, 502);
  }
}
