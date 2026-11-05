// Runs one side of the race live against Arkiv: a new connection and engine each time
// (uncached), every Arkiv call reported as it lands, then the answer with its reads and
// bytes. The truth for the "correct" badge comes from the same generated city that was
// seeded (@graphpay/city; pure, no network).
import { callTap, connectArkiv, raceQuestion, type ArkivConnection } from '@graphpay/money-graph';
import { benchParams, benchTruth, generateCity, truthOf } from '@graphpay/city';
import { story } from '@graphpay/config';
import type { RaceAnswer, RaceCall } from './contracts.ts';
import type { RaceQuery } from './race.ts';

// The seeded S city's end day: `--end` of the live benchmark run (bench/BENCHMARK-LIVE.md,
// docs/sessions/arkiv/README.md). The generator is deterministic from it.
export const SEEDED_END = '2026-11-05';

let city: { city: unknown; truth: unknown } | null = null;
function truthFor(todayDay?: number) {
  city ??= (() => {
    const c = generateCity({ story, size: 'S', end: SEEDED_END });
    return { city: c, truth: truthOf(c) };
  })();
  const params = benchParams(city.city, todayDay === undefined ? undefined : { today: todayDay });
  return { params, truth: benchTruth(city.city, city.truth, params) };
}

export type RaceFrame = { event: 'call'; data: RaceCall } | { event: 'answer'; data: RaceAnswer };

// `connect` opens the race's own connection with the tap as its logger.
export async function runRace(
  query: RaceQuery,
  send: (frame: RaceFrame) => void,
  { connect, writers, todayDay }: { connect?: (log: (entry: Record<string, unknown>) => void) => Promise<ArkivConnection>; writers?: Record<string, `0x${string}`>; todayDay?: number } = {},
): Promise<void> {
  const tap = callTap();
  const arkiv = await (connect ?? ((log) => connectArkiv({ backend: (process.env.ARKIV_BACKEND as 'sim' | 'local' | 'rabdi' | undefined) ?? 'rabdi', env: process.env, log })))(tap.log);
  const { params, truth } = truthFor(todayDay);
  const result = await raceQuestion(arkiv, {
    question: query.question,
    mode: query.mode,
    inFlight: query.inFlight,
    params,
    truth,
    size: 'S',
    tap,
    writers,
    onCall: (c) => send({ event: 'call', data: { call: c.call, ms: c.ms, bytes: c.bytes } }),
  });
  send({
    event: 'answer',
    data: { answer: result.answer, correct: result.correct === true, truthBasis: result.truthBasis === 'name' ? 'name' : 'identity', calls: result.calls, bytes: result.bytes },
  });
}
