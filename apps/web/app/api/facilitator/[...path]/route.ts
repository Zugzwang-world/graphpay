// Our x402 facilitator on the production domain: /api/facilitator/{verify,settle} (bearer
// FACILITATOR_AUTH_TOKEN), /supported and /health (open). M4, planning/SPEC/PAYMENTS_WHITECHAIN.md §8.
import { facilitator, route } from '../../../../lib/payments.server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handle = route('facilitator', facilitator);
export const GET = handle;
export const POST = handle;
