// Garrett's mailbox (garrett@torreylabshq.com): the app logs into it to send answers to leads who replied by email.
// It signs in with a Gmail app password, kept in Setup and never in the code. Replies themselves are read from Airtable,
// where the Make scenario TL5b writes each one.
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

function plainError(e) {
  const said = String(e?.response || e?.message || '');
  if (e?.code === 'EAUTH' || e?.responseCode === 535 || /username and password not accepted|application-specific password|535/i.test(said)) {
    return "Gmail didn't accept the password. It has to be an app password, not the usual one: sign in as garrett@torreylabshq.com, open myaccount.google.com/apppasswords (2-Step Verification has to be on), make one, and paste the 16 letters here.";
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNREFUSED', 'EDNS'].includes(e?.code)) return "Couldn't reach Gmail. Check the internet connection.";
  return said || 'Gmail said something unexpected.';
}

const need = (cfg) => {
  if (!String(cfg?.user || '').includes('@')) throw new Error("Add the email address first (Setup > Auto-reply > Email).");
  if (!String(cfg?.pass || '').trim()) throw new Error('Paste the app password first (Setup > Auto-reply > Email).');
};

// Setup's Test button: does Gmail accept this login?
export async function testMail(cfg) {
  need(cfg);
  try {
    await transport(cfg).verify();
  } catch (e) {
    throw new Error(plainError(e));
  }
  return { user: String(cfg.user).trim() };
}

// One plain-text email from the mailbox.
export async function sendMail(cfg, { to, subject, text, name = '' }) {
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
    });
    if (!info.accepted?.length) throw new Error("Gmail didn't accept that address.");
    return { id: info.messageId };
  } catch (e) {
    throw new Error(plainError(e));
  }
}
