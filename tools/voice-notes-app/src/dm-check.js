// Reading Instagram's DM inbox after a send, to tell whether the voice note really went out.
// The inbox shows one row per thread with the last message ("You sent a voice message. · 3d"), so a note that
// posted shows up there as a fresh row, and one that didn't doesn't. Pure functions, so they can be tested
// without the app.

const UNITS = { s: 1 / 60, sec: 1 / 60, m: 1, min: 1, h: 60, hr: 60, d: 1440, w: 10080 };

// How old the last message in a row is, in minutes, read from the end of its preview ("... · 3d", "... · now").
// null when there's no time to read.
export function ageMinutes(preview) {
  const t = String(preview || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (/(^|[^a-z0-9])(now|just now)[\s.·•]*$/.test(t)) return 0;
  const m = /(?:^|[^a-z0-9])(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|secs?|mins?|hrs?|s|m|h|d|w)[\s.·•]*$/.exec(t);
  if (!m) return null;
  const unit = m[2].replace(/^(seconds?|secs?)$/, 's').replace(/^(minutes?|mins?)$/, 'm').replace(/^(hours?|hrs?)$/, 'h').replace(/^days?$/, 'd').replace(/^weeks?$/, 'w');
  return Number(m[1]) * UNITS[unit];
}

const SENT_VOICE = /you sent a voice (message|clip|note)/i;
const REFUSED = /can'?t receive your message|couldn'?t send|failed to send|not delivered|wasn'?t sent|unable to send/i;
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const path = (h) => norm(h).replace(/\/+$/, '');

// What the inbox says about a send, comparing it with the inbox as it was just before. `after` and `before` are
// the rows from the inbox page ({ href, name, preview }). The lead's own row is found by the thread's address,
// then by the name shown; failing that, a note counts if exactly one row is a fresh voice note of ours that
// wasn't already one before the send (an earlier lead's note, a few minutes old, doesn't count).
// state: 'sent' (our voice note, moments ago), 'refused' (Instagram says it couldn't deliver), 'stale' (the
// lead's row has an old voice note of ours), 'other' (it says something else), 'missing' (no sign of it),
// 'unsure' (more than one new voice note) or 'empty' (no rows could be read).
export function judgeInbox(after, { href = '', names = [], before = [], maxMinutes = 10 } = {}) {
  const rows = after || [];
  if (!rows.length) return { state: 'empty', via: '', preview: '' };
  const read = (row, via) => {
    const preview = String(row.preview || '');
    const age = ageMinutes(preview);
    const base = { via, preview, age, name: row.name, href: row.href };
    if (REFUSED.test(preview)) return { ...base, state: 'refused' };
    if (SENT_VOICE.test(preview)) return { ...base, state: age !== null && age <= maxMinutes ? 'sent' : 'stale' };
    return { ...base, state: 'other' };
  };
  let row = href ? rows.find((t) => path(t.href) === path(href)) : null;
  let via = row ? 'address' : '';
  if (!row) {
    const want = names.map(norm).filter(Boolean);
    row = rows.find((t) => want.includes(norm(t.name)));
    if (row) via = 'name';
  }
  if (row) return read(row, via);

  // The lead's row wasn't found. Look for what changed since before.
  const was = new Map((before || []).map((t) => [path(t.href), read(t, '')]));
  const fresh = rows.map((t) => read(t, 'new')).filter((r) => {
    const prev = was.get(path(r.href));
    // Only what's fresh counts as the result of this send: an old refusal in some other thread is not.
    const recent = r.age !== null && r.age <= maxMinutes;
    return r.state === 'sent' ? prev?.state !== 'sent' : r.state === 'refused' ? recent && prev?.state !== 'refused' : false;
  });
  const sent = fresh.filter((r) => r.state === 'sent');
  const refused = fresh.filter((r) => r.state === 'refused');
  if (sent.length === 1) return sent[0];
  if (sent.length > 1) return { ...sent[0], state: 'unsure' };
  if (refused.length === 1) return refused[0];
  return { state: 'missing', via: '', preview: rows[0].preview || '' };
}
