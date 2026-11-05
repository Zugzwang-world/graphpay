// Race mode's pure parts (WEBSITE_SPEC.md §6, §7; ADR-0042): the query a race route
// accepts, a lock that keeps one race per side running, and the committed benchmark
// table (reads and bytes, never times).

export type RaceMode = 'graph' | 'plain';
export type InFlight = 1 | 4 | 8 | 16 | 'all';

export interface RaceQuery {
  question: string;
  mode: RaceMode;
  inFlight: InFlight;
}

const IN_FLIGHT: Record<string, InFlight> = { '1': 1, '4': 4, '8': 8, '16': 16, all: 'all' };

// Only the small city is seeded; the larger one waits for the founder's final story
// (ADR-0049), so any other size is refused rather than read.
export function parseRaceQuery(params: URLSearchParams, allowed: readonly string[]): RaceQuery | { error: string } {
  const question = params.get('question') ?? '';
  if (!allowed.includes(question)) return { error: `question is one of ${allowed.join(', ')}` };
  const mode = params.get('mode');
  if (mode !== 'graph' && mode !== 'plain') return { error: 'mode is graph or plain' };
  const size = params.get('size') ?? 'S';
  if (size !== 'S') return { error: 'only the size S city is seeded' };
  const inFlight = IN_FLIGHT[params.get('inFlight') ?? '1'];
  if (inFlight === undefined) return { error: 'inFlight is 1, 4, 8, 16 or all' };
  return { question, mode, inFlight: mode === 'plain' ? inFlight : 1 };
}

// At most one race per side at a time on this server instance: a race is a burst of
// reads against Arkiv's shared testnet endpoint.
export function createRaceLock() {
  const busy = new Set<RaceMode>();
  return {
    take(mode: RaceMode): (() => void) | null {
      if (busy.has(mode)) return null;
      busy.add(mode);
      return () => busy.delete(mode);
    },
  };
}

export interface BenchRow {
  question: string;
  plainReads: number;
  plainBytes: number;
  graphReads: number;
  graphBytes: number;
  plainRightByName: boolean;
  plainRightByIdentity: boolean;
  graphRight: boolean;
}

// bench/results/questions-S.csv: a comment line, a header, then one row per question and
// mode. The table keeps reads, bytes and the three correctness columns; times stay in the CSV.
export function parseBenchCsv(csv: string): BenchRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l !== '' && !l.startsWith('#'));
  const header = (lines.shift() ?? '').split(',');
  const col = (cells: string[], name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`the benchmark CSV has no ${name} column`);
    return cells[i] as string;
  };
  const rows = new Map<string, Partial<BenchRow>>();
  for (const line of lines) {
    const cells = line.split(',');
    const question = col(cells, 'question');
    const mode = col(cells, 'mode');
    const row = rows.get(question) ?? { question };
    const reads = Number(col(cells, 'calls'));
    const bytes = Number(col(cells, 'bytes'));
    if (mode === 'plain') {
      row.plainReads = reads;
      row.plainBytes = bytes;
      row.plainRightByName = col(cells, 'correct') === 'true';
      row.plainRightByIdentity = col(cells, 'matches_identity_truth') === 'true';
    } else {
      row.graphReads = reads;
      row.graphBytes = bytes;
      row.graphRight = col(cells, 'correct') === 'true';
    }
    rows.set(question, row);
  }
  return [...rows.values()].filter((r): r is BenchRow => r.plainReads !== undefined && r.graphReads !== undefined);
}

export const kbOf = (bytes: number): string => (bytes / 1024).toFixed(1);
