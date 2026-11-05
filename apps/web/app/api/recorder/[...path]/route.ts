// The recorder on the production domain: POST /api/recorder/attempts (bearer RECORDER_TOKEN)
// writes one readonly `fail` edge on Arkiv as W_SYNC. M4, SPEC/INTEGRATION_AND_MIRROR.md §2.
import { recorder, route } from '../../../../lib/payments.server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handle = route('recorder', recorder);
export const GET = handle;
export const POST = handle;
