// Replies to voice notes: reading what a lead wrote back, their partner code and invite on torreylabs.store,
// and the message that goes out. Pure functions, so they can be tested without the app.

// torreylabs.store's own rules for a referral code (the bit after ?ref=): 4 to 25 letters, digits or single
// dashes, starting and ending with a letter or digit, not a reserved word, not a TL- or CR- prefix.
const RESERVED = new Set([
  'ADMIN', 'TORREY', 'TORREYLABS', 'SUPPORT', 'OFFICIAL', 'TEAM', 'STAFF', 'TEST', 'NULL',
  'UNDEFINED', 'SALE', 'FREE', 'WHOLESALE', 'AFFILIATE', 'STORE', 'SHOP',
]);
export const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,23}[A-Z0-9]$/;
export const validCode = (c) => CODE_RE.test(c) && !c.includes('--') && !RESERVED.has(c) && !/^(TL|CR)-/.test(c);

const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// The codes to try for a lead, best first: their first name, their business ("Hot Haven" -> HOTHAVEN), their
// handle, then the same with two digits. The store keeps codes unique, so the app tries the next one on a clash.
export function codeCandidates(p, digits = () => String(10 + Math.floor(Math.random() * 90))) {
  const biz = letters(String(p.business || '').split(/\s+[-|•:–—]\s+/)[0]);
  const first = letters(p.first || (p.name !== p.business ? p.name : ''));
  const handle = letters(p.handle);
  const bases = [first, biz, handle].filter((c) => c.length >= 4 && c.length <= 25);
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

// The message with their code and how to get set up, when the model isn't configured. Personal enough to send.
export function fallbackMessage(p, { code, invite, link, from = 'Garrett', percent = 20 }) {
  const name = p.first || '';
  const biz = p.business && p.business !== p.name ? p.business : '';
  const hey = name ? `${name}, ` : '';
  const yours = biz ? ` for ${biz}` : '';
  return [
    `${hey}love it. I set up your partner code${yours}: ${code}`,
    `Here's how it works: anyone who uses your link gets ${percent}% off their first order, and you get ${percent}% of everything they order, for life. Link to share: ${link}`,
    `Your portal (your link, a QR code, and every referral and payout): ${invite} — make your account with your email and your code is already on it.`,
    `Any questions, just ask. ${from}`,
  ].join('\n\n');
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

// What the model is asked to do with a reply. Returns { system, user, schema } for a structured answer.
export function replyPrompt(p, { text, history = [], from = 'Garrett', percent = 20, site = 'https://torreylabs.store' }) {
  const { code, invite, link } = SLOTS;
  const facts = [
    `Lead: ${p.first || p.name || 'unknown first name'}${p.business ? `, ${p.business}` : ''}${p.role ? ` (${p.role})` : ''}${p.category ? `, ${p.category}` : ''}, Instagram @${p.handle}.`,
    p.hook ? `Something true about them from research: ${p.hook}` : '',
    p.bio ? `Their Instagram bio: ${p.bio.slice(0, 300)}` : '',
  ].filter(Boolean);
  const convo = history.length ? `Earlier messages in the thread (newest last):\n${history.map((m) => `${m.mine ? from : 'Them'}: ${m.text}`).join('\n')}` : '';
  return {
    system: `You are ${from}, who runs Torrey Labs, a small San Diego research-peptide supplier. You sent this person a short Instagram voice note pitching a partner deal, and they just replied. Write back the way ${from} texts: warm, quick, plain words, no hype, no emojis, no bullet points, no subject line, no sign-off block. Two to five short sentences unless the answer needs more. Never invent facts about Torrey Labs beyond these:
- Every product has an independent lab report, published by lot number, that anyone can read at ${site} without an account.
- The store is invite-only.
- Partner deal: they get their own link. Anyone who uses it gets ${percent}% off their first order, and the partner earns ${percent}% of everything that customer orders, for life, on the item subtotal. Payouts are cash after 14 days, or store credit right away at a 25% bonus.
- Their partner portal shows their link, a QR code, every referral, and payouts. They sign up with their email at the invite link and their code is already set.
- Products are for laboratory research use only, not for human or animal use, and nothing is medical advice. If they ask about dosing, effects, or use on people, say plainly that you can't advise on that and point them to the published lab reports and the learn page instead.
- Pricing is only visible inside the store; don't quote prices.
If they ask something you can't answer from these facts, say you'll find out and get back to them rather than guessing.

Decide the intent of their reply:
- "yes": they want in, or are clearly asking for the link or code. Your reply must include, written exactly as these placeholders, their partner code ${code}, their share link ${link}, and their portal invite ${invite}, worked in naturally. The app fills them in.
- "no": they're declining. Reply with one gracious sentence, no pitch.
- "question": they asked something before deciding. Answer it, then invite them to say the word and you'll send their code. Do not include the code or links yet.
- "unclear": you can't tell what they mean (a laugh, an emoji, a "who is this"). Reply naturally and briefly to move it forward.`,
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
