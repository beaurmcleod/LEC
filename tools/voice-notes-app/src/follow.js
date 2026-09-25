// Follow + like pacing. The daily limit is a setting on the Follow screen; the gap between accounts
// and the 48-hour pause after Instagram pushes back are fixed.
export const LIMITS = Object.freeze({
  defaultPerDay: 50,
  maxPerDay: 200,
  minGapMs: 2 * 60 * 1000,
  maxGapMs: 6 * 60 * 1000,
  blockPauseMs: 48 * 60 * 60 * 1000,
  timeZone: 'America/Los_Angeles',
});

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: LIMITS.timeZone,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// Wall-clock parts in Pacific time.
export function pacific(t) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

// Days (and the daily count) run midnight to midnight Pacific.
export const dayKey = (t) => {
  const p = pacific(t);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};

// The UTC time of a Pacific wall-clock hour on a given date (handles daylight saving).
function pacificTime(y, mo, d, h) {
  const want = Date.UTC(y, mo - 1, d, h);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const p = pacific(t);
    t += want - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  }
  return t;
}

// The next midnight Pacific, when the daily count starts over.
export function nextDay(now) {
  const p = pacific(now);
  const date = new Date(Date.UTC(p.y, p.mo - 1, p.d + 1));
  return pacificTime(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0);
}

export const clampPerDay = (n) => Math.min(LIMITS.maxPerDay, Math.max(1, Math.round(Number(n)) || LIMITS.defaultPerDay));
export const followedToday = (state, now) => state.days?.[dayKey(now)] || 0;
export const randomGap = (rng = Math.random) => LIMITS.minGapMs + rng() * (LIMITS.maxGapMs - LIMITS.minGapMs);

// Whether the next account can be visited now, and if not, why and until when.
export function gate(state, now, perDay) {
  if (state.pausedUntil > now) return { ok: false, reason: 'paused', until: state.pausedUntil };
  if (followedToday(state, now) >= perDay) return { ok: false, reason: 'cap', until: nextDay(now) };
  if (state.nextAt > now) return { ok: false, reason: 'gap', until: state.nextAt };
  return { ok: true };
}

export function recordFollow(state, now) {
  const key = dayKey(now);
  state.days = { ...state.days, [key]: (state.days?.[key] || 0) + 1 };
}

// Runs inside the follow tab's Instagram page. Self-contained so it can be sent as source.
// Reads page state by visible text and accessible labels, since Instagram's class names change often.
export async function followPage(action) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const buttons = () => [...document.querySelectorAll('button, [role=button]')].filter(shown);
  // Visible text only: Instagram's icons carry hidden titles (the Following button's "Down chevron icon")
  // that textContent would include.
  const label = (el) => (el.innerText ?? el.textContent).trim();
  const byText = (re) => buttons().find((el) => re.test(label(el)));
  const waitFor = async (fn, ms) => {
    for (const end = Date.now() + ms; ; await sleep(250)) {
      const found = fn();
      if (found || Date.now() > end) return found;
    }
  };
  const mainText = () => (document.querySelector('main') || document.body)?.innerText || '';

  // Instagram's push-back: security checks redirect, blocks show as a dialog, and rate limits can replace the
  // whole page. The whole-page check only runs when there's no profile or post on the page, so a bio or caption
  // that happens to say "try again later" never counts.
  const blocked = () => {
    if (/\/(challenge|checkpoint)\b/.test(location.pathname)) return 'security check';
    const dialogs = [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].map((d) => d.innerText).join('\n');
    const m = dialogs.match(/action blocked|try again later|we restrict certain activity|confirm it'?s you|suspicious (?:login|activity)|security check|help us confirm/i);
    if (m) return m[0];
    if (followState() || likeState()) return '';
    const body = document.body?.innerText || '';
    const bare = body.length < 400 && body.match(/please wait a few minutes|try again later/i);
    return bare ? bare[0] : '';
  };
  const loggedOut = () => /^\/accounts\/login/.test(location.pathname);
  const notFound = () => /sorry, this page isn'?t available|profile isn'?t available|user not found/i.test(mainText());
  const followState = () => {
    if (byText(/^(follow|follow back)$/i)) return 'follow';
    if (byText(/^following$/i)) return 'following';
    if (byText(/^requested$/i)) return 'requested';
    return '';
  };
  const likeButtons = (label) =>
    [...document.querySelectorAll(`svg[aria-label="${label}"]`)].filter((el) => el.getBoundingClientRect().height >= 18);
  const likeState = () => (likeButtons('Unlike').length ? 'liked' : likeButtons('Like').length ? 'like' : '');
  const dismiss = () => byText(/^not now$/i)?.click();

  // The point to click on a target, or a direct click when something covers it.
  const point = (el) => {
    const target = el.closest('button, [role=button], a') || el;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && target.contains(hit)) return { x, y };
    target.click();
    return { clicked: true };
  };

  if (action === 'profile') {
    const settled = await waitFor(() => blocked() || loggedOut() || notFound() || followState(), 15000);
    if (!settled) return { state: 'unknown' };
    dismiss();
    if (blocked()) return { state: 'blocked', note: blocked() };
    if (loggedOut()) return { state: 'loggedout' };
    if (notFound()) return { state: 'notfound' };
    const isPrivate = /this account is private/i.test(mainText());
    const posts = [...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].filter(shown);
    const latest = posts.find((a) => !a.querySelector('svg[aria-label*="pinned" i]'));
    return { state: followState(), private: isPrivate, post: latest?.getAttribute('href') || '' };
  }
  // Short fixed waits let the page finish settling before a click.
  if (action === 'clickFollow') {
    await sleep(800);
    const el = byText(/^(follow|follow back)$/i);
    return el ? point(el) : null;
  }
  if (action === 'afterFollow') {
    const s = await waitFor(() => blocked() || (/^(following|requested)$/.test(followState()) && followState()), 8000);
    if (blocked()) return { state: 'blocked', note: blocked() };
    return { state: s || followState() };
  }
  if (action === 'post') {
    await waitFor(() => blocked() || loggedOut() || likeState(), 15000);
    dismiss();
    if (blocked()) return { state: 'blocked', note: blocked() };
    return { state: likeState() };
  }
  if (action === 'clickLike') {
    await sleep(800);
    const el = likeButtons('Like')[0];
    return el ? point(el) : null;
  }
  if (action === 'afterLike') {
    await waitFor(() => blocked() || likeState() === 'liked', 6000);
    if (blocked()) return { state: 'blocked', note: blocked() };
    return { state: likeState() };
  }
  throw new Error(`Unknown follow step: ${action}`);
}
