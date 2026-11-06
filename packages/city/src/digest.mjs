// A seeded city's fingerprint: sha-256 digests of its events and its actors, recorded when it is
// seeded (docs/sessions/arkiv/city/digests.json), so a test shows the generator and the story
// still give that same city (ADR-0077).

import { createHash } from 'node:crypto';

const sha256 = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function cityDigest(city) {
  return {
    events: sha256(city.events.map((e) => [e.ref, e.kind, e.from.ens, e.from.epoch, e.to.ens, e.to.epoch, String(e.amountMicro), e.ts])),
    actors: sha256([...city.actors.values()].map((a) => [a.ens, a.kind, a.owner ?? null, a.epoch, Boolean(a.cast)])),
  };
}
