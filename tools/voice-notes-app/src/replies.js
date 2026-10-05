// Replies to voice notes: reading what a lead wrote back, their partner code and invite on torreylabs.store,
// and the message that goes out. Pure functions, so they can be tested without the app.
import { kind } from './leads.js';
import { clip } from './text.js';

// torreylabs.store's own rules for a referral code (the bit after ?ref=): 4 to 25 letters, digits or single
// dashes, starting and ending with a letter or digit, not a reserved word, not a TL- or CR- prefix.
const RESERVED = new Set([
  'ADMIN', 'TORREY', 'TORREYLABS', 'SUPPORT', 'OFFICIAL', 'TEAM', 'STAFF', 'TEST', 'NULL',
  'UNDEFINED', 'SALE', 'FREE', 'WHOLESALE', 'AFFILIATE', 'STORE', 'SHOP',
]);
export const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,23}[A-Z0-9]$/;
export const validCode = (c) => CODE_RE.test(c) && !c.includes('--') && !RESERVED.has(c) && !/^(TL|CR)-/.test(c);

const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Words that say what kind of place it is rather than which one: dropped from a business name to make its code.
const FILLER = new Set([
  'THE', 'AND', 'OF', 'LLC', 'INC', 'CO', 'COMPANY', 'STUDIO', 'STUDIOS', 'FITNESS', 'GYM', 'GYMS', 'TRAINING', 'PERSONAL',
  'PERFORMANCE', 'WELLNESS', 'RECOVERY', 'ATHLETICS', 'ATHLETIC', 'CLUB', 'CENTER', 'CENTRE', 'LAB', 'LABS', 'HEALTH',
  'COACHING', 'COLLECTIVE', 'SAUNA', 'SPA', 'MEDSPA', 'CLINIC', 'THERAPY', 'STRENGTH', 'CONDITIONING', 'SD', 'SAN', 'DIEGO',
]);

// A business name as a code: the part before any tagline ("HOT HAVEN - Sauna Studio" -> HOT HAVEN), without the
// words that only say what kind of place it is ("Electrum Performance" -> ELECTRUM), joined up. Keeps the full
// name when dropping those words would leave too little ("Fit Monkeys" -> FITMONKEYS).
export function businessCode(business) {
  const head = String(business || '').split(/\s+[-|•:–—]\s+|[,(]/)[0];
  const words = head.toUpperCase().replace(/&/g, ' AND ').replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !FILLER.has(w)).join('');
  const all = words.filter((w) => !['THE', 'LLC', 'INC'].includes(w)).join('');
  const code = core.length >= 4 ? core : all;
  return code.slice(0, 20);
}

// The codes to try for a lead, best first: their business ("Hot Haven" -> HOTHAVEN), their first name, their
// handle, then the same with two digits. The store keeps codes unique, so the app tries the next one on a clash.
export function codeCandidates(p, digits = () => String(10 + Math.floor(Math.random() * 90))) {
  const biz = p.business && p.business !== p.first ? businessCode(p.business) : '';
  const first = letters(p.first || (p.name !== p.business ? p.name : ''));
  const handle = letters(p.handle).slice(0, 20);
  const bases = [biz, first, handle].filter((c) => c.length >= 4 && c.length <= 25);
  const out = [];
  for (const c of bases) if (validCode(c) && !out.includes(c)) out.push(c);
  for (const c of bases) {
    const withDigits = (c.slice(0, 23) + digits()).slice(0, 25);
    if (validCode(withDigits) && !out.includes(withDigits)) out.push(withDigits);
  }
  if (!out.length) out.push(`PARTNER${digits()}${digits()}`);
  return out;
}

// No 0/O or 1/I, like the store's own tokens, so a code survives being read aloud.
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function inviteToken(random = Math.random) {
  let s = '';
  for (let i = 0; i < 12; i++) s += TOKEN_ALPHABET[Math.floor(random() * TOKEN_ALPHABET.length)];
  return `INV-${s}`;
}

export const inviteLink = (site, token) => `${site.replace(/\/+$/, '')}/affiliate-login?invite=${token}`;
export const partnerLink = (site, code) => `${site.replace(/\/+$/, '')}/?ref=${code}`;

