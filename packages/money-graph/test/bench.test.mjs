// Race mode's call tap reports completed calls only. On Sat 7 Nov the live site's keyed Arkiv
// endpoint answered QUOTA_EXCEEDED, the transport logged its fallback, and the tap counted that
// event as a read: the stage's counter showed 3 and then the answer's 2.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callTap } from '../index.mjs';

test('a transport event is not a call; its bytes go to the call it belongs to', () => {
  const stats = { requestBytes: 0, responseBytes: 0 };
  const tap = callTap();
  const seen = [];
  tap.listen(stats, (c) => seen.push(c));
  stats.requestBytes += 769;
  tap.log({ event: 'quota-exhausted-fallback', method: 'arkiv_query', fallbackMs: 60_000 });
  stats.responseBytes += 19_382;
  tap.log({ method: 'arkiv_query', status: 200, ms: 339 });
  stats.requestBytes += 700;
  stats.responseBytes += 14_527;
  tap.log({ method: 'arkiv_query', status: 200, ms: 238 });
  assert.deepEqual(
    seen.map((c) => [c.call, c.bytes, c.ms]),
    [
      [1, 20_151, 339],
      [2, 15_227, 238],
    ],
  );
  tap.stop();
  tap.log({ method: 'arkiv_query', status: 200, ms: 1 });
  assert.equal(seen.length, 2);
});
