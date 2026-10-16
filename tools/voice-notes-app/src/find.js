// Finds Instagram accounts to turn into leads. It searches hashtags, reads each new account's profile, and saves
// the raw profile to the Airtable IG Prospects table as New, the same rows the old Make scenario (TL-IG1) saved,
// so the daily "Sort IG Prospects" routine qualifies them and copies the good ones into Leads.
import * as F from './follow.js';
import { PROSPECT } from './leads.js';

// Local hashtags for the owner-run fitness and wellness businesses the sort routine wants. Kept to tags whose
// accounts it can qualify: chiropractors, physical therapists and martial-arts academies are always skipped.
export const DEFAULT_TAGS = [
  'sandiegotrainer',
  'sandiegopersonaltrainer',
  'sandiegofitness',
  'sdfitness',
  'sandiegogym',
  'sandiegocoach',
  'sandiegocrossfit',
  'sandiegoboxing',
  'sandiegowellness',
  'sandiegorecovery',
  'sandiegopilates',
  'sandiegoyoga',
  'sandiegosauna',
  'sandiegocoldplunge',
  'sandiegonutrition',
  'sandiegohyrox',
  'carlsbadfitness',
  'encinitasfitness',
  'oceansidefitness',
];

export const LIMITS = Object.freeze({
  defaultPerDay: 40, // profiles read a day
  maxPerDay: 100,
  minGapMs: 25 * 1000, // between profiles
  maxGapMs: 70 * 1000,
  tagGapMs: 60 * 1000, // after a hashtag page
  maxTagsPerDay: 30,
  tagEveryMs: 12 * 60 * 60 * 1000, // a hashtag is searched again after this long
  perTag: 15, // new accounts taken from one hashtag page
  probePosts: 10, // posts opened to find their authors when the hashtag page's own data has none
  postsPerProfile: 2, // recent posts opened for captions, dates and location tags
  scrolls: 2,
});

export const clampPerDay = (n) => Math.min(LIMITS.maxPerDay, Math.max(1, Math.round(Number(n)) || LIMITS.defaultPerDay));
export const randomGap = (rng = Math.random) => LIMITS.minGapMs + rng() * (LIMITS.maxGapMs - LIMITS.minGapMs);

// "#SanDiegoFitness" -> "sandiegofitness".
export const cleanTag = (raw) =>
  String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, '');

// One hashtag per line (commas and spaces work too), without repeats.
export const parseTags = (text) => [...new Set(String(text || '').split(/[\s,]+/).map(cleanTag).filter((t) => t.length >= 2 && t.length <= 60))];

export const cleanUser = (raw) => String(raw || '').trim().replace(/^@/, '').toLowerCase();
export const validUser = (u) => /^[a-z0-9._]{1,30}$/.test(u);

// "1,646" -> 1646, "12.3K" -> 12300, "1.2M" -> 1200000.
export function parseCount(s) {
  const m = String(s ?? '')
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d+)?)\s*([kKmMbB])?/);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

// Every account in Instagram's own answers for a hashtag page, whatever their shape: each post that carries an
// author (`user` or `owner` with a username) gives the account, its display name, the caption and the location tag.
export function authorsFromJson(roots) {
  const out = new Map();
  const seen = new Set();
  const text = (v) => (typeof v === 'string' ? v : typeof v?.text === 'string' ? v.text : '');
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 14 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const n of node) walk(n, depth + 1);
      return;
    }
    const user = [node.user, node.owner].find((u) => u && typeof u === 'object' && typeof u.username === 'string');
    if (user) {
      const username = cleanUser(user.username);
      if (validUser(username)) {
        const caption = text(node.caption) || text(node.edge_media_to_caption?.edges?.[0]?.node) || '';
        const prev = out.get(username);
        const entry = {
          username,
          fullName: String(user.full_name || user.fullName || prev?.fullName || '').trim(),
          // The first post seen for an account is the one it was found by.
          caption: prev?.caption || caption || '',
          location: String(prev?.location || node.location?.name || '').trim(),
          takenAt: Number(node.taken_at || node.taken_at_timestamp) || prev?.takenAt || 0,
        };
        out.set(username, entry);
      }
    }
    for (const k of Object.keys(node)) if (node[k] && typeof node[k] === 'object') walk(node[k], depth + 1);
  };
  for (const r of [].concat(roots)) walk(r, 0);
  return [...out.values()];
}

