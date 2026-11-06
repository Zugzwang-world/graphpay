// Runs one side of the race live against Arkiv: a new connection and engine each time
// (uncached), every Arkiv call reported as it lands, then the answer with its reads and
// bytes. The truth for the "correct" badge comes from the same generated city that was
// seeded (@graphpay/city; pure, no network), at the end date the story records for it.
import { callTap, connectArkiv, raceQuestion, type ArkivConnection } from '@graphpay/money-graph';
import { benchParams, benchTruth, generateCity, truthOf } from '@graphpay/city';
import { story } from '@graphpay/config';
import type { RaceAnswer, RaceCall } from './contracts.ts';
import type { RaceQuery } from './race.ts';

interface CitySizes {
  raceSize?: string;
  sizes: Record<string, { end?: string }>;
}
const city = story.syntheticCity as CitySizes;

// The seeded cities: each size whose end date the story records (`syntheticCity.sizes[size].end`,
// the `--end` it was seeded with; ADR-0077). The generator is deterministic from it.
export const SEEDED_SIZES: readonly string[] = Object.keys(city.sizes).filter((s) => typeof city.sizes[s]?.end === 'string');
// The city race mode shows (`syntheticCity.raceSize`), when it is seeded.
export const RACE_SIZE: string = city.raceSize && SEEDED_SIZES.includes(city.raceSize) ? city.raceSize : 'S';
export const SEEDED_END = city.sizes.S?.end ?? '2026-11-05';

const cities = new Map<string, { city: unknown; truth: unknown }>();
export function seededCity(size: string): { city: { shops: unknown[]; dataset: string; byRole: Record<string, string>; personaAgents: Record<string, string> }; truth: { q2: { payRows: number } } } {
  if (!cities.has(size)) {
    const end = city.sizes[size]?.end;
    if (!end) throw new Error(`race: size ${size} is not seeded`);
    const c = generateCity({ story, size: size as 'S' | 'M', end });
    cities.set(size, { city: c, truth: truthOf(c) });
  }
  return cities.get(size) as ReturnType<typeof seededCity>;
}

// A plain race reads every payment and renewal row: about 50 pages at size M. Arkiv's keyless
// query window (docs/technical/FACTS.md: about 10,000, shared by everything this server reads,
// the live errands included) cannot carry many of those, so on a city with more than
// PLAIN_RACE_ROWS rows a plain race starts at most once per PLAIN_RACE_GAP_MS on this instance; one
// asked for sooner is refused (the route answers 429) instead of run.
export const PLAIN_RACE_ROWS = 1_000;
export const PLAIN_RACE_GAP_MS = 10 * 60_000;
let lastBigPlainRace = 0;
export function plainRaceRefusal(query: Pick<RaceQuery, 'mode' | 'size'>, now = Date.now()): string | null {
  if (query.mode !== 'plain') return null;
  const rows = seededCity(query.size).truth.q2.payRows;
  if (rows <= PLAIN_RACE_ROWS) return null;
  const wait = lastBigPlainRace + PLAIN_RACE_GAP_MS - now;
  if (wait > 0) return `a plain race at size ${query.size} reads all ${rows} payment rows, so it runs once every ${PLAIN_RACE_GAP_MS / 60_000} minutes; the next can start in ${Math.ceil(wait / 1000)} s`;
  lastBigPlainRace = now;
  return null;
}

function truthFor(size: string, todayDay?: number) {
  const seeded = seededCity(size);
  const params = benchParams(seeded.city, todayDay === undefined ? undefined : { today: todayDay });
  return { params, truth: benchTruth(seeded.city, seeded.truth, params) };
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
  const { params, truth } = truthFor(query.size, todayDay);
  const result = await raceQuestion(arkiv, {
    question: query.question,
    mode: query.mode,
    inFlight: query.inFlight,
    params,
    truth,
    size: query.size,
    tap,
    writers,
    onCall: (c) => send({ event: 'call', data: { call: c.call, ms: c.ms, bytes: c.bytes } }),
  });
  send({
    event: 'answer',
    data: { answer: result.answer, correct: result.correct === true, truthBasis: result.truthBasis === 'name' ? 'name' : 'identity', calls: result.calls, bytes: result.bytes },
  });
}