// A quick read of a reply without the model: a plain yes or no. Anything else is 'unclear' (the model, or a
// draft for you). Kept strict on purpose: "yes but what does it cost" is not a plain yes.
export function quickIntent(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[!.…\s]+$/, '');
  if (/^(no|nope|nah|no thanks|no thank you|not interested|not for me|stop|unsubscribe|please stop|pass|i'?m good|im good|all good)$/.test(t)) return 'no';
  if (/^(yes|yeah|yea|yep|yup|sure|ok|okay|sounds good|let'?s do it|lets do it|i'?m in|im in|send it|send it over|set me up|go for it|absolutely|for sure|down|i'?m down|im down|hell yeah|let'?s go|lets go|interested|do it|yes please|sure thing|why not)( please)?$/.test(t)) return 'yes';
  return 'unclear';
}

// What they offer, in words that follow "your": their own "what they do" if the lead has one ("personal
// training"), otherwise the kind of place it is ("studio"). Used where the model isn't writing the message.
export function offerPhrase(p) {
  const note = String(p.note || '').trim();
  if (note) return note;
  const k = kind(p.category, p.role, p.business);
  return k === 'business' ? '' : k;
}

// The message with their code and how to get set up, when the model isn't configured. It has the same shape as
// the one the model writes: a yes from them, who we are, why them, how it works, their code and three steps, the
// delivery line, and an open door for questions.
export function fallbackMessage(p, { code, invite, link, from = 'Garrett', percent = 20, email = false }) {
  const name = String(p.first || '').trim();
  const biz = p.business && p.business !== name && p.business !== p.name ? p.business : '';
  const offer = offerPhrase(p);
  const fit = offer ? `, and your ${offer} community feels like a great fit` : ', and this feels like a great fit';
  return [
    email ? `Hi ${name || 'there'},` : '',
    `Definitely${name ? `, ${name}` : ''}! We're Torrey Labs, a San Diego research-peptide company. We're making lab-tested peptides more accessible and more affordable, with third-party testing on every batch. We're partnering with small businesses like ${biz || 'yours'}${fit}.`,
    `How it works: you share a simple code. Anyone who uses it gets ${percent}% off their first order, and you earn ${percent}% on every order they place, for life. Take it as cash, or as store credit worth 25% more.`,
    `I made you a code: ${code}\n1) Open ${invite} to set up your portal (the code's already on it)\n2) Share ${link} or tell people to use ${code}`,
    email
      ? `We also offer in-person delivery on larger orders, or pickup. Everything is for research use only. Any questions at any point, just ask!\n\n${from}\nTorrey Labs`
      : `We also offer in-person delivery on larger orders, or pickup. Everything is for research use only. Any questions at any point, just ask! – ${from}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// The lines that hand over a code, added to a draft you approve with "Send with code".
export function codeLines({ code, invite, link }) {
  return `Your partner code is ${code}. Share link: ${link}\n\nYour portal (link, QR code, referrals and payouts): ${invite} — make your account with your email and the code is already set.`;
}

// Where the real code, link and invite go in a drafted "yes" reply. They're filled in after the code is
// reserved on the store, so a clash never leaves a wrong code in a sent message.
export const SLOTS = { code: '{CODE}', link: '{LINK}', invite: '{INVITE}' };
export const fillSlots = (text, vals) => String(text || '').replaceAll(SLOTS.code, vals.code).replaceAll(SLOTS.link, vals.link).replaceAll(SLOTS.invite, vals.invite);
export const hasSlots = (text) => Object.values(SLOTS).some((s) => String(text || '').includes(s));

// ---------- Email replies ----------

// What the person wrote, without the thread they quoted under it ("On Thu, Oct 1 ... wrote:", "> ..." lines, Outlook's
// "From: / Sent:" block, "-----Original Message-----"). The quote header can wrap onto a second line.
export function stripQuoted(raw) {
  const t = String(raw ?? '').replace(/\r\n?/g, '\n');
  const marks = [
    /(^|\n)[ \t]*On\s[^\n]{3,200}(\n[^\n]{0,120})?\swrote:/i,
    /(^|\n)[ \t]*-{2,}\s*(Original Message|Forwarded message)\s*-{2,}/i,
    /(^|\n)[ \t]*From:[ \t]+[^\n]+\n[ \t]*(Sent|Date):/i,
    /(^|\n)[ \t]*>/,
  ];
  let cut = t.length;
  for (const re of marks) {
    const m = re.exec(t);
    if (m && m.index < cut) cut = m.index;
  }
  return t.slice(0, cut).trim();
}

// TL5b stores a reply as "<subject>\n\n<body>". Returns { subject, body } with the quoted thread already left out.
export function splitEmail(lastReply) {
  const t = String(lastReply ?? '').replace(/\r\n?/g, '\n').trim();
  const m = /^([^\n]*)\n\n([\s\S]*)$/.exec(t);
  return m ? { subject: m[1].trim(), body: stripQuoted(m[2]) } : { subject: '', body: stripQuoted(t) };
}

export const reSubject = (s) => (/^re:/i.test(String(s || '').trim()) ? String(s).trim() : `Re: ${String(s || '').trim() || 'your reply'}`);

// What the model is asked to do with a reply. Returns { system, user, schema } for a structured answer.
export function replyPrompt(p, { text, history = [], from = 'Garrett', percent = 20, site = 'https://torreylabs.store', channel = 'instagram', subject = '' }) {
  const { code, invite, link } = SLOTS;
  const email = channel === 'email';
  const signoff = email ? `"${from}" on its own line, with "Torrey Labs" under it` : `"– ${from}"`;
  const first = String(p.first || '').trim();
  const offer = offerPhrase(p);
  const facts = [
    `Lead: ${first || 'first name not known'}${p.business ? `, ${p.business}` : ''}${p.role ? ` (${p.role})` : ''}${p.category ? `, ${p.category}` : ''}${email ? `, email ${p.email}` : `, Instagram @${p.handle}`}.`,
    offer ? `What they offer (use this to be specific about them): ${offer}.` : '',
    p.hook ? `Something true about them from research: ${p.hook}` : '',
    p.bio ? `Their Instagram bio: ${clip(p.bio, 300)}` : '',
  ].filter(Boolean);
  const convo = history.length ? `Earlier messages in the thread (newest last):\n${history.map((m) => `${m.mine ? from : 'Them'}: ${m.text}`).join('\n')}` : '';
  return {
    system: `You are ${from}, who runs Torrey Labs, a small San Diego research-peptide company. ${email ? `You emailed this person${subject ? ` (subject: "${subject}")` : ''} about partnering, and they just replied by email. Write a short, warm email in plain text, the way ${from} writes: plain words, no hype, no emojis, no subject line. Start with a greeting line ("Hi <first name>," or "Hi there,") and end with the sign-off.` : `You sent this person a short Instagram voice note about partnering, and they just wrote back. Write the way ${from} texts: warm, quick, plain words, no hype, no emojis, no subject line.`} Never invent facts about Torrey Labs beyond these:
- Torrey Labs is a San Diego company making research peptides more accessible and more affordable. Every batch is third-party tested, and every product has an independent lab report, published by lot number, that anyone can read at ${site} without an account.
- The store is invite-only. We're looking to partner with small businesses.
- Partner deal: they get a simple code. Anyone who uses it gets ${percent}% off their first order, and the partner earns ${percent}% of everything that customer orders, for life, on the item subtotal. They can take it as cash (paid after 14 days) or as store credit, which is worth 25% more.
- Their partner portal shows their link, a QR code, every referral, and payouts. They sign up with their email at the invite link and their code is already set.
- We offer in-person delivery in San Diego on orders over a certain amount, or pickup. Don't quote the amount.
- Products are for laboratory research use only, not for human or animal use, and nothing is medical advice. Never make health, weight-loss, recovery or performance claims about the products. If they ask about dosing, effects, or use on people, say plainly that you can't advise on that and point them to the published lab reports.
- Pricing is only visible inside the store; don't quote prices.
If they ask something you can't answer from these facts, say you'll find out and get back to them rather than guessing.

First decide what their reply means:
- "yes": they're interested: they want in, or are asking for the details, link or code ("send the details", "sure", "tell me more").
- "question": they want more information first, or asked something ("what does it cost", "how does it work", "is this legit").
- "no": they're declining or asking you to stop.
- "unclear": you can't tell (a laugh, an emoji, "who is this").

Then write the reply. Make it personal: use their first name if you have it, name their business, and say one specific thing they offer, taken only from the lead facts above (never guess one). If none is given, keep it general rather than inventing it.

For "yes", write it in this shape, in your own natural words, about 110 to 140 words, with blank lines between the parts:
1. "Definitely, <first name>!" then who we are in one sentence (Torrey Labs, San Diego, research peptides, more accessible and more affordable, third-party tested on every batch), then that we're partnering with small businesses like <their business> and why their <what they offer> community is a good fit.
2. How it works: they share a simple code; anyone who uses it gets ${percent}% off their first order; they earn ${percent}% on every order, for life; cash or store credit worth 25% more.
3. "I made you a code: ${code}" followed by two numbered steps: 1) open ${invite} to set up your portal (the code's already on it) 2) share ${link} or tell people to use ${code}.
4. One line: in-person delivery on larger orders, or pickup; everything is for research use only; any questions at any point, just ask. Sign off ${signoff}.

For "question", answer their question first in one or two plain sentences using only the facts above, then give the same shape more briefly (skip the company intro), so they can start whenever they're ready.

For "no": one gracious sentence, no pitch, no code.

For "unclear": reply naturally and briefly (one to three sentences) to move it forward, without the code.

For "yes" and "question" the reply must contain, written exactly as these placeholders, their partner code ${code}, their share link ${link}, and their portal invite ${invite}. The app fills them in after the code is reserved. Never write a real code or link yourself.`,
    user: [...facts, convo, `Their reply just now: "${text}"`].filter(Boolean).join('\n\n'),
    schema: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: ['yes', 'no', 'question', 'unclear'] },
        reply: { type: 'string', description: `The message to send them, in ${from}'s voice.` },
        why: { type: 'string', description: 'One short line on why you read it that way.' },
      },
      required: ['intent', 'reply', 'why'],
      additionalProperties: false,
    },
  };
}

