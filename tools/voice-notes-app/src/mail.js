// Garrett's mailbox (garrett@torreylabshq.com): the app logs into it to read what leads write back and to send its answers.
// It signs in with a Gmail app password, kept in Setup and never in the code (IMAP to read, SMTP to send).
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { wellFormed } from './text.js';

const env = globalThis.process?.env || {};

// MAIL_SMTP_PORT lets tests point the app at a local stand-in.
function transport(cfg) {
  const port = Number(env.MAIL_SMTP_PORT);
  const where = port ? { host: env.MAIL_SMTP_HOST || '127.0.0.1', port, secure: false, ignoreTLS: true } : { host: 'smtp.gmail.com', port: 465, secure: true };
  return nodemailer.createTransport({
    ...where,
    auth: { user: String(cfg.user || '').trim(), pass: String(cfg.pass || '').replace(/\s+/g, '') },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

// MAIL_IMAP_PORT lets tests point the app at a local stand-in.
function imap(cfg) {
  const port = Number(env.MAIL_IMAP_PORT);
  const where = port ? { host: env.MAIL_SMTP_HOST || '127.0.0.1', port, secure: false, doSTARTTLS: false } : { host: 'imap.gmail.com', port: 993, secure: true };
  const client = new ImapFlow({
    ...where,
    auth: { user: String(cfg.user || '').trim(), pass: String(cfg.pass || '').replace(/\s+/g, '') },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
  });
  // A dropped connection reports here as well; the awaited call is what fails, so this only stops it being unhandled.
  client.on('error', () => {});
  return client;
}

function imapError(e) {
  const said = String(e?.responseText || e?.response || e?.message || '');
  if (e?.authenticationFailed || /authenticationfailed|invalid credentials|application-specific password/i.test(said)) return plainError({ code: 'EAUTH' });
  if (/imap.{0,40}(disabled|not enabled)|enable imap|web browser/i.test(said)) {
    return "Gmail has IMAP switched off for this account. In Gmail open Settings > See all settings > Forwarding and POP/IMAP, choose Enable IMAP and save (on a Google Workspace account an admin may have to allow it).";
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ETIMEOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNREFUSED', 'EDNS', 'NoConnection'].includes(e?.code) || /in required time|timed? ?out/i.test(said)) return "Couldn't reach Gmail. Check the internet connection.";
  return said && said !== 'Command failed' ? said : "Gmail's inbox said something unexpected.";
}

function plainError(e) {
  const said = String(e?.response || e?.message || '');
  if (e?.code === 'EAUTH' || e?.responseCode === 535 || /username and password not accepted|application-specific password|535/i.test(said)) {
    return "Gmail didn't accept the password. It has to be an app password, not the usual one: sign in as garrett@torreylabshq.com, open myaccount.google.com/apppasswords (2-Step Verification has to be on), make one, and paste the 16 letters here.";
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNREFUSED', 'EDNS'].includes(e?.code)) return "Couldn't reach Gmail. Check the internet connection.";
  return said || 'Gmail said something unexpected.';
}

// Message ids as they appear in headers: <something@host>. Anything else is dropped rather than sent as a header.
const ids = (v) => [].concat(v || []).flatMap((x) => String(x).match(/<[^<>\s]+>/g) || []);

const need = (cfg) => {
  if (!String(cfg?.user || '').includes('@')) throw new Error("Add the email address first (Setup > Auto-reply > Email).");
  if (!String(cfg?.pass || '').trim()) throw new Error('Paste the app password first (Setup > Auto-reply > Email).');
};

// Setup's Test button: does Gmail accept this login, for sending and for reading the inbox?
export async function testMail(cfg) {
  need(cfg);
  try {
    await transport(cfg).verify();
  } catch (e) {
    throw new Error(plainError(e));
  }
  // Sending works. Reading is tried too, and a problem there is reported without failing the test.
  const out = { user: String(cfg.user).trim(), read: true, readIssue: '' };
  const client = imap(cfg);
  try {
    await client.connect();
    await client.logout();
  } catch (e) {
    out.read = false;
    out.readIssue = imapError(e);
    try {
      client.close();
    } catch {}
  }
  return out;
}

// One plain-text email from the mailbox.
// inReplyTo and references (message ids, with their angle brackets) make the answer land in the same conversation.
export async function sendMail(cfg, { to, subject, text, name = '', inReplyTo = '', references = [] }) {
  need(cfg);
  const addr = String(to || '').trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(addr)) throw new Error(`"${addr}" isn't an email address.`);
  const user = String(cfg.user).trim();
  try {
    const info = await transport(cfg).sendMail({
      from: name ? { name: wellFormed(name), address: user } : user,
      to: addr,
      subject: wellFormed(subject),
      text: wellFormed(text),
      ...(ids(inReplyTo).length ? { inReplyTo: ids(inReplyTo)[0] } : {}),
      ...(ids(references).length ? { references: ids(references).slice(-20) } : {}),
    });
    if (!info.accepted?.length) throw new Error("Gmail didn't accept that address.");
    return { id: info.messageId };
  } catch (e) {
    throw new Error(plainError(e));
  }
}

// ---------- Reading the inbox ----------

const AUTO_SUBJECT = /^\s*(automatic reply|auto[- ]?reply|autoreply|out of office|undeliverable|delivery status notification|mail delivery)/i;
const BOUNCER = /mailer-daemon|postmaster/i;

// One parsed message: who it is from, what they wrote (text only), and whether a person wrote it.
async function describe(uid, source, internalDate) {
  const m = await simpleParser(source);
  const from = m.from?.value?.[0] || {};
  const h = (k) => {
    const v = m.headers.get(k);
    return String(v && typeof v === 'object' && 'value' in v ? v.value : (v ?? '')).toLowerCase();
  };
  const address = String(from.address || '').toLowerCase();
  const bounce = BOUNCER.test(address) || /multipart\/report/.test(h('content-type'));
  const auto = (h('auto-submitted') && h('auto-submitted') !== 'no') || !!h('x-autoreply') || !!h('x-autorespond') || /bulk|auto_reply|junk/.test(h('precedence')) || AUTO_SUBJECT.test(m.subject || '');
  return {
    uid,
    messageId: m.messageId || `uid-${uid}`,
    references: ids(m.references),
    from: address,
    name: from.name || '',
    subject: wellFormed(m.subject || ''),
    date: (m.date || internalDate || new Date()).toISOString(),
    text: wellFormed((m.text || '').trim()),
    bounce,
    auto: auto && !bounce,
  };
}

// The inbox since the last look. `cursor` is { validity, uid } from the previous call; without one (or when Gmail renumbered
// the mailbox) the last `days` days are read, newest `max`. Returns the messages, oldest first, and the new cursor.
export async function readInbox(cfg, { cursor = null, days = 14, max = 40 } = {}) {
  need(cfg);
  const me = String(cfg.user).trim().toLowerCase();
  const client = imap(cfg);
  try {
    await client.connect();
  } catch (e) {
    throw new Error(imapError(e));
  }
  let lock;
  try {
    lock = await client.getMailboxLock('INBOX', { readOnly: true });
    const mb = client.mailbox;
    const validity = String(mb.uidValidity);
    const top = Math.max(0, Number(mb.uidNext) - 1);
    const known = cursor && cursor.validity === validity && Number.isFinite(Number(cursor.uid));
    let uids = known
      ? ((await client.search({ uid: `${Number(cursor.uid) + 1}:*` }, { uid: true })) || []).filter((u) => u > Number(cursor.uid))
      : ((await client.search({ since: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }, { uid: true })) || []).slice(-max);
    uids = uids.sort((a, b) => a - b);
    // More new mail than `max` since the last look: read the oldest ones now and carry on from there next time, so
    // nothing in between is skipped. On a first look (no cursor) only the newest `max` matter.
    const truncated = known && uids.length > max;
    uids = known ? uids.slice(0, max) : uids.slice(-max);
    const messages = [];
    if (uids.length) {
      // At most the first 400 KB of each message: its text comes first, and a big attachment isn't worth downloading.
      for await (const msg of client.fetch(uids.join(','), { uid: true, source: { start: 0, maxLength: 400000 }, internalDate: true }, { uid: true })) {
        const d = await describe(msg.uid, msg.source, msg.internalDate);
        if (d.from && d.from !== me) messages.push(d);
      }
    }
    messages.sort((a, b) => a.uid - b.uid);
    return { validity, lastUid: truncated ? Math.max(...uids) : Math.max(top, ...uids, Number(known ? cursor.uid : 0)), more: truncated, messages };
  } catch (e) {
    throw new Error(imapError(e));
  } finally {
    lock?.release();
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {}
    }
  }
}

// Has an answer been sent to this address since `since`? Answers typed by hand in Gmail leave the same mark as the app's: a
// reply in the Sent folder. The app looks before it drafts a reply to an old message and again right before an answer goes
// out on its own, so a lead who was already answered is never answered twice. Only replies count (their In-Reply-To names
// `messageId` when it is known, otherwise a subject starting "Re:"): the cold email, Make's follow-ups and the answer to an
// earlier message in the thread are not an answer to this one.
export async function answeredSince(cfg, address, since, { messageId = '' } = {}) {
  need(cfg);
  const to = String(address || '').trim().toLowerCase();
  const after = new Date(since).getTime();
  if (!to.includes('@') || !Number.isFinite(after)) return false;
  const want = ids(messageId)[0] || '';
  const client = imap(cfg);
  try {
    await client.connect();
  } catch (e) {
    throw new Error(imapError(e));
  }
  let lock;
  try {
    const boxes = await client.list();
    const sent = boxes.find((b) => b.specialUse === '\\Sent')?.path || '[Gmail]/Sent Mail';
    lock = await client.getMailboxLock(sent, { readOnly: true });
    // SINCE is by day and in the server's zone, so look a day and a half back and compare the exact times.
    const hits = (await client.search({ to, since: new Date(after - 36 * 60 * 60 * 1000) }, { uid: true })) || [];
    if (!hits.length) return false;
    for await (const msg of client.fetch(hits.slice(-30).join(','), { uid: true, internalDate: true, source: { start: 0, maxLength: 20000 } }, { uid: true })) {
      if (!msg.internalDate || msg.internalDate.getTime() <= after) continue;
      const m = await simpleParser(msg.source);
      // A message that names this one in In-Reply-To or References was written after it, in answer to it (an answer to an
      // earlier message in the thread can't name it). Without the id, any "Re:" after it counts.
      const answers = want ? ids(m.inReplyTo).includes(want) || ids(m.references).includes(want) : /^\s*re:/i.test(m.subject || '');
      if (answers) return true;
    }
    return false;
  } catch (e) {
    throw new Error(imapError(e));
  } finally {
    lock?.release();
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {}
    }
  }
}
