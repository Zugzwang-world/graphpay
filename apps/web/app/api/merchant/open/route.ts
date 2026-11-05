// The Open toggle (WEBSITE_SPEC.md §4, Friday item 9): { on: true } lists the shop as
// open on Arkiv and is sent again every 5 minutes while the shop stays open; { on: false }
// takes it off the list at once. The passcode is checked first; the write is W_DIRECTORY's.
import { badRequest, json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { siteModel } from '../../../../lib/site.server.ts';
import { OPEN_WAITING_FOR, RENEW_EVERY_S, directoryConfigured, directoryConnection, setShopOpen, shopKeyOf } from '../../../../lib/open-toggle.server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!directoryConfigured()) return notLive(OPEN_WAITING_FOR);
  const body = await readJsonObject(request);
  if (typeof body?.on !== 'boolean') return badRequest('on must be true or false');
  const shopEns = siteModel().merchant.ens;
  try {
    const state = await setShopOpen({ arkiv: await directoryConnection(), shopKey: await shopKeyOf(shopEns), shopEns, on: body.on });
    return json({ ...state, renewEveryS: RENEW_EVERY_S });
  } catch (error) {
    // The class only: a write error's message can carry an RPC URL. None reaches the browser.
    console.error('merchant open toggle failed:', error instanceof Error ? error.name : 'error');
    return json({ error: 'the shop list could not be updated; try again' }, 502);
  }
}