// ---------- The inbox: which unread rows are from leads ----------
const flat = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const hrefKey = (h) => String(h || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();

// The names a lead goes by, for telling their chat's own text apart from what they wrote.
// Instagram's read receipts under a message ("Seen", "Seen yesterday", "Seen 18h ago", "Delivered"): not something a lead wrote.
export const RECEIPT = /^(seen|sent|delivered)( (just now|yesterday|today|\d+ ?(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks)\.?( ago)?|(mon|tue|wed|thu|fri|sat|sun)[a-z]*( at \d{1,2}:\d{2} ?[ap]m)?|at \d{1,2}:\d{2} ?[ap]m))?$/i;
export const isReceipt = (m) => !m.voice && RECEIPT.test(String(m.text || '').trim());

export const leadNames = (p) => [p.business, p.name, p.first, p.handle].filter(Boolean);

// Is this inbox row (a display name, or the handle when they have no display name) that lead?
export function rowMatches(row, p, { firstName = true } = {}) {
  if (row.href && p.dm?.href && hrefKey(row.href) === hrefKey(p.dm.href)) return true;
  const n = flat(row.name);
  if (n.length < 3) return false;
  if (n === flat(p.handle)) return true;
  for (const c of [p.business, p.name]) {
    const f = flat(c);
    if (f.length < 3) continue;
    if (n === f) return true;
    if (Math.min(n.length, f.length) >= 6 && (n.includes(f) || f.includes(n))) return true;
  }
  const first = flat(p.first);
  return firstName && first.length >= 4 && n === first;
}

// To-do leads that have a chat in the inbox (we're already talking to them, say by hand), by name, handle or thread:
// each is worth one look at its own chat, which is opened from its profile, so it's surely theirs. A first name
// alone isn't enough here, and a lead is looked at again no sooner than every 6 hours.
export function talkPlan(rows, prospects, now = Date.now()) {
  const out = [];
  for (const row of rows) {
    if (!row.preview) continue;
    for (const p of prospects) {
      if (p.status !== 'todo' || !p.handle || !rowMatches(row, p, { firstName: false })) continue;
      if (p.talkCheckedAt && now - p.talkCheckedAt < 6 * 60 * 60 * 1000) continue;
      if (!out.some((x) => x.p === p)) out.push({ p, row });
    }
  }
  return out;
}

// From one look at the inbox: the sent leads whose chat should be read now, and what to remember so a message
// is looked at once. A row is worth reading when its last message is theirs and it's unread, or it's a message
// not seen before. The first look at a row that is read already just notes its message (old messages aren't
// acted on). `now` is passed in so this stays testable.
export function inboxPlan(rows, prospects, now = Date.now()) {
  const read = [];
  const note = [];
  let mine = 0;
  let unread = 0;
  for (const row of rows) {
    if (row.unread) unread++;
    const leads = prospects.filter((p) => p.status === 'sent' && p.handle && rowMatches(row, p));
    if (leads.length) mine++;
    if (row.last === 'ours' || !row.preview) continue;
    for (const p of leads) {
      const seen = p.inboxSeen;
      if (seen && seen.preview === row.preview) continue;
      if (p.inboxTryAt && now - p.inboxTryAt < 5 * 60 * 1000 && p.inboxTryPreview === row.preview) continue;
      if (row.unread || seen) read.push({ p, row });
      else note.push({ p, row });
    }
  }
  return { read, note, rows: rows.length, unread, mine };
}

// Airtable field names the app writes when a lead replies.
export const REPLY_FIELDS = {
  status: 'Status',
  lastReply: 'Last reply',
  received: 'Reply received',
  handled: 'Reply handled',
  suggested: 'Suggested reply',
  intent: 'Reply intent',
  code: 'Partner code',
  link: 'Partner link',
  invite: 'Invite link',
  codeSentAt: 'Code sent at',
};
