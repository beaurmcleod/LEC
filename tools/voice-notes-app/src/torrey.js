// torreylabs.store's own database (Lovable Cloud, a Supabase project). The app only ever writes partner
// invites: a row in affiliate_invites that reserves a referral code and rate for whoever opens the invite
// link first. The key lives in Setup, never in the code.
import { inviteToken } from './replies.js';

function headers(cfg) {
  const key = String(cfg.key || '').trim();
  const h = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy keys are JWTs and go in both headers; the newer sb_secret_ keys only go in apikey.
  if (!key.startsWith('sb_')) h.Authorization = `Bearer ${key}`;
  return h;
}

const rest = (cfg, path) => `${String(cfg.url || '').trim().replace(/\/+$/, '')}/rest/v1/${path}`;

function plainError(status, body) {
  const msg = body?.message || body?.hint || '';
  if (status === 401 || status === 403) return "Torrey Labs Cloud didn't accept the key. In Lovable, open the project's Cloud settings and copy the service role key into Setup.";
  if (status === 404) return "That URL has no affiliate_invites table. Check the Torrey Labs Cloud URL in Setup (it looks like https://xxxx.supabase.co).";
  return msg || `Torrey Labs Cloud said HTTP ${status}`;
}

async function call(cfg, path, init = {}) {
  let res;
  try {
    res = await fetch(rest(cfg, path), { ...init, headers: { ...headers(cfg), ...init.headers } });
  } catch (e) {
    throw new Error(`Couldn't reach Torrey Labs Cloud (${e.cause?.code || e.message}).`);
  }
  const body = await res.json().catch(() => null);
  return { res, body };
}

// Reserves a code for the lead: tries each candidate until one isn't taken. Returns { code, token }.
export async function createInvite(cfg, { candidates, label = '', rate = 0.2, token = inviteToken() }) {
  let taken = [];
  for (const code of candidates) {
    const { res, body } = await call(cfg, 'affiliate_invites', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ token, referral_code: code, commission_rate: rate, label }),
    });
    if (res.status === 201) return { code, token };
    // 23505 is Postgres for "already exists": the code belongs to someone, so try the next one.
    if (res.status === 409 || body?.code === '23505') {
      taken.push(code);
      continue;
    }
    throw new Error(plainError(res.status, body));
  }
  throw new Error(`Every code the app tried is taken (${taken.join(', ')}). Set one by hand in Airtable's Partner code and try again.`);
}

// Setup's Test button: can the key see the invites table?
export async function testTorrey(cfg) {
  const { res, body } = await call(cfg, 'affiliate_invites?select=token,claimed_at&limit=100', { headers: { Prefer: 'count=exact' } });
  if (!res.ok) throw new Error(plainError(res.status, body));
  const rows = Array.isArray(body) ? body : [];
  const claimed = rows.filter((r) => r.claimed_at).length;
  return { invites: rows.length, claimed };
}
