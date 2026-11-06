// The agent tries to raise its own cap (planning/ACCEPTANCE_TESTS.md B3): as the payer agent's own key,
// the setText of its `graphpay.cap_micro` record is simulated on Ethereum Sepolia and the resolver
// refuses it (only the owner may write it). Nothing is sent; the attempt and its revert reason are
// recorded on Arkiv (lib/limits.server.ts). The body may name the cap it asks for (micro-USDT).
import { errorNames } from '@graphpay/facilitator';
import { KEYS } from '@graphpay/ens';
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { limitsKeysConfigured, liveRaiseCapDeps } from '../../../../lib/limits-live.server.ts';
import { LIMITS_WAITING_FOR, LimitRefusal, raiseOwnCap } from '../../../../lib/limits.server.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';

export const dynamic = 'force-dynamic';
// The ENS reads, one simulation and the Arkiv write.
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!limitsKeysConfigured()) return notLive(LIMITS_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'a JSON object is expected' }, 400);
  try {
    return json(await raiseOwnCap({ capMicro: body.capMicro }, liveRaiseCapDeps(), KEYS.capMicro));
  } catch (error) {
    if (error instanceof LimitRefusal) return json({ error: error.code }, error.status);
    console.error('customer raise-cap failed:', errorNames(error));
    return json({ error: 'the attempt could not be checked; nothing was sent' }, 502);
  }
}
