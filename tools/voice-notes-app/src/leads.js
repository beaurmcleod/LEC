const CATEGORY_PHRASES = {
  'Personal trainer': 'personal training',
  'Physical therapy': 'physical therapy',
  Chiropractor: 'chiropractic care',
  'Sports medicine': 'sports medicine',
  'Recovery studio': 'recovery work',
  'Gym / CrossFit': 'strength training',
  'Med spa': 'med spa treatments',
  'IV / wellness clinic': 'IV and wellness therapy',
  'Nutrition / coach': 'nutrition coaching',
  'Athlete / creator': 'training content',
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function cleanHandle(raw) {
  const s = String(raw || '').trim();
  const url = s.match(/instagram\.com\/([^/?#\s]+)/i);
  return (url ? url[1] : s).replace(/^@/, '').replace(/\/+$/, '').trim();
}

// Title Case that leaves "Joe's" alone.
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/&(])(\p{L})/gu, (m, a, c) => a + c.toUpperCase());

function tidyBusiness(b) {
  let s = b.split(/\s+[-|•:–—]\s+/)[0].trim();
  if (s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s)) s = titleCase(s);
  return s;
}

// A business name the way you'd say it: no shouting caps, tagline or legal suffix.
export function spokenBusiness(b) {
  return tidyBusiness(String(b || ''))
    .replace(/,?\s+(llc|l\.l\.c\.|inc\.?|corp\.?|ltd\.?|pllc|pc)$/i, '')
    .trim();
}

// A role the way you'd say it mid-sentence: "Studio owner" -> "studio owner". Acronyms like CEO or DPT stay.
export function spokenRole(r) {
  return String(r || '')
    .trim()
    .replace(/^(the|a|an)\s+/i, '')
    .split(/([\s\-/]+)/)
    .map((w) => (/^\p{Lu}\p{Ll}+$/u.test(w) ? w.toLowerCase() : w))
    .join('')
    .replace(/[.\s]+$/, '');
}

// A first name the way you'd say it: "JOHN" -> "John".
export function spokenName(n) {
  const s = String(n || '').trim();
  return s.length > 1 && s === s.toUpperCase() && /\p{L}/u.test(s) ? titleCase(s) : s;
}

// Who they are, in the plural, for "a lot of ___ ask us...". Keyed by the Airtable Category.
const CROWDS = {
  'personal trainer': 'trainers',
  'gym / crossfit': 'gym owners',
  'recovery studio': 'recovery studios',
  'iv / wellness clinic': 'wellness clinics',
  'med spa': 'med spas',
  chiropractor: 'chiropractors',
  'physical therapy': 'physical therapists',
  'sports medicine': 'sports medicine docs',
  'nutrition / coach': 'coaches',
  'athlete / creator': 'athletes',
};

// With no Category (or "Other"), a guess from their role, then their business name.
const CROWD_GUESSES = [
  [/\bdpt\b|physical therap/i, 'physical therapists'],
  [/chiro/i, 'chiropractors'],
  [/med ?spa|aesthetic/i, 'med spas'],
  [/\biv\b|infusion/i, 'wellness clinics'],
  [/trainer/i, 'trainers'],
  [/coach|instructor|teacher/i, 'coaches'],
  [/recover|sauna|cryo|float|stretch/i, 'recovery studios'],
  [/crossfit|\bgym\b|boxing|jiu.?jitsu|\bbjj\b|martial|muay/i, 'gym owners'],
  [/pilates|yoga|barre|spin|cycl|studio/i, 'studio owners'],
];

export function crowd(category, role = '', business = '') {
  const c = CROWDS[String(category || '').toLowerCase().replace(/\s*\/\s*/g, ' / ').trim()];
  if (c === 'gym owners' && /coach|trainer/i.test(role)) return 'coaches';
  if (c) return c;
  for (const text of [role, business]) for (const [re, who] of CROWD_GUESSES) if (re.test(text)) return who;
  return /owner|founder/i.test(role) ? 'studio owners' : 'people in your world';
}

const MONTHS = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const PASSIVE = /^(named|voted|featured|recognized|ranked|awarded|listed|nominated|certified|called|chosen|picked|rated)$/;
const PAST = /^(\w+ed|took|ran|won|made|got|built|began|became|grew|brought|taught|left|went|spent|hit|launched)$/;
const PRESENT = /^(runs|hosts|brings|offers|blends|pairs|trains|teaches|owns|co-owns|coaches|leads|operates|specializes|focuses|works|holds|keeps|makes|gives|helps|builds|serves|combines|mixes|programs|competes|fights|opens|puts)$/;

// "runs" -> "run", "teaches" -> "teach", "has" -> "have".
function baseVerb(v) {
  const w = v.toLowerCase();
  if (w === 'has') return 'have';
  if (w === 'is') return 'are';
  if (w === 'was') return 'were';
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ch|sh|ss|x|z|o)es$/.test(w)) return w.slice(0, -2);
  return w.replace(/s$/, '');
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Just the first point of a detail, so the whole intro stays one short sentence: stops at "plus", a dash,
// a semicolon or an aside ("— that's a long run"). A detail still over 12 words stops at its first comma
// or "and" after the fifth word.
const MAX_DETAIL_WORDS = 12;
function firstPoint(s) {
  let out = s.split(/(?<=[.!?])\s+/)[0].split(/\s+(?:plus|[—–-])\s+|;\s+|,\s+(?:plus|which|that's|so that)\s+/i)[0];
  const words = out.split(' ');
  if (words.length > MAX_DETAIL_WORDS) {
    const cut = words.findIndex((w, i) => i >= 5 && (/,$/.test(w) || /^and$/i.test(words[i + 1] || '')));
    if (cut > 0) out = words.slice(0, cut + 1).join(' ');
  }
  return out.replace(/[\s.!?;:,]+$/, '');
}
const yours = (s) => s.replace(/\b(their|his|her|its)\b/gi, 'your').replace(/\bthey're\b/gi, "you're");

// The Airtable "Personal hook" (one real detail, written as a note about them) said to them, as the start of
// a sentence (no end punctuation):
// "Runs a weekly beach workout" -> "saw you run a weekly beach workout"
// "being named Best Oceanside Trainer" -> "saw you got named Best Oceanside Trainer"
// "your 200-hour yoga teacher training" -> "saw your 200-hour yoga teacher training"
export function spokenHook(raw, name = '') {
  let s = String(raw || '')
    .replace(/\s*(\([^)]*\)|\[[^\]]*\])/g, '')
    .replace(/\b(that|you|they)(s|ve|re)\b/gi, "$1'$2")
    .replace(/\by(a)ll\b/gi, "y'$1ll")
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => `${MONTHS[+mo - 1] || mo} ${+d}`)
    .replace(/\s+/g, ' ')
    .trim();
  s = firstPoint(s);
  if (!s) return '';
  const words = s.split(' ');
  const first = words[0].toLowerCase();
  const from = (i) => words.slice(i).join(' ');
  const said = (verb, i) => {
    const v = verb.toLowerCase();
    if (v === 'is') return `saw you're ${yours(from(i))}`;
    if (v === 'was') return `saw you were ${yours(from(i))}`;
    if (v === 'has') return `saw you${/(ed|en|un|wn|ght)$/.test(words[i] || '') ? "'ve" : ' have'} ${yours(from(i))}`;
    return `saw you ${baseVerb(v)} ${yours(from(i))}`;
  };
  // Notes that name the lead ("Maya runs a gym", "founder Estella has taught", "Leah, the founder, is")
  // are said to them: "saw you run a gym".
  const names = String(name).toLowerCase().split(/[^\p{L}']+/u).filter((n) => n.length > 1 && n !== 'and');
  const bare = (w) => (w || '').toLowerCase().replace(/[,.]$/, '');
  let at = /^(founder|co-founder|owner|co-owner|coach)$/i.test(words[0]) ? 1 : 0;
  if (names.includes(bare(words[at]).replace(/'s$/, ''))) {
    if (/'s$/.test(bare(words[at]))) return `saw your ${yours(from(at + 1))}`;
    if (/,$/.test(words[at])) while (++at < words.length && !/,$/.test(words[at]));
    if (words[at + 1]) return said(words[at + 1], at + 2).replace(/\s+/g, ' ').trim();
  }
  const line = (() => {
    if (/^(saw|loved?|congrats|huge)$/.test(first)) return lowerFirst(s);
    if (/^(you|you've|you're|y'all)$/.test(first))
      return `saw ${lowerFirst(s)}`;
    if (/^(your|the|that|this|those|these|our)$/.test(first)) return `saw ${s}`;
    if (/^(their|his|her)$/.test(first)) return `saw your ${from(1)}`;
    if (/^(she|he|they)$/.test(first) && words[1]) return `saw you ${baseVerb(words[1])} ${yours(from(2))}`;
    if (/^(former|ex-)/.test(first)) return `saw you're a ${lowerFirst(s)}`;
    if (/^(first|only)$/.test(first)) return `saw you're the ${lowerFirst(s)}`;
    if (/^(a|one|two|three|four|five|six|seven|eight|nine|ten|\d+\+?)$/.test(first) && /^(years?|decades?)$/i.test(words[1] || '')) {
      if (/^of$/i.test(words[2] || '')) return `saw your ${s}`;
      if (/^into$/i.test(words[2] || '')) return `saw you're ${s}`;
      return `saw you spent ${s}`;
    }
    if (words.slice(1, 4).some((w) => /^who$/i.test(w))) return `saw you're a ${s}`;
    // No subject: it's about them, so it becomes "you ...".
    const adv = /^(just|recently|also|still|now)$/.test(first) ? 1 : 0;
    const verb = (words[adv] || '').toLowerCase();
    // "Earned Fitness SD won..." is a name, not a verb ("Hosts Workout Wednesdays" still is one).
    const known = PRESENT.test(verb) || PASSIVE.test(verb) || /^(being|has|was|is)$/.test(verb);
    if (!known && /^\p{Lu}/u.test(words[adv] || '') && /^\p{Lu}/u.test(words[adv + 1] || '')) return `saw ${s}`;
    const pre = adv ? `${first} ` : '';
    const rest = yours(from(adv + 1));
    if (verb === 'being') return `saw you got ${pre}${rest}`;
    if (verb === 'founded' && /^by$/i.test(words[adv + 1] || '')) return `saw it was ${pre}founded ${from(adv + 1)}`;
    if (PASSIVE.test(verb)) return `saw you were ${pre}${verb} ${rest}`;
    if (verb === 'was' || verb === 'is') return `saw you ${baseVerb(verb)} ${pre}${rest}`.replace(/^saw you are /, "saw you're ");
    if (verb === 'has') return `saw you${/(ed|en|un|wn|ght)$/.test(words[adv + 1] || '') ? "'ve" : ' have'} ${pre}${rest}`;
    if (/ing$/.test(verb) && verb.length > 4) {
      const since = /\b(since \d{4}|for \d+\+? years)\b/i.test(s);
      return `saw you${since ? "'ve been" : "'re"} ${pre}${verb} ${rest}`;
    }
    if (PRESENT.test(verb)) return `saw you ${pre}${baseVerb(verb)} ${rest}`;
    if (PAST.test(verb)) return `saw you ${pre}${verb} ${rest}`;
    return `saw ${s}`;
  })();
  return line.replace(/\s+/g, ' ').trim();
}

// The line in the Airtable "Bridge" (the DM sent after the joke lands) that reacts to something about them:
// "ha, you're a good sport. Bankers Hill's lucky to have that red facade on Grape Street." -> the second
// sentence, without its period. Used when a lead has no Personal hook.
export function spokenBridge(raw) {
  const first = String(raw || '').split(/\n\s*\n/)[0].trim();
  const said = first.split(/(?<=[.!?])\s+/).find(
    (x) =>
      !/^(ha|haha|lol|appreciate you|thanks for|glad|good one|you're a good sport)\b/i.test(x) &&
      !/speaking of|real reason|torrey|peptide|\b(i'?m|we|our|us)\b|cool if|mind if|partner|link|\d+%|order|lab report|question/i.test(x),
  );
  return said ? firstPoint(said.replace(/\s+/g, ' ').trim()) : '';
}

export function deriveName(p) {
  return (p.first || '').trim() || (p.business ? tidyBusiness(p.business) : '') || p.handle || '';
}

// A short phrase that reads naturally after "I see you do ...".
export function deriveNote(p) {
  if (CATEGORY_PHRASES[p.category]) return CATEGORY_PHRASES[p.category];
  const search = (p.notes || '').match(/found via search '([^']+)'/i);
  if (!search) return '';
  return search[1]
    .trim()
    .replace(/\bpersonal trainer\b/i, 'personal training')
    .replace(/\bchiropractor\b/i, 'chiropractic care')
    .replace(/\s+(gym|studio|clinic|center|centre|shop)$/i, '');
}

export function makeProspect(f) {
  const p = {
    id: uid(),
    airtableId: f.airtableId || '',
    first: f.first || '',
    role: f.role || '',
    business: f.business || '',
    handle: cleanHandle(f.handle),
    category: f.category || '',
    hook: f.hook || '',
    bridge: f.bridge || '',
    bio: f.bio || '',
    research: f.research || '',
    notes: f.notes || '',
    source: f.source || 'manual',
    atStatus: f.atStatus || '',
    followedAt: f.followedAt || '',
    status: 'todo',
    sentAt: null,
    createdAt: Date.now(),
  };
  p.name = f.name || deriveName(p);
  p.note = f.note || deriveNote(p);
  return p;
}

function pick(obj, ...names) {
  const lower = {};
  for (const k of Object.keys(obj)) lower[k.trim().toLowerCase()] = obj[k];
  for (const n of names) {
    const v = lower[n];
    const s = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v).trim();
    if (s) return s;
  }
  return '';
}

// Column names match the Torrey Labs "Leads" table, so an Airtable CSV export imports as-is.
export function fromFields(obj, extra = {}) {
  return makeProspect({
    ...extra,
    first: pick(obj, 'first name', 'first'),
    role: pick(obj, 'role', 'position', 'title', 'job title'),
    business: pick(obj, 'business', 'business name', 'company', 'name'),
    handle: pick(obj, 'instagram', 'instagram handle', 'handle', 'ig', 'username', 'instagram url', 'ig url'),
    category: pick(obj, 'category'),
    hook: pick(obj, 'personal hook', 'hook'),
    bridge: pick(obj, 'bridge'),
    bio: pick(obj, 'ig bio', 'bio'),
    research: pick(obj, 'research'),
    notes: pick(obj, 'notes'),
    note: pick(obj, 'what they do', 'specialty', 'note'),
    name: pick(obj, 'name to say', 'spoken name'),
    atStatus: pick(obj, 'status'),
    followedAt: pick(obj, 'ig followed at'),
  });
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export function fromCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ''));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .map((r) => fromFields(Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])), { source: 'csv' }))
    .filter((p) => p.handle || p.business || p.first);
}

// Airtable's error codes, in words that say what to fix.
function airtableError(body, status) {
  const e = body?.error;
  const type = typeof e === 'string' ? e : e?.type || '';
  const msg = typeof e === 'object' && e?.message ? e.message : '';
  if (status === 401 || type === 'AUTHENTICATION_REQUIRED')
    return "Airtable didn't accept the token. Make a new one at airtable.com/create/tokens and paste it in Setup.";
  if (/FILTER_BY_FORMULA/.test(type)) return `The "Which leads to pull" formula in Setup has a mistake: ${msg || type}`;
  if (/UNKNOWN_FIELD_NAME/.test(type)) return `Airtable doesn't have a field the app asked for: ${msg || type}`;
  if (status === 403 || status === 404 || /PERMISSIONS|NOT_FOUND/.test(type))
    return "The token can't open the Leads table. When you make the token, add both scopes (data.records:read and data.records:write) and add the Torrey Labs base under Access. Also check Base ID and Table in Setup.";
  return msg || type || `HTTP ${status}`;
}

// One Airtable request, with network failures and error replies turned into plain messages.
async function call(url, init = {}, at) {
  let res;
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${String(at.token || '').trim()}`, ...init.headers } });
  } catch (e) {
    throw new Error(`Couldn't reach Airtable (${e.cause?.code || e.message}). Check the internet connection.`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(airtableError(body, res.status));
  return body;
}

// AIRTABLE_API lets tests point the app at a local stand-in.
const AIRTABLE_API = globalThis.process?.env?.AIRTABLE_API || 'https://api.airtable.com/v0';

function tableUrl({ baseId, table }) {
  return `${AIRTABLE_API}/${encodeURIComponent(String(baseId).trim())}/${encodeURIComponent(String(table).trim())}`;
}

export async function pullAirtable(at) {
  const out = [];
  let offset = '';
  do {
    const url = new URL(tableUrl(at));
    url.searchParams.set('pageSize', '100');
    if (at.formula) url.searchParams.set('filterByFormula', at.formula);
    if (offset) url.searchParams.set('offset', offset);
    const body = await call(url, {}, at);
    for (const r of body.records || []) {
      if (out.length >= at.max) break;
      out.push(fromFields(r.fields || {}, { airtableId: r.id, source: 'airtable' }));
    }
    offset = body.offset;
  } while (offset && out.length < at.max);
  return out;
}

async function patch(at, recordId, fields) {
  await call(
    `${tableUrl(at)}/${encodeURIComponent(recordId)}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) },
    at,
  );
}

export function markSentAirtable(at, recordId) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return patch(at, recordId, { Status: 'Sent', Channel: 'Instagram', 'Sent at': today, Touches: 1 });
}

// Leads still to follow: not skipped, not followed yet, and not already messaged.
export const FOLLOW_FORMULA =
  "AND({Instagram}!='', {Track}!='Skip', {IG followed at}='', OR({Status}='New', {Status}='Researched', {Status}='Ready'))";

// Best fits first. Pages through until it finds `want` accounts that aren't in `skip`.
export async function pullFollowQueue(at, { skip = {}, want = 5 } = {}) {
  const out = [];
  let offset = '';
  for (let page = 0; page < 5 && out.length < want; page++) {
    const url = new URL(tableUrl(at));
    url.searchParams.set('pageSize', '25');
    url.searchParams.set('filterByFormula', FOLLOW_FORMULA);
    url.searchParams.set('sort[0][field]', 'Fit score');
    url.searchParams.set('sort[0][direction]', 'desc');
    for (const f of ['Instagram', 'DM name', 'Category', 'Fit score']) url.searchParams.append('fields[]', f);
    if (offset) url.searchParams.set('offset', offset);
    const body = await call(url, {}, at);
    for (const r of body.records || []) {
      const f = r.fields || {};
      const handle = cleanHandle(f.Instagram);
      if (handle && !skip[r.id] && out.length < want) out.push({ id: r.id, handle, name: f['DM name'] || '', category: f.Category || '', fit: f['Fit score'] ?? null });
    }
    offset = body.offset;
    if (!offset) break;
  }
  return out;
}

export function markFollowedAirtable(at, recordId, liked, when = new Date()) {
  return patch(at, recordId, { 'IG followed at': when.toISOString(), 'IG liked': !!liked });
}
