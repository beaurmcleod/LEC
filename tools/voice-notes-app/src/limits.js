// How much the account does in a day and in an hour, kept well under what gets an Instagram account flagged.
// Instagram publishes no numbers, so these are cautious rules of thumb from what people running outreach
// accounts report, set at the low end of each range, because voice notes to people who don't follow you
// back, follows and likes all count toward the same picture of the account. Days run midnight to midnight Pacific.
import { dayKey, nextDay, pacific } from './follow.js';

const HOUR = 60 * 60 * 1000;

// dm: cold voice notes a day; follow/like: a day; total: all three together; *Hour: most in any rolling hour;
// dmGapMin: least minutes between voice notes.
export const LEVELS = Object.freeze({
  new: { label: 'New account (under 3 months old)', dm: 15, dmHour: 4, dmGapMin: 10, follow: 30, followHour: 8, like: 100, likeHour: 15, total: 150 },
  established: { label: 'Established (3 to 12 months old)', dm: 30, dmHour: 6, dmGapMin: 7, follow: 50, followHour: 10, like: 150, likeHour: 20, total: 250 },
  aged: { label: 'Well established (over a year old)', dm: 50, dmHour: 8, dmGapMin: 5, follow: 80, followHour: 12, like: 250, likeHour: 25, total: 400 },
});
export const DEFAULT_LIMITS = Object.freeze({
  level: 'established',
  // Start at about a third of the caps and work up over the first ten days, so the account never jumps from
  // nothing to a full day's worth at once.
  ramp: true,
  // Voice notes only go out inside this window (Pacific), like a person working through their DMs.
  window: { on: true, from: 8, to: 20 },
  // Lower a day's cap than the level allows ('' keeps the level's).
  custom: { dm: '', follow: '', like: '' },
});

// The fraction of the full caps allowed on day `days` since the account started doing this.
export const rampFactor = (days) => Math.min(100, 35 + 15 * Math.floor(Math.max(0, days) / 2)) / 100;

const MIN = { dm: 5, follow: 10, like: 30, total: 40 };
const pick = (n, dflt) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n)) : dflt);

// The caps in force right now. `startedAt` is when the account began doing this (first voice note or follow).
export function caps(cfg = {}, now = Date.now(), startedAt = now, { fast = false } = {}) {
  const level = LEVELS[cfg.level] ? cfg.level : DEFAULT_LIMITS.level;
  const L = LEVELS[level];
  const days = Math.max(0, Math.floor((now - (startedAt || now)) / (24 * HOUR)));
  const f = cfg.ramp === false ? 1 : rampFactor(days);
  const own = (k) => Math.min(L[k], pick(cfg.custom?.[k], L[k]));
  const day = (k, base) => Math.max(Math.min(MIN[k], base), Math.round(base * f));
  // Test runs only: no waiting between voice notes, no hourly limits, any time of day. The daily limits still apply.
  const quick = fast ? { dmHour: 1000, followHour: 1000, likeHour: 1000, dmGapMs: 200, window: { on: false, from: 8, to: 20 } } : null;
  return {
    level,
    days,
    ramp: f,
    dm: day('dm', own('dm')),
    follow: day('follow', own('follow')),
    like: day('like', own('like')),
    total: day('total', L.total),
    dmHour: L.dmHour,
    followHour: L.followHour,
    likeHour: L.likeHour,
    dmGapMs: L.dmGapMin * 60 * 1000,
    window: cfg.window || DEFAULT_LIMITS.window,
    ...quick,
  };
}

// Times (ms) of the actions in the last hour, from a list of timestamps.
const inHour = (times, now) => times.filter((t) => t > now - HOUR && t <= now);

// How long until the hourly count drops below `cap`: when the oldest action in the window ages out.
function hourUntil(times, cap, now) {
  const recent = inHour(times, now).sort((a, b) => a - b);
  return recent.length < cap ? now : recent[recent.length - cap] + HOUR;
}

// Whether an action of `kind` ('dm', 'follow', 'like') can happen now, and if not, why and until when.
// `times` is { dm: [...], follow: [...], like: [...] } (timestamps of everything done in the last day or so).
export function gate(kind, times, c, now = Date.now()) {
  const today = (list) => list.filter((t) => dayKey(t) === dayKey(now)).length;
  const done = { dm: today(times.dm || []), follow: today(times.follow || []), like: today(times.like || []) };
  const all = done.dm + done.follow + done.like;
  const tomorrow = nextDay(now);
  if (done[kind] >= c[kind]) return { ok: false, reason: 'day', until: tomorrow, done: done[kind], cap: c[kind] };
  if (all >= c.total) return { ok: false, reason: 'total', until: tomorrow, done: all, cap: c.total };
  const hourCap = c[`${kind}Hour`];
  const at = hourUntil(times[kind] || [], hourCap, now);
  if (at > now) return { ok: false, reason: 'hour', until: at, done: inHour(times[kind] || [], now).length, cap: hourCap };
  if (kind === 'dm') {
    const last = Math.max(0, ...(times.dm || []));
    if (last && last + c.dmGapMs > now) return { ok: false, reason: 'gap', until: last + c.dmGapMs };
    const w = c.window;
    if (w?.on) {
      const h = pacific(now).h;
      if (h < w.from || h >= w.to) return { ok: false, reason: 'window', until: nextWindow(now, w) };
    }
  }
  return { ok: true, done: done[kind], cap: c[kind] };
}

// The next moment voice notes may go out: the next time the Pacific clock reaches the window's first hour.
export function nextWindow(now, w) {
  for (let m = 1; m <= 48 * 60; m++) {
    const t = now + m * 60 * 1000;
    const p = pacific(t);
    if (p.h === w.from && p.mi === 0) return t;
  }
  return now + 12 * HOUR;
}

// How many more of `kind` are allowed right now: what's left of the day's cap, the hour's cap and the combined cap.
export function left(kind, times, c, now = Date.now()) {
  const today = (list) => list.filter((t) => dayKey(t) === dayKey(now)).length;
  const done = { dm: today(times.dm || []), follow: today(times.follow || []), like: today(times.like || []) };
  const all = done.dm + done.follow + done.like;
  return Math.max(0, Math.min(c[kind] - done[kind], c[`${kind}Hour`] - inHour(times[kind] || [], now).length, c.total - all));
}

// A little random spread on the gap, so sends aren't on a timer.
export const jitter = (ms, rng = Math.random) => Math.round(ms * (1 + rng() * 0.4));

export const reasonText = (g, kind) => {
  const what = { dm: 'voice notes', follow: 'follows', like: 'likes' }[kind];
  if (g.reason === 'day') return `today's limit of ${g.cap} ${what} is reached`;
  if (g.reason === 'total') return `today's combined limit of ${g.cap} actions is reached`;
  if (g.reason === 'hour') return `${g.cap} ${what} an hour is the most to stay safe`;
  if (g.reason === 'gap') return 'a few minutes between voice notes keeps it natural';
  if (g.reason === 'window') return 'voice notes only go out during the day';
  return '';
};
