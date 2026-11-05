// The Mumbai map's pure parts (WEBSITE_SPEC.md §1 rule 5; MASTER_PLAN.md item 10): our own
// static drawing of the neighbourhoods, no third-party tiles. Shops come from the directory
// (micro-degrees), open shops and agents at work glow while their heartbeat rows are live.

export interface MapBox {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface MapShop {
  ens: string;
  shopKey: string;
  name: string | null;
  area: string | null;
  lat: number;
  lng: number;
  synthetic: boolean;
  open: boolean;
}

export interface MapAgent {
  key: string;
  ens: string;
  owner: string;
  role: string;
  session: string;
}

export interface Neighbourhood {
  area: string;
  lat: number;
  lng: number;
  source: string;
}

export interface MapData {
  box: MapBox;
  persona: { label: string; lat: number; lng: number };
  neighbourhoods: Neighbourhood[];
  shops: MapShop[];
  agents: MapAgent[];
  at: string;
}

const MICRO = 1_000_000;
export const toMicro = (deg: number): number => Math.round(deg * MICRO);
export const toDegrees = (micro: number): number => micro / MICRO;

// A search box around every point, with a margin in degrees, in the i32 micro-degrees the
// directory stores.
export function boxAround(points: { lat: number; lng: number }[], marginDeg: number): MapBox {
  if (points.length === 0) throw new Error('the map needs at least one point');
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    latMin: toMicro(Math.min(...lats) - marginDeg),
    latMax: toMicro(Math.max(...lats) + marginDeg),
    lngMin: toMicro(Math.min(...lngs) - marginDeg),
    lngMax: toMicro(Math.max(...lngs) + marginDeg),
  };
}

// Degrees to drawing units: equirectangular, scaled by cos(latitude) so a kilometre is as long
// east-west as north-south; fitted to the width and height with a padding, north up.
export function projector(points: { lat: number; lng: number }[], width: number, height: number, pad = 40) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
  const spanX = Math.max((lngMax - lngMin) * k, 1e-6);
  const spanY = Math.max(latMax - latMin, 1e-6);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return (p: { lat: number; lng: number }) => ({ x: offX + (p.lng - lngMin) * k * scale, y: offY + (latMax - p.lat) * scale });
}

// Kilometres to drawing units for the same projection (a degree of latitude is 111.32 km).
export function kmToUnits(points: { lat: number; lng: number }[], width: number, height: number, pad = 40): (km: number) => number {
  const p0 = projector(points, width, height, pad);
  const a = p0({ lat: points[0]!.lat, lng: points[0]!.lng });
  const b = p0({ lat: points[0]!.lat + 1 / 111.32, lng: points[0]!.lng });
  const unitsPerKm = Math.abs(a.y - b.y);
  return (km) => km * unitsPerKm;
}

// The Arkiv explorer query a dot links to ("run this query"): the shop's directory row.
export const shopQuery = (shopKey: string): string => `project = str('graphpay') AND type = str('shop') AND shop_key = key(${shopKey.toLowerCase()})`;
export const presenceQuery = (session: string): string => `project = str('graphpay') AND type = str('agent_presence') AND session = str('${session}')`;

// A label that is short enough for the drawing: the shop's name, else its area, else its ENS label.
export function shopLabel(shop: Pick<MapShop, 'name' | 'area' | 'ens'>): string {
  return shop.name ?? shop.area ?? shop.ens.split('.')[0] ?? shop.ens;
}
