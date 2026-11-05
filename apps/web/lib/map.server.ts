// The map's reads: the shop directory in a box around the story's neighbourhoods, which shops
// have their Open toggle on, and the agents at work (presence rows), all through the money
// graph. Every figure is read, none made up; synthetic shops stay labelled synthetic.
import { story } from '@graphpay/config';
import { runGraphql } from '@graphpay/money-graph';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { boxAround, toDegrees, type MapAgent, type MapBox, type MapData, type MapShop, type Neighbourhood } from './map.ts';
import { siteModel } from './site.server.ts';

export type Runner = (query: string, variables: Record<string, unknown>) => Promise<{ data?: unknown; errors?: { message: string }[] }>;

const SHOP = 'ens shopKey area name lat lng synthetic';
const AGENT = 'key role session agent { ens } owner { ens }';
export const MAP_QUERY = `query Map($box: Box!, $buyers: String!, $sellers: String!) {
  real: shops(box: $box, synthetic: false, limit: 100) { ${SHOP} }
  syn: shops(box: $box, synthetic: true, limit: 100) { ${SHOP} }
  realOpen: shops(box: $box, synthetic: false, openNow: true, limit: 100) { shopKey }
  synOpen: shops(box: $box, synthetic: true, openNow: true, limit: 100) { shopKey }
  buyers: agentsOnline(owner: $buyers) { ${AGENT} }
  sellers: agentsOnline(owner: $sellers) { ${AGENT} }
}`;

interface RawShop {
  ens: string;
  shopKey: string;
  area: string | null;
  name: string | null;
  lat: number;
  lng: number;
  synthetic: boolean;
}
interface RawAgent {
  key: string;
  role: string;
  session: string;
  agent: { ens: string };
  owner: { ens: string };
}

const locations = () => story.locations as { persona: { label: string; lat: number; lng: number }; neighbourhoods: Neighbourhood[] };

export function mapBox(): MapBox {
  const l = locations();
  // A margin of 0.03 degrees (about 3 km) around every neighbourhood and the arrival point.
  return boxAround([...l.neighbourhoods, l.persona], 0.03);
}

export async function readMap(run: Runner, nowMs = Date.now()): Promise<MapData> {
  const l = locations();
  const box = mapBox();
  const model = siteModel();
  const answer = await run(MAP_QUERY, { box, buyers: model.persona.ens, sellers: model.merchant.ens });
  if (answer.errors?.length || answer.data === undefined) throw new Error('the graph did not answer');
  const data = answer.data as Record<'real' | 'syn', RawShop[]> & Record<'realOpen' | 'synOpen', { shopKey: string }[]> & Record<'buyers' | 'sellers', RawAgent[]>;
  const open = new Set([...data.realOpen, ...data.synOpen].map((s) => s.shopKey.toLowerCase()));
  const shops = new Map<string, MapShop>();
  for (const s of [...data.real, ...data.syn]) {
    shops.set(s.ens, { ens: s.ens, shopKey: s.shopKey, name: s.name, area: s.area, lat: toDegrees(s.lat), lng: toDegrees(s.lng), synthetic: s.synthetic, open: open.has(s.shopKey.toLowerCase()) });
  }
  const agents = new Map<string, MapAgent>();
  for (const a of [...data.buyers, ...data.sellers]) agents.set(a.key, { key: a.key, ens: a.agent.ens, owner: a.owner.ens, role: a.role, session: a.session });
  return { box, persona: l.persona, neighbourhoods: l.neighbourhoods, shops: [...shops.values()], agents: [...agents.values()], at: new Date(nowMs).toISOString() };
}

const runLive: Runner = async (query, variables) => runGraphql({ engine: await arkivEngine(), query, variables, dataset: 'live' });

// One read per 4 s per instance, however many viewers poll.
let shared: { at: number; value: Promise<MapData> } | null = null;
export function sharedMap(): Promise<MapData> {
  if (shared && Date.now() - shared.at < 4000) return shared.value;
  const value = readMap(runLive);
  shared = { at: Date.now(), value };
  value.catch(() => {
    if (shared?.value === value) shared = null;
  });
  return value;
}