// Dates ("2026-09-25T01:02:24.000Z") for the context; day-only dates read from a tile's alt text are kept too.
const iso = (d) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
};

// A grid tile's alt text usually carries the post's date: "Photo by Name on September 20, 2026. May be an image of...".
export function dateFromAlt(alt) {
  const m = String(alt || '').match(/\bon ([A-Z][a-z]+ \d{1,2}, \d{4})\b/);
  return m ? iso(`${m[1]} 12:00 UTC`) : '';
}

const flat = (s) => String(s || '').replace(/\r/g, '').trim();

// The raw profile as one block of text, in the layout the old scenario saved and the sort routine reads.
export function contextText(info, via = {}) {
  const posts = info.posts || [];
  const dates = [...posts.map((p) => iso(p.date)), ...(info.tileDates || [])].filter(Boolean);
  const newest4 = [...new Set(dates)].sort().reverse().slice(0, 4);
  const captions = posts.map((p) => flat(p.caption)).filter(Boolean).join(' || ').slice(0, 1500);
  const places = [...new Set(posts.map((p) => flat(p.location)).filter(Boolean))].join(', ');
  return [
    `display name: ${info.fullName || ''}`,
    `category: ${info.category || ''}`,
    `website: ${info.website || ''}`,
    `business account: ${!!info.business}`,
    `private: ${!!info.private}`,
    `posts: ${info.postsCount ?? ''}`,
    `recent post dates: ${newest4.join(', ')}`,
    `recent captions: ${captions}`,
    `recent location tags: ${places}`,
    `found via post caption: ${flat(via.caption).slice(0, 600)}`,
    `found via location tag: ${flat(via.location)}`,
  ].join('\n');
}

// The IG Prospects row, keyed by field id like the scenario's.
export function prospectFields(info, via = {}) {
  const handle = cleanUser(info.handle);
  const fields = {
    [PROSPECT.handle]: handle,
    [PROSPECT.status]: 'New',
    [PROSPECT.source]: 'Instagram hashtag',
    [PROSPECT.context]: contextText(info, via),
    [PROSPECT.bio]: String(info.bio || '').slice(0, 1000),
    [PROSPECT.url]: `https://www.instagram.com/${handle}/`,
  };
  if (Number.isFinite(info.followers)) fields[PROSPECT.followers] = info.followers;
  return fields;
}

// ---------- pacing ----------

const day = (state, now) => state.days?.[F.dayKey(now)] || {};
export const readToday = (state, now) => day(state, now).read || 0;
export const savedToday = (state, now) => day(state, now).saved || 0;
export const tagsToday = (state, now) => day(state, now).tags || 0;

export function record(state, now, what, n = 1) {
  const key = F.dayKey(now);
  const d = { ...(state.days?.[key] || {}) };
  d[what] = (d[what] || 0) + n;
  state.days = { ...state.days, [key]: d };
}

// Whether the next account can be read now, and if not, why and until when.
export function gate(state, now, perDay, pausedUntil = 0) {
  if (pausedUntil > now) return { ok: false, reason: 'paused', until: pausedUntil };
  if (readToday(state, now) >= perDay) return { ok: false, reason: 'cap', until: F.nextDay(now) };
  if (state.nextAt > now) return { ok: false, reason: 'gap', until: state.nextAt };
  return { ok: true };
}

// The hashtag to search next: the one searched longest ago, if it's due. Otherwise when the soonest one is.
export function nextTag(state, tags, now) {
  const last = (t) => state.tags?.[t]?.at || 0;
  const order = [...tags].sort((a, b) => last(a) - last(b));
  const due = order.find((t) => now - last(t) >= LIMITS.tagEveryMs);
  if (due) return { tag: due };
  return { tag: '', until: order.length ? last(order[0]) + LIMITS.tagEveryMs : 0 };
}

