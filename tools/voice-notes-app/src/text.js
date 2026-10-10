// Text that goes out in a request (to Claude, Airtable, ElevenLabs, the store) has to be well-formed Unicode.
// Cutting a string with .slice() can split an emoji in two, and a lone half of one is rejected by the other end
// ("unexpected end of hex escape"). These keep every cut and every body clean.

// A lone half of an emoji (a surrogate with no partner) becomes the replacement character.
export const wellFormed = (s) => String(s ?? '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');

// The first `n` characters, never ending in the middle of an emoji.
export function clip(s, n) {
  const t = String(s ?? '');
  if (t.length <= n) return t;
  const cut = /[\uD800-\uDBFF]/.test(t[n - 1]) ? n - 1 : n;
  return t.slice(0, cut);
}

// JSON.stringify for a request body: every string in it made well-formed.
export const safeJson = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'string' ? wellFormed(x) : x));

// A value with every string in it made well-formed (for requests built by an SDK).
export function deepWellFormed(v) {
  if (typeof v === 'string') return wellFormed(v);
  if (Array.isArray(v)) return v.map(deepWellFormed);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepWellFormed(x)]));
  return v;
}
