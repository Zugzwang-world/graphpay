// G1: the limits come from the human's words. Code reads the budget and the
// deadline (a clock time today, or a span from the request such as "within an
// hour") from the request; no readable budget or deadline means no agent runs
// (fail closed). The model's need is adopted only after code has overwritten
// its limits, and the need is set once (planning/SPEC/AGENTS.md §3, §4).

import { createHash } from 'node:crypto';
import { NeedProposal } from './contracts.mjs';
import { fromMicro, toMicro } from './money.mjs';

const escapeRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function budgets(request, currency) {
  const cur = escapeRe(currency);
  const before = new RegExp(`\\b(?:under|below|max(?:imum)?|at most|up to|no more than|less than|within|budget(?: of)?)\\s+(\\d{1,12}(?:\\.\\d{1,6})?)\\s*${cur}\\b`, 'gi');
  return [...request.matchAll(before)].map((m) => m[1]);
}

const DEADLINE = /\b(?:by|before|until|no later than)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\w:])/gi;

function deadlines(request) {
  const out = [];
  for (const m of request.matchAll(DEADLINE)) {
    let hour = Number(m[1]);
    const minute = m[2] === undefined ? 0 : Number(m[2]);
    const half = m[3]?.toLowerCase().replace(/\./g, '');
    if (minute > 59) continue;
    if (half) {
      if (hour < 1 || hour > 12) continue;
      hour = (hour % 12) + (half === 'pm' ? 12 : 0);
    } else if (m[2] === undefined || hour > 23) {
      continue; // "by 8" is ambiguous: no deadline is read from it
    }
    out.push({ hour, minute });
  }
  return out;
}

// A deadline relative to the request: "within an hour", "in 45 minutes", "under 2 hours",
// "within half an hour". Up to a day; a zero or longer span is not read as a deadline.
const RELATIVE = /\b(?:within|in|under)\s+(?:the\s+next\s+)?(half\s+an?|an?|one|\d{1,4}(?:\.\d{1,2})?)\s*(hours?|hrs?|minutes?|mins?)\b/gi;
export const MAX_RELATIVE_MINUTES = 24 * 60;

function relativeMinutes(request) {
  const out = [];
  for (const m of request.matchAll(RELATIVE)) {
    const amount = m[1].toLowerCase().replace(/\s+/g, ' ');
    const count = amount.startsWith('half') ? 0.5 : amount === 'a' || amount === 'an' || amount === 'one' ? 1 : Number(amount);
    const minutes = Math.round(/^h/i.test(m[2]) ? count * 60 : count);
    if (minutes >= 1 && minutes <= MAX_RELATIVE_MINUTES) out.push(minutes);
  }
  return out;
}

// The UTC offset of a time zone at an instant, in minutes (Intl, no dependency).
export function zoneOffsetMinutes(instantMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((local - Math.floor(instantMs / 1000) * 1000) / 60_000);
}

