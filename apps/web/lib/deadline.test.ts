import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countdown, nextDeadline } from './deadline.ts';

test('20:00 in Mumbai is 14:30 UTC the same day when it is still ahead', () => {
  const at = nextDeadline(new Date('2026-11-06T10:00:00Z'), '20:00', 'Asia/Kolkata');
  assert.equal(at?.toISOString(), '2026-11-06T14:30:00.000Z');
});

test('once the time has passed the next one is tomorrow', () => {
  const at = nextDeadline(new Date('2026-11-06T15:00:00Z'), '20:00', 'Asia/Kolkata');
  assert.equal(at?.toISOString(), '2026-11-07T14:30:00.000Z');
});

test('the local date is the city date, not the UTC date', () => {
  // 23:00 UTC on the 6th is 04:30 on the 7th in Mumbai.
  const at = nextDeadline(new Date('2026-11-06T23:00:00Z'), '20:00', 'Asia/Kolkata');
  assert.equal(at?.toISOString(), '2026-11-07T14:30:00.000Z');
});

test('a zone with daylight saving uses the offset at the deadline', () => {
  const at = nextDeadline(new Date('2026-03-28T12:00:00Z'), '20:00', 'Europe/London');
  assert.equal(at?.toISOString(), '2026-03-28T20:00:00.000Z');
  const after = nextDeadline(new Date('2026-03-29T12:00:00Z'), '20:00', 'Europe/London');
  assert.equal(after?.toISOString(), '2026-03-29T19:00:00.000Z');
});

test('a malformed clock gives no deadline', () => {
  for (const bad of ['', '8pm', '24:00', '20:60', '20']) assert.equal(nextDeadline(new Date(), bad, 'Asia/Kolkata'), null, bad);
});

test('countdown reads hours and minutes, then minutes and seconds', () => {
  assert.equal(countdown(3 * 3600_000 + 5 * 60_000), '3 h 05 min');
  assert.equal(countdown(125_000), '2 min 05 s');
  assert.equal(countdown(0), 'now');
});
