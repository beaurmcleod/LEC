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

function tidyBusiness(b) {
  let s = b.split(/\s+[-|•:–—]\s+/)[0].trim();
  if (s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
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
    business: f.business || '',
    handle: cleanHandle(f.handle),
    category: f.category || '',
    hook: f.hook || '',
    bio: f.bio || '',
    research: f.research || '',
    notes: f.notes || '',
    source: f.source || 'manual',
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
    business: pick(obj, 'business', 'business name', 'company', 'name'),
    handle: pick(obj, 'instagram', 'instagram handle', 'handle', 'ig', 'username', 'instagram url', 'ig url'),
    category: pick(obj, 'category'),
    hook: pick(obj, 'personal hook', 'hook'),
    bio: pick(obj, 'ig bio', 'bio'),
    research: pick(obj, 'research'),
    notes: pick(obj, 'notes'),
    note: pick(obj, 'what they do', 'specialty', 'note'),
    name: pick(obj, 'name to say', 'spoken name'),
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

function airtableError(body, status) {
  const e = body && body.error;
  if (!e) return `HTTP ${status}`;
  return typeof e === 'string' ? e : e.message || e.type || `HTTP ${status}`;
}

function tableUrl({ baseId, table }) {
  return `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;
}

export async function pullAirtable(at) {
  const out = [];
  let offset = '';
  do {
    const url = new URL(tableUrl(at));
    url.searchParams.set('pageSize', '100');
    if (at.formula) url.searchParams.set('filterByFormula', at.formula);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${at.token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(airtableError(body, res.status));
    for (const r of body.records || []) {
      if (out.length >= at.max) break;
      out.push(fromFields(r.fields || {}, { airtableId: r.id, source: 'airtable' }));
    }
    offset = body.offset;
  } while (offset && out.length < at.max);
  return out;
}

export async function markSentAirtable(at, recordId) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const res = await fetch(`${tableUrl(at)}/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${at.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { Status: 'Sent', Channel: 'Instagram', 'Sent at': today } }),
  });
  if (!res.ok) throw new Error(airtableError(await res.json().catch(() => ({})), res.status));
}