// ---------- in the Instagram page ----------

// Runs inside the hidden Instagram tab. Self-contained so it can be sent as source. Reads by visible text and
// accessible labels, since Instagram's class names change often. Actions:
//   tag      a hashtag page: scrolls a little so it loads more posts, returns the post tiles
//   profile  a profile: name, category, counts, bio, link, private, and the newest post tiles
//   post     a post: author, caption, date and location tag
export async function findPage(action, arg) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => (el.innerText ?? el.textContent ?? '').trim();
  const waitFor = async (fn, ms) => {
    for (const end = Date.now() + ms; ; await sleep(250)) {
      const found = fn();
      if (found || Date.now() > end) return found;
    }
  };
  const mainText = () => (document.querySelector('main') || document.body)?.innerText || '';
  const header = () => document.querySelector('main header') || document.querySelector('header');
  const tiles = () => [...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].filter(shown);
  const dismiss = () => [...document.querySelectorAll('button, [role=button]')].find((el) => shown(el) && /^not now$/i.test(label(el)))?.click();

  // Instagram's push-back: security checks redirect, blocks show as a dialog, and rate limits can replace the
  // whole page. The whole-page check only runs when there's nothing of a profile or hashtag page on screen.
  const blocked = () => {
    if (/\/(challenge|checkpoint)\b/.test(location.pathname)) return 'security check';
    const dialogs = [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].map((d) => d.innerText).join('\n');
    const m = dialogs.match(/action blocked|try again later|we restrict certain activity|confirm it'?s you|suspicious (?:login|activity)|security check|help us confirm/i);
    if (m) return m[0];
    if (header() || tiles().length) return '';
    const body = document.body?.innerText || '';
    const bare = body.length < 400 && body.match(/please wait a few minutes|try again later/i);
    return bare ? bare[0] : '';
  };
  const loggedOut = () => /^\/accounts\/login/.test(location.pathname);
  const notFound = () => /sorry, this page isn'?t available|profile isn'?t available|user not found|page isn'?t available/i.test(mainText());
  const count = (text, word) => {
    const m = text.match(new RegExp('([\\d.,]+\\s*[KkMmBb]?)\\s*' + word, 'i'));
    return m ? m[1].replace(/\s+/g, '') : '';
  };
  const stop = (extra) => {
    const b = blocked();
    if (b) return { state: 'blocked', note: b };
    if (loggedOut()) return { state: 'loggedout' };
    if (notFound()) return { state: 'notfound' };
    return extra ? extra() : null;
  };

  if (action === 'tag') {
    await waitFor(() => blocked() || loggedOut() || notFound() || tiles().length, 15000);
    const s = stop();
    if (s) return s;
    if (!tiles().length) return { state: 'empty' };
    dismiss();
    // Scrolls like someone reading, so the page asks for more posts (its own answers carry the accounts).
    for (let i = 0; i < (Number(arg) || 0); i++) {
      window.scrollBy(0, Math.round(window.innerHeight * 0.9));
      await sleep(1400 + Math.random() * 1600);
      const b = blocked();
      if (b) return { state: 'blocked', note: b };
    }
    const seen = new Set();
    const list = [];
    for (const a of tiles()) {
      const href = a.getAttribute('href');
      if (seen.has(href)) continue;
      seen.add(href);
      list.push({ href, alt: a.querySelector('img')?.getAttribute('alt') || '' });
    }
    return { state: 'ok', tiles: list.slice(0, 80) };
  }

  if (action === 'profile') {
    await waitFor(() => blocked() || loggedOut() || notFound() || (header() && label(header()).length > 10), 15000);
    dismiss();
    const s = stop();
    if (s) return s;
    const h = header();
    if (!h || label(h).length <= 10) return { state: 'unknown' };
    const handle = (location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
    const title = document.title.match(/^(.*?)\s*\(@([^)]+)\)/);
    const fullName = title ? title[1].trim() : '';
    const text = label(h);
    const followers = count(text, 'followers?');
    const postsCount = count(text, 'posts?');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const statLabel = /^(posts?|followers?|following)$/i;
    const statLine = /^[\d.,]+\s*[KkMmBb]?\s*(posts?|followers?|following)$/i;
    const buttons = /^(follow|following|follow back|message|requested|edit profile|view archive|contact|email|call|directions|options|more|share profile|unblock|subscribe)$/i;
    const business = lines.some((l) => /^(email|call|directions|contact)$/i.test(l));
    const kept = lines.filter((l, i) => {
      if (statLine.test(l) || statLabel.test(l) || buttons.test(l)) return false;
      if (/^[\d.,]+\s*[KkMmBb]?$/.test(l) && statLabel.test(lines[i + 1] || '')) return false;
      if (l.toLowerCase() === handle || l.toLowerCase() === fullName.toLowerCase()) return false;
      if (/^followed by /i.test(l) || /^\+ ?\d+ more$/i.test(l) || /^(threads|•)$/i.test(l)) return false;
      return true;
    });
    // The link in the bio: its own text when that looks like an address, otherwise where Instagram's redirect goes.
    const link = [...h.querySelectorAll('a[href]')].find((a) => {
      const href = a.getAttribute('href') || '';
      return (/l\.instagram\.com\/\?u=|^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?instagram\.com\//i.test(href) && !/threads\.(net|com)/i.test(href)) || false;
    });
    let website = '';
    if (link) {
      const t = label(link);
      if (/\./.test(t) && !/\s/.test(t)) website = t;
      else {
        try {
          website = decodeURIComponent(new URL(link.href).searchParams.get('u') || '');
        } catch {}
      }
    }
    let rest = kept.filter((l) => !(website && l === website));
    // A business account shows its category as a short plain line above the bio.
    let category = '';
    if (rest.length > 1 && /^[A-Za-z][A-Za-z '&/,-]{2,40}$/.test(rest[0]) && !/[.!?]$/.test(rest[0])) {
      category = rest[0];
      rest = rest.slice(1);
    }
    const seenHref = new Set();
    const grid = [];
    for (const a of tiles()) {
      const href = a.getAttribute('href');
      if (a.closest('header') || seenHref.has(href)) continue;
      seenHref.add(href);
      grid.push({
        href,
        alt: a.querySelector('img')?.getAttribute('alt') || '',
        pinned: !!a.querySelector('svg[aria-label*="inned" i]') || /pinned/i.test(a.getAttribute('aria-label') || ''),
      });
    }
    if (!fullName && !rest.length && !followers && !postsCount) return { state: 'unknown' };
    return {
      state: 'ok',
      info: {
        handle,
        fullName,
        category,
        website,
        business: business || !!category,
        private: /this account is private/i.test(mainText()),
        postsCount,
        followers,
        bio: rest.join('\n').slice(0, 600),
      },
      tiles: grid.slice(0, 12),
    };
  }

  if (action === 'post') {
    await waitFor(() => blocked() || loggedOut() || notFound() || document.querySelector('article time[datetime], article h1'), 10000);
    dismiss();
    const s = stop();
    if (s) return s;
    const article = document.querySelector('article') || document.body;
    const date = article.querySelector('time[datetime]')?.getAttribute('datetime') || '';
    let caption = article.querySelector('h1') ? label(article.querySelector('h1')) : '';
    if (!caption) {
      const og = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const m = og.match(/:\s*["“]([\s\S]*)["”]\.?\s*$/);
      caption = m ? m[1] : '';
    }
    const place = [...article.querySelectorAll('a[href*="/explore/locations/"]')].map((a) => label(a)).find(Boolean) || '';
    const own = [...article.querySelectorAll('header a[href^="/"]')]
      .map((a) => a.getAttribute('href'))
      .find((href) => /^\/[A-Za-z0-9._]+\/$/.test(href) && !/^\/(explore|p|reel|reels|stories|accounts|direct)\/$/.test(href));
    return { state: 'ok', date, caption: caption.slice(0, 800), location: place, author: own ? own.slice(1, -1).toLowerCase() : '' };
  }

  throw new Error(`Unknown find step: ${action}`);
}
