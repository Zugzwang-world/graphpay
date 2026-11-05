// The explainer's agent lanes (MASTER_PLAN.md item 13; EVENT_ADDENDUM.md D): Ask, Check,
// Check back, the 402 quote and Pay, filled from the `handoff` rows the agents write to Arkiv
// (one per message that crosses between two agents, its `step` naming the lane) and from the
// run's own result for the payment. Nothing is scripted: an empty lane is a lane that no
// message has reached yet.

export interface LaneDef {
  step: string;
  title: string;
  shows: string;
}

// The step names are the agents package's (`STEPS` in packages/agents/src/activity.mjs).
export const LANES: readonly LaneDef[] = [
  { step: 'ask', title: 'Ask', shows: 'The concierge hands the job to the team.' },
  { step: 'check', title: 'Check', shows: 'The scout and the analyst look at the shops and their records.' },
  { step: 'check-back', title: 'Check back', shows: 'What they found goes back to the concierge, who decides.' },
  { step: 'quote', title: '402 quote', shows: 'The payer asks the chosen shop for its quote.' },
  { step: 'pay', title: 'Pay', shows: 'The payer signs; the facilitator settles.' },
];

export interface HandoffRow {
  key: string;
  step: string;
  from: { ens: string };
  to: { ens: string };
}

export const HANDOFFS_QUERY = 'query Handoffs($id: String!) { handoffs(requestId: $id) { key step from { ens } to { ens } } }';

export function handoffsUrl(runId: string): string {
  const params = new URLSearchParams({ query: HANDOFFS_QUERY, variables: JSON.stringify({ id: runId }) });
  return `/api/graphql?${params.toString()}`;
}

// The rows of each lane, in the order the graph returned them (oldest first). A row whose
// step is not one of the lanes is kept apart, so a new step name is shown, not dropped.
export function lanesOf(rows: HandoffRow[]): { lanes: { def: LaneDef; rows: HandoffRow[] }[]; other: HandoffRow[] } {
  const known = new Set(LANES.map((l) => l.step));
  return {
    lanes: LANES.map((def) => ({ def, rows: rows.filter((r) => r.step === def.step) })),
    other: rows.filter((r) => !known.has(r.step)),
  };
}

// The first label of an ENS name: a.b.example.eth -> a.
export const agentLabel = (ens: string): string => ens.split('.')[0] ?? ens;

// Which lane the run has reached: the last lane with a row.
export function reached(rows: HandoffRow[]): number {
  let at = -1;
  LANES.forEach((l, i) => {
    if (rows.some((r) => r.step === l.step)) at = i;
  });
  return at;
}