function localDate(instantMs, timeZone) {
  const shifted = new Date(instantMs + zoneOffsetMinutes(instantMs, timeZone) * 60_000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

const two = (n) => String(n).padStart(2, '0');

function isoWithOffset(instantMs, timeZone) {
  const offset = zoneOffsetMinutes(instantMs, timeZone);
  const local = new Date(instantMs + offset * 60_000);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return (
    `${local.getUTCFullYear()}-${two(local.getUTCMonth() + 1)}-${two(local.getUTCDate())}` +
    `T${two(local.getUTCHours())}:${two(local.getUTCMinutes())}:00${sign}${two(Math.floor(abs / 60))}:${two(abs % 60)}`
  );
}

// The instant of a local wall-clock time today (in the time zone) as of `now`.
export function todayAt(now, { hour, minute }, timeZone) {
  const { y, m, d } = localDate(now, timeZone);
  const guess = Date.UTC(y, m, d, hour, minute);
  let instant = guess - zoneOffsetMinutes(guess, timeZone) * 60_000;
  instant = guess - zoneOffsetMinutes(instant, timeZone) * 60_000; // settle across an offset change
  return instant;
}

export function mandateHash(fields) {
  const canonical = JSON.stringify({
    schema: 'graphpay.mandate/v1',
    buyer: fields.buyer,
    currency: fields.currency,
    budgetMicro: fields.budgetMicro.toString(),
    deadline: new Date(fields.deadlineMs).toISOString(),
    request: fields.request,
  });
  return `0x${createHash('sha256').update(canonical).digest('hex')}`;
}

// → { ok: true, mandate } or { ok: false, reason, detail }. Never throws on input text.
export function parseMandate(request, { now, timeZone, currency, buyer }) {
  if (typeof request !== 'string' || request.trim() === '' || request.length > 2000) {
    return { ok: false, reason: 'MANDATE_UNREADABLE', detail: 'no request text' };
  }
  const found = [...new Set(budgets(request, currency).map((b) => toMicro(b)))];
  if (found.length === 0) return { ok: false, reason: 'MANDATE_NO_BUDGET', detail: `no budget in ${currency} in the request` };
  if (found.length > 1) return { ok: false, reason: 'MANDATE_AMBIGUOUS_BUDGET', detail: 'the request names more than one budget' };
  // A clock time is today's in the city; a span counts from the request, to the whole minute
  // (never later than the words allow), so an errand works at any hour.
  const instants = [
    ...deadlines(request).map((t) => todayAt(now, t, timeZone)),
    ...relativeMinutes(request).map((minutes) => Math.floor((now + minutes * 60_000) / 60_000) * 60_000),
  ];
  const distinct = [...new Set(instants)];
  if (distinct.length === 0) return { ok: false, reason: 'MANDATE_NO_DEADLINE', detail: 'no deadline ("by 8 pm", "by 20:00", "within an hour") in the request' };
  if (distinct.length > 1) return { ok: false, reason: 'MANDATE_AMBIGUOUS_DEADLINE', detail: 'the request names more than one deadline' };
  const budgetMicro = found[0];
  if (budgetMicro <= 0n) return { ok: false, reason: 'MANDATE_NO_BUDGET', detail: 'the budget is zero' };
  const deadlineMs = distinct[0];
  if (!(deadlineMs > now)) {
    return { ok: false, reason: 'MANDATE_DEADLINE_PASSED', detail: `the deadline ${isoWithOffset(deadlineMs, timeZone)} has passed` };
  }
  const fields = { buyer, currency, budgetMicro, deadlineMs, request };
  return {
    ok: true,
    mandate: Object.freeze({
      budgetUsdt: fromMicro(budgetMicro),
      budgetMicro,
      deadlineIso: isoWithOffset(deadlineMs, timeZone),
      deadlineMs,
      currency,
      buyer,
      hash: mandateHash(fields),
    }),
  };
}

const words = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Code's need for this request: the food need when the request names the story's
// item; the quantity is the story's standard box unless the request gives a
// number right before the item. Other needs are configuration only (§12).
export function needFromRequest(request, mandate, cast) {
  const text = ` ${words(request)} `;
  const item = words(cast.food.item);
  if (!text.includes(` ${item} `) && !text.includes(` ${item}s `)) return null;
  const counted = text.match(new RegExp(` (\\d{1,4}) ${escapeRe(item)}s? `));
  return {
    need: 'food',
    item: cast.food.item,
    category: cast.food.category,
    quantity: counted ? Number(counted[1]) : cast.food.quantity,
    budgetUsdt: mandate.budgetUsdt,
    deadlineIso: mandate.deadlineIso,
    city: cast.city.name,
    buyer: mandate.buyer,
  };
}

// Need adoption (G1): code's need wins field by field; every disagreement is
// logged. The first adoption sets the need for the whole errand.
export function adoptNeed(state, proposal, log, agent) {
  const parsed = NeedProposal.safeParse(proposal);
  const code = state.codeNeed;
  if (!code) return { ok: false, reason: 'NEED_NOT_SUPPORTED', detail: 'the request names no need this team serves' };
  const differences = [];
  if (parsed.success) {
    const p = parsed.data;
    if (p.need !== code.need) differences.push(`need ${p.need} → ${code.need}`);
    if (words(p.item) !== words(code.item)) differences.push(`item "${p.item}" → "${code.item}"`);
    if (p.quantity !== code.quantity) differences.push(`quantity ${p.quantity} → ${code.quantity}`);
    if (toMicro(p.budgetUsdt) !== toMicro(code.budgetUsdt)) differences.push(`budget ${p.budgetUsdt} → ${code.budgetUsdt}`);
    const deadline = Date.parse(p.deadlineIso);
    if (!(deadline === state.mandate.deadlineMs)) differences.push(`deadline ${p.deadlineIso} → ${code.deadlineIso}`);
    if (words(p.city) !== words(code.city)) differences.push(`city ${p.city} → ${code.city}`);
  } else {
    differences.push('the proposed need did not parse; code reads it from the request');
  }
  if (!state.need) {
    state.need = Object.freeze({ ...code });
    log.guard('G1', true, differences.length ? `${agent}: limits and need from the human's words (${differences.join('; ')})` : `${agent}: the need matches the human's words`);
  } else if (differences.length) {
    log.guard('G1', true, `${agent}: the need is already set; kept it (${differences.join('; ')})`);
  }
  return { ok: true, need: state.need };
}
