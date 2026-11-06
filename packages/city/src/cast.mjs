// The cast a seeded city, or the live graph, is written with (story syntheticCity.casts;
// ADR-0077): the story's cast with each shop's ENS label, category, area and place taken
// from the named cast by story role, and the renewal at that cast's price. These come only
// from that cast, never from shops[] or renewal, so a city seeded with it is generated again
// with the same names and amounts after the live story changes (W1 flips the live labels).

import { activeCast } from '@graphpay/config';

const ROLES = ['good', 'runner-up', 'trap'];

export function pinnedCast(story, name) {
  const pinned = story.syntheticCity?.casts?.[name];
  if (!pinned?.shops) throw new Error(`city: no cast "${name}" in story syntheticCity.casts`);
  if (typeof pinned.category !== 'string' || pinned.category === '') throw new Error(`city: cast "${name}" has no category`);
  if (!Number.isInteger(pinned.renewalPriceMicro) || pinned.renewalPriceMicro <= 0) throw new Error(`city: cast "${name}" has no renewal price`);
  const cast = activeCast(story);
  const shops = cast.shops.map((s) => {
    const p = pinned.shops[s.storyRole];
    if (!p?.label) throw new Error(`city: cast "${name}" has no shop for the story role "${s.storyRole}"`);
    const placed = Number.isFinite(p.lat) && Number.isFinite(p.lng);
    return { ...s, label: p.label, category: pinned.category, area: p.area ?? null, location: placed ? { lat: p.lat, lng: p.lng } : null };
  });
  for (const role of ROLES) if (!shops.some((s) => s.storyRole === role)) throw new Error(`city: the story has no ${role} shop`);
  return { ...cast, shops, renewal: { ...cast.renewal, priceMicro: pinned.renewalPriceMicro } };
}

// The cast of a city size: its pinned cast when the size names one, else the story's own.
export function castOfSize(story, size) {
  const name = story.syntheticCity?.sizes?.[size]?.cast;
  return name ? pinnedCast(story, name) : activeCast(story);
}
