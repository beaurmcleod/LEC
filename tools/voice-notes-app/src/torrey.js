// torreylabs.store's partner-invite endpoint (POST /api/affiliate/invite on the store's own site). It can only
// create a partner invite (a referral code and rate, held for whoever opens the invite link first) and read two
// counts, so the key for it can do nothing else on the store. The key lives in Setup, never in the code.

// The store's address as typed in Setup, with https:// added when it was left off.
import { safeJson } from './text.js';

const base = (cfg) => {
  const s = String(cfg.site || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
const endpoint = (cfg) => `${base(cfg)}/api/affiliate/invite`;
const host = (cfg) => String(cfg.site || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'the store';

function plainError(cfg, status, body) {
  const said = typeof body?.error === 'string' ? body.error : '';
  if (status === 401) return `${host(cfg)} didn't accept the invite key. The key in Setup has to be the same one Lovable has as AFFILIATE_INVITE_KEY.`;
  if (status === 404) return `${host(cfg)} has no invite endpoint yet. Publish the latest store version in Lovable, and check the store address in Setup.`;
  if (status === 500 && /not configured/i.test(said)) return 'The store has no AFFILIATE_INVITE_KEY secret yet. Add it in Lovable (the same key as in Setup).';
  if (status === 429) return `${host(cfg)} says too many invites were made today. Try again tomorrow.`;
  if (status === 400) return `${host(cfg)} didn't accept the request (${said || 'invalid'}). Update the app and try again.`;
  return said || `${host(cfg)} said HTTP ${status}`;
}

async function call(cfg, payload) {
  let res;
  try {
    res = await fetch(endpoint(cfg), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJson({ key: String(cfg.key || '').trim(), ...payload }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`Couldn't reach ${host(cfg)} (${e.name === 'TimeoutError' ? 'timed out' : e.cause?.code || e.message}).`);
  }
  const body = await res.json().catch(() => null);
  return { res, body };
}

// Reserves a code for the lead: the store tries each candidate in order and skips the ones that are taken or not
// allowed (an existing partner's code, a reserved word). Asking again with the same label gives back the same
// invite, so a retry never makes a second one. Returns { code, token }.
export async function createInvite(cfg, { candidates, label = '', rate = 0.2 }) {
  const { res, body } = await call(cfg, { action: 'issue', candidates: candidates.slice(0, 8), label: String(label).slice(0, 160), rate });
  if (res.ok && body?.ok && body.code && body.token) return { code: body.code, token: body.token };
  if (res.status === 409 && body?.error === 'all_taken') {
    const tried = [...(body.taken || []), ...(body.invalid || [])];
    throw new Error(`Every code the app tried is taken or not allowed (${tried.join(', ')}). Set one by hand in Airtable's Partner code and try again.`);
  }
  throw new Error(plainError(cfg, res.status, body));
}

// Setup's Test button: does the store accept the key?
export async function testTorrey(cfg) {
  const { res, body } = await call(cfg, { action: 'status' });
  if (!res.ok || !body?.ok) throw new Error(plainError(cfg, res.status, body));
  return { invites: Number(body.invites) || 0, claimed: Number(body.claimed) || 0 };
}
