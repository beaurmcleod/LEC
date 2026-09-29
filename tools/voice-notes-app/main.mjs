import { app, BaseWindow, WebContentsView, clipboard, ipcMain, screen, session, shell, systemPreferences, webContents } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFollowRunner } from './follow-runner.mjs';
import * as leads from './src/leads.js';
import { speak } from './src/voice.js';
import { dmPage } from './src/dm-page.js';
import { draftReply, testClaude } from './src/claude.js';
import { createInvite, testTorrey } from './src/torrey.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const IG_BASE = (process.env.IG_BASE || 'https://www.instagram.com').replace(/\/$/, '');
const run = promisify(execFile);

// Instagram gets a plain Chrome user agent, not one that advertises Electron.
app.userAgentFallback = app.userAgentFallback
  .replace(/\(KHTML, like Gecko\) (?:(?!Chrome\/)\S+ )+/, '(KHTML, like Gecko) ')
  .replace(/ Electron\/\S+/, '');

// One window, two panes: the recorder on the left, Instagram filling the rest.
const PANE = 480;

let win;
let recorder;
let igView;
// A second Instagram tab, same login, where follows and likes run without touching the DM tab.
let followView;
// A third, hidden one where voice notes send in the background while you work on the next lead.
let sendView;
let follower;
let injected;
// The clip currently loaded into each tab's mic ('dm' is the one you see, 'send' the background one).
// Re-sent after any full page load so a reload doesn't drop it.
const pendingArm = { dm: null, send: null };

const isInstagram = (url) => {
  try {
    const u = new URL(url);
    return url.startsWith(IG_BASE) || u.hostname === 'instagram.com' || u.hostname.endsWith('.instagram.com');
  } catch {
    return false;
  }
};

const toRecorder = (m, channel = 'ig:status') => win && recorder.webContents.send(channel, m);
const ig = () => igView.webContents;
const tab = (target) => (target === 'send' ? sendView : igView).webContents;
const targetOf = (wc) => (sendView && wc === sendView.webContents ? 'send' : 'dm');

function layout() {
  const { width, height } = win.contentView.getBounds();
  recorder.setBounds({ x: 0, y: 0, width: PANE, height });
  // The 1px gap shows the window background as a divider. Both Instagram tabs share the right side; one sits on top.
  const right = { x: PANE + 1, y: 0, width: Math.max(0, width - PANE - 1), height };
  igView.setBounds(right);
  followView.setBounds(right);
  sendView.setBounds(right);
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  win = new BaseWindow({
    x: area.x,
    y: area.y,
    width: Math.min(area.width, 1760),
    height: area.height,
    minWidth: PANE + 600,
    minHeight: 600,
    title: 'Torrey Voice Notes',
    backgroundColor: '#2c2c34',
  });
  recorder = new WebContentsView({
    webPreferences: { preload: path.join(dir, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  igView = new WebContentsView({
    webPreferences: {
      partition: 'persist:instagram',
      preload: path.join(dir, 'ig-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // Send keeps running while you're in another app, so keep Instagram's timers and audio at full speed.
      backgroundThrottling: false,
    },
  });
  followView = new WebContentsView({
    webPreferences: { partition: 'persist:instagram', contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  followView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  followView.webContents.loadURL('about:blank');
  sendView = new WebContentsView({
    webPreferences: {
      partition: 'persist:instagram',
      preload: path.join(dir, 'ig-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  // Instagram can ask to stay on a page that holds an unsent recording. Electron then blocks every later load in
  // that tab without a word, so one stuck send would make all the ones after it fail. Let the tab leave.
  for (const v of [igView, followView, sendView]) v.webContents.on('will-prevent-unload', (e) => e.preventDefault());
  // The DM tab goes on top; the follow and send tabs work behind it.
  win.contentView.addChildView(recorder);
  win.contentView.addChildView(followView);
  win.contentView.addChildView(sendView);
  win.contentView.addChildView(igView);
  layout();
  // Follows the content area rather than the window, which also catches the menu bar settling and full screen.
  win.contentView.on('bounds-changed', layout);
  win.on('closed', () => {
    recorder.webContents.close();
    igView.webContents.close();
    followView.webContents.close();
    sendView.webContents.close();
    win = null;
  });

  // Links in the recorder (like the Airtable token page) open in the browser.
  recorder.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  recorder.webContents.loadFile(path.join(dir, 'src/index.html'));
  recorder.webContents.once('did-finish-load', () => recorder.webContents.focus());

  const wc = igView.webContents;
  micTab(wc, 'dm');
  // Facebook / Instagram login popups stay in the app; everything else opens in the browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isInstagram(url) || /(^|\.)facebook\.com$/.test(new URL(url).hostname)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.loadURL(`${IG_BASE}/direct/inbox/`);
  micTab(sendView.webContents, 'send');
  sendView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  sendView.webContents.loadURL('about:blank');
  watchFocus();
}

// An Instagram tab whose mic the app can swap for a clip.
function micTab(wc, target) {
  wc.on('dom-ready', async () => {
    if (!isInstagram(wc.getURL())) return;
    await wc.executeJavaScript(injected).catch(() => {});
    if (pendingArm[target]) wc.send('ivn:arm', pendingArm[target]);
  });
  // The tabs can't be closed and reopened, so recover from a crashed Instagram page by reloading it.
  wc.on('render-process-gone', () => setTimeout(() => !wc.isDestroyed() && wc.reload(), 500));
}

const GRAB = `(() => {
  const skip = /^(follow|following|message|edit profile|view archive|contact|email|call|options|more|\\d[\\d.,]*[km]?\\s+(posts?|followers?|following))$/i;
  const notProfiles = new Set(['direct', 'explore', 'reels', 'reel', 'p', 'stories', 'accounts', 'about', 'legal', 'developer']);
  const first = location.pathname.split('/').filter(Boolean)[0] || '';
  let handle = notProfiles.has(first) ? '' : first;
  let displayName = '';
  const t = document.title.match(/^(.*?)\\s*\\(@([^)]+)\\)/);
  if (t) { displayName = t[1].trim(); handle ||= t[2]; }
  const header = document.querySelector('main header') || document.querySelector('header');
  const bio = (header?.innerText || '').split('\\n').map((l) => l.trim())
    .filter((l) => l && l !== handle && !skip.test(l)).join('\\n').slice(0, 600);
  return { handle, displayName, bio };
})()`;

// Runs inside Instagram for the Send button. Finds things by button text and accessible labels
// rather than class names, since Instagram's markup changes often. 'dm' waits for a DM to be open;
// the others return the point to click on the target, or null when it never shows up.
async function igPage(action) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const buttons = () => [...document.querySelectorAll('button, [role=button]')].filter(shown);
  // Visible text only, so an icon's hidden title doesn't change what a button says.
  const byText = (re) => buttons().find((el) => re.test((el.innerText ?? el.textContent).trim()));
  const byLabel = (re, not) =>
    [...document.querySelectorAll('[aria-label]')].find((el) => {
      const label = el.getAttribute('aria-label');
      return shown(el) && re.test(label) && !not?.test(label);
    });
  const waitFor = async (fn, ms) => {
    for (const end = Date.now() + ms; ; await sleep(200)) {
      const found = fn();
      if (found || Date.now() > end) return found;
    }
  };
  // "Turn on notifications?" and similar prompts cover the DM the first time it opens.
  const dismiss = () => byText(/^not now$/i)?.click();
  const inDm = () => location.pathname.startsWith('/direct/t/') || !!document.querySelector('[role=textbox][contenteditable=true]');

  if (action === 'dm') {
    const ok = await waitFor(inDm, 12000);
    await sleep(600);
    dismiss();
    return ok;
  }
  dismiss();
  const finders = {
    message: () => byText(/^message$/i),
    mic: () => byLabel(/voice|audio clip/i, /call|video/i),
    send: () => byText(/^send$/i) || byLabel(/^send$/i),
  };
  finders.sendAgain = finders.send;
  const el = await waitFor(finders[action], action === 'sendAgain' ? 1500 : action === 'send' ? 5000 : 10000);
  if (!el) return null;
  const target = el.closest('button, [role=button], a') || el;
  target.scrollIntoView({ block: 'center', inline: 'center' });
  await sleep(150);
  const r = target.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  // What is being clicked and what is under the pointer there, for the record when a send doesn't go through.
  const say = (n) => `<${n.tagName.toLowerCase()}${n.getAttribute('role') ? ` role="${n.getAttribute('role')}"` : ''}${n.getAttribute('aria-label') ? ` aria-label="${n.getAttribute('aria-label')}"` : ''}> "${(n.innerText || '').trim().slice(0, 30)}"`;
  const what = `${say(target)} at ${Math.round(x)},${Math.round(y)}, under the pointer there: ${hit ? say(hit) : 'nothing'}`;
  if (hit && target.contains(hit)) return { x, y, what };
  target.click();
  return { clicked: true, what: `${what} (something covered it, so it was clicked from the page)` };
}

// A real mouse click where possible, so Instagram sees the same events as a person clicking.
// `pt` comes from a page script: a point to click, { clicked } if it already clicked, or null if nothing was found.
async function clickPoint(wc, pt) {
  if (!pt) return false;
  if (!pt.clicked) {
    const z = wc.getZoomFactor();
    const x = Math.round(pt.x * z);
    const y = Math.round(pt.y * z);
    wc.sendInputEvent({ type: 'mouseMove', x, y });
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  }
  return true;
}

// Keyboard focus. Loading a page or clicking in an Instagram tab moves the keyboard there, which would send
// your Space (record) into Instagram. So the app remembers where you last put the keyboard yourself, the
// recorder or the DM tab, and hands it back: the hidden tabs never keep it, and app-driven loads and clicks
// in the DM tab don't take it.
let front = null;
let driving = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function giveBack() {
  const to = front && !front.isDestroyed() ? front : recorder?.webContents;
  if (to && !to.isDestroyed() && webContents.getFocusedWebContents() !== to) to.focus();
}

function watchFocus() {
  front = recorder.webContents;
  recorder.webContents.on('focus', () => (front = recorder.webContents));
  igView.webContents.on('focus', () => {
    if (!driving) front = igView.webContents;
  });
  for (const v of [sendView, followView]) v.webContents.on('focus', () => setImmediate(giveBack));
}

// Runs an app-driven load or click in the DM tab, then puts the keyboard back where you had it.
async function quietly(fn) {
  driving++;
  try {
    return await fn();
  } finally {
    (async () => {
      for (const ms of [0, 60, 250]) {
        await sleep(ms);
        giveBack();
      }
      driving--;
    })();
  }
}

// Returns a description of what was clicked, or '' when there was nothing to click.
const igClick = async (wc, what) => {
  const pt = await wc.executeJavaScript(`(${igPage})(${JSON.stringify(what)})`, true);
  return (await clickPoint(wc, pt)) ? pt.what || 'clicked' : '';
};

const pathOf = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const chatOpen = (wc) => wc.executeJavaScript(`!!document.querySelector('[role=textbox][contenteditable=true]')`, true).catch(() => false);

async function openDm(wc, handle) {
  const here = pathOf(wc.getURL()) === `/${handle.toLowerCase()}`;
  if (here && wc.isLoading()) await new Promise((r) => wc.once('did-stop-loading', r));
  // Instagram opens a chat as a window over the profile, so the tab can be on their profile with a chat already
  // open (a reply check reads theirs right before the answer goes out). That window can hide the Message button
  // and may not be theirs, so the profile is loaded fresh and their chat opened from it.
  if (!here || (await chatOpen(wc))) await wc.loadURL(`${IG_BASE}/${encodeURIComponent(handle)}/`).catch(() => {});
  if (!(await igClick(wc, 'message'))) throw new Error("Couldn't find the Message button on their profile.");
  if (!(await wc.executeJavaScript(`(${igPage})('dm')`, true))) throw new Error("Their DM didn't open.");
}

const safeName = (s) => String(s || 'clip').replace(/[^\w .@-]+/g, '').trim().slice(0, 60) || 'clip';
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function copyFileToClipboard(file) {
  if (process.platform === 'darwin') {
    const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${xml(file)}</string></array></plist>`;
    clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(plist));
  } else {
    clipboard.writeText(pathToFileURL(file).href);
  }
}

ipcMain.handle('ig:arm', (_e, wav, meta, target = 'dm') => {
  pendingArm[target] = { wav, ...meta };
  if (!tab(target).isLoading()) tab(target).send('ivn:arm', pendingArm[target]);
});
ipcMain.handle('ig:disarm', (_e, target = 'dm') => {
  pendingArm[target] = null;
  tab(target).send('ivn:disarm');
});
ipcMain.handle('ig:open', (_e, handle) => quietly(() => ig().loadURL(`${IG_BASE}/${encodeURIComponent(handle)}/`)));
// Puts the keyboard in the Instagram pane, for when you need to finish something there by hand.
ipcMain.handle('ig:show', () => {
  front = ig();
  ig().focus();
});
ipcMain.handle('ig:grab', () => ig().executeJavaScript(GRAB));
ipcMain.handle('ig:do', (_e, action, handle, target = 'dm') =>
  quietly(async () => {
    const wc = tab(target);
    if (action === 'openDm') {
      await openDm(wc, handle);
      // The thread's own address, so replies can be matched to the lead later.
      return pathOf(wc.getURL());
    }
    if (action === 'clickMic') return (await igClick(wc, 'mic')) || Promise.reject(new Error("Couldn't find the mic button in the DM."));
    if (action === 'clickSend') return (await igClick(wc, 'send')) || Promise.reject(new Error("Couldn't find Instagram's send button."));
    // After a send: a Send control that is still on screen (a recording UI that needs a second press). null if none.
    if (action === 'clickSendAgain') return (await igClick(wc, 'sendAgain')) || null;
  }),
);
ipcMain.on('ig:status', (e, m) => {
  const target = targetOf(e.sender);
  if (['done', 'stopped', 'idle'].includes(m.state)) pendingArm[target] = null;
  toRecorder({ ...m, target });
});

ipcMain.handle('clip:save', async (_e, wav, name) => {
  const outDir = path.join(app.getPath('music'), 'Torrey Voice Notes');
  await fs.mkdir(outDir, { recursive: true });
  const base = path.join(outDir, `${new Date().toISOString().slice(0, 10)} ${safeName(name)}`);
  let file = `${base}.wav`;
  await fs.writeFile(file, Buffer.from(wav));
  if (process.platform === 'darwin') {
    try {
      await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '160000', file, `${base}.m4a`]);
      await fs.rm(file);
      file = `${base}.m4a`;
    } catch {}
  }
  copyFileToClipboard(file);
  return file;
});
ipcMain.handle('clip:reveal', (_e, file) => shell.showItemInFolder(file));

// The recorder shows the follow tab on the right while its Follow screen is open.
ipcMain.handle('pane:show', (_e, which) => win.contentView.addChildView({ follow: followView, send: sendView }[which] || igView));
// After a voice note sends: follow them and like their 1st and 4th posts, in the hidden send tab.
ipcMain.handle('ig:engage', (_e, handle, airtableId) => quietly(() => follower.engage(tab('send'), { handle, airtableId })));

// ---------- Replies: read the DM inbox and answer in a thread, in the hidden send tab ----------
const runDm = (wc, action, arg) => wc.executeJavaScript(`(${dmPage})(${JSON.stringify(action)}, ${JSON.stringify(arg ?? null)})`, true);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
ipcMain.handle('dm:inbox', (_e, target = 'send') =>
  quietly(async () => {
    const wc = tab(target);
    await wc.loadURL(`${IG_BASE}/direct/inbox/`).catch(() => {});
    return runDm(wc, 'inbox');
  }),
);
ipcMain.handle('dm:thread', (_e, href) =>
  quietly(async () => {
    const wc = tab('send');
    await wc.loadURL(new URL(href, IG_BASE).href).catch(() => {});
    return runDm(wc, 'thread');
  }),
);
// Types the text into the thread's message box with real (trusted) input and sends it.
// Opens a lead's chat (their profile's Message button) and reads the conversation. Nothing is sent. The older
// messages can take a moment to load, so it reads a few times and keeps the fullest read.
ipcMain.handle('dm:readChat', (_e, target = 'send', handle) =>
  quietly(async () => {
    const wc = tab(target);
    try {
      await openDm(wc, handle);
    } catch (e) {
      return { state: /log ?in/i.test(wc.getURL()) ? 'loggedout' : 'nodm', error: e.message, messages: [] };
    }
    let best = { messages: [] };
    for (let i = 0; i < 4; i++) {
      await pause(1200);
      const r = await runDm(wc, 'chatMessages', handle).catch(() => null);
      if (r?.loggedOut) return { state: 'loggedout', messages: [] };
      if (r && r.messages.length >= best.messages.length) best = r;
    }
    return { state: 'ok', ...best };
  }),
);

ipcMain.handle('dm:send', (_e, { href, handle, text }) =>
  quietly(async () => {
    const wc = tab('send');
    // Today's Instagram opens a DM as a chat window over the profile; an older thread address still works.
    if (href && href.startsWith('/direct/t/')) await wc.loadURL(new URL(href, IG_BASE).href).catch(() => {});
    else await openDm(wc, handle);
    await watchStart('send');
    try {
      return await typeAndSend(wc, text, Date.now());
    } finally {
      await watchStop('send');
    }
  }),
);

// Types a reply into the open chat and sends it; the send's network answer is the proof.
async function typeAndSend(wc, text, since) {
  // A click right after a page load can arrive before the page takes input, so make sure the caret really
  // is in the box (and the text really went in) before pressing send. Otherwise the message is lost silently.
  let inBox = false;
  for (let i = 0; i < 4 && !inBox; i++) {
    const box = await runDm(wc, 'box');
    if (!box) throw new Error("Couldn't find the message box in their DM.");
    await clickPoint(wc, box);
    await pause(300 + i * 300);
    inBox = await runDm(wc, 'boxFocused');
    if (!inBox && i >= 1) inBox = await runDm(wc, 'focusBox');
  }
  if (!inBox) throw new Error("Couldn't put the cursor in their message box.");
  await wc.insertText(text);
  await pause(400);
  if (!(await runDm(wc, 'boxHas', text.slice(0, 40)))) throw new Error("The reply didn't go into the message box.");
  const send = await runDm(wc, 'sendButton');
  if (send) await clickPoint(wc, send);
  else {
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  }
  // The proof is Instagram's answer to the send, as for voice notes; the chat on screen is the fallback.
  let proof = null;
  for (const end = Date.now() + 12000; Date.now() < end; await pause(400)) {
    const w = watches.get('send');
    if (!w?.onMessage) break;
    if (w.send && w.send.at >= since) {
      proof = w.send;
      break;
    }
  }
  const r = await runDm(wc, 'confirm', text);
  if (proof && !proof.ok) throw new Error(`Instagram said "${proof.error}"`);
  if (proof?.ok) return { state: 'sent', id: proof.id };
  if (r.state === 'stuck') throw new Error("Typed the reply, but Instagram didn't send it. Open the thread and press Send.");
  return r;
}

// What a tab shows right now, as text: the address, every labeled control and the visible words.
const aboutText = (about) =>
  [
    `${about.url}${about.focused === false ? ' (the page does not have focus)' : ''}`,
    about.trace?.length ? `What Instagram did with the recording:\n${about.trace.join('\n')}` : '',
    `Buttons and inputs on screen:\n${about.buttons.slice(0, 80).join('\n')}`,
    `Everything labeled:\n${about.labels.slice(0, 60).join('\n')}`,
    `Text on screen:\n${String(about.text).slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join('\n');

// ---------- While a send runs: the tab's network traffic and console errors, through the DevTools protocol ----------
// Instagram's own servers answer each step of a send (the upload, the message); their answers are the only
// first-hand word on whether a note went out. Request bodies and headers are never kept (they hold login tokens),
// only the method, the address without its query, the operation name and the start of the reply.
const watches = new Map();
const INTERESTING = /graphql|api\/v1|rupload|upload|direct|ajax|messag|thread|media/i;

// Instagram's answers to the two requests that make a voice note: the audio upload (ajax/mercury/upload.php,
// answered with an audio id) and the send (the IGDirectMediaSendMutation GraphQL call, answered with the new
// message's id). A message id from Instagram is the proof a note went out.
const isUpload = (r) => r.method === 'POST' && /mercury\/upload|rupload/i.test(r.where);
const isSend = (r) => r.method === 'POST' && /send/i.test(r.op) && /direct|messag|media|voice|audio|text/i.test(r.op);
const parseAnswer = (text) => {
  try {
    return JSON.parse(String(text).replace(/^for \(;;\);/, ''));
  } catch {
    return null;
  }
};
const findKey = (o, key, depth = 0) => {
  if (!o || typeof o !== 'object' || depth > 10) return undefined;
  if (o[key] != null) return o[key];
  for (const v of Object.values(o)) {
    const found = findKey(v, key, depth + 1);
    if (found != null) return found;
  }
  return undefined;
};
const errorOf = (o) => {
  const e = Array.isArray(o?.errors) ? o.errors[0] : null;
  if (e) return String(e.message || e.summary || e.description || JSON.stringify(e)).slice(0, 200);
  if (o?.error) return String(o.errorSummary || o.errorDescription || `error ${o.error}`).slice(0, 200);
  return '';
};
// An upload only counts as failed when Instagram says so (an error in its answer, or an error status). An answer
// the app can't read isn't a failure: the send's answer decides.
function readUpload(text, status) {
  const o = parseAnswer(text);
  const id = findKey(o, 'audio_id') ?? findKey(o, 'video_id') ?? findKey(o, 'media_id') ?? findKey(o, 'upload_id');
  const error = errorOf(o) || (status >= 400 ? `Instagram answered ${status}` : '');
  return { at: Date.now(), ok: !error, id: id ? String(id) : '(no id in the answer)', error };
}
function readSend(text, status) {
  const o = parseAnswer(text);
  const id = findKey(o, 'message_id') ?? findKey(o, 'item_id');
  const error = errorOf(o) || (status >= 400 ? `Instagram answered ${status}` : id ? '' : `no message id in Instagram's answer: ${String(text).slice(0, 150)}`);
  return { at: Date.now(), ok: !error && !!id, id: id ? String(id) : '', error };
}
async function watchStart(target) {
  await watchStop(target);
  const wc = tab(target);
  const w = { t0: Date.now(), reqs: new Map(), order: [], console: [], ws: { sent: 0, recv: 0, bytesOut: 0, bytesIn: 0, words: [] }, attached: false };
  const stamp = () => `${((Date.now() - w.t0) / 1000).toFixed(1)}s`;
  w.onConsole = (e, level, message) => {
    const lv = typeof e?.level === 'string' ? e.level : ['verbose', 'info', 'warning', 'error'][level] || 'info';
    const msg = String(e?.message ?? message ?? '');
    if ((lv === 'error' || lv === 'warning') && w.console.length < 40 && !/__ivn/.test(msg)) w.console.push(`${stamp()} ${lv}: ${msg.slice(0, 300)}`);
  };
  wc.on('console-message', w.onConsole);
  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
      w.attached = true;
    }
  } catch (e) {
    w.note = `Couldn't watch Instagram's answers or keep the page focused: ${e.message}`;
  }
  if (wc.debugger.isAttached()) {
    w.onMessage = (_e, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        const { requestId, request, type } = params;
        let url;
        try {
          url = new URL(request.url);
        } catch {
          return;
        }
        if (!/^https?:$/.test(url.protocol)) return;
        const op = /fb_api_req_friendly_name=([\w.]+)/.exec(request.postData || '')?.[1] || '';
        w.reqs.set(requestId, { at: stamp(), method: request.method, where: `${url.host}${url.pathname}`, op, type, size: (request.postData || '').length });
        w.order.push(requestId);
      } else if (method === 'Network.responseReceived') {
        const r = w.reqs.get(params.requestId);
        if (r) r.status = params.response.status;
      } else if (method === 'Network.loadingFailed') {
        const r = w.reqs.get(params.requestId);
        if (r) {
          r.failed = params.canceled ? 'canceled' : params.errorText;
          if (isUpload(r)) w.upload = { at: Date.now(), ok: false, id: '', error: `the upload didn't finish (${r.failed})` };
          if (isSend(r)) w.send = { at: Date.now(), ok: false, id: '', op: r.op, error: `the send didn't reach Instagram (${r.failed})` };
        }
      } else if (method === 'Network.loadingFinished') {
        const r = w.reqs.get(params.requestId);
        if (r && (r.method !== 'GET' || r.status >= 400) && INTERESTING.test(r.where)) {
          const full = wc.debugger
            .sendCommand('Network.getResponseBody', { requestId: params.requestId })
            .then((b) => (b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : String(b.body)), () => '');
          r.body = full.then((t) => t.replace(/\s+/g, ' ').slice(0, 400));
          if (isUpload(r)) full.then((t) => (w.upload = readUpload(t, r.status)));
          if (isSend(r)) full.then((t) => (w.send = { ...readSend(t, r.status), op: r.op }));
        }
      } else if (method === 'Network.webSocketFrameSent' || method === 'Network.webSocketFrameReceived') {
        const out = method.endsWith('Sent');
        const data = params.response?.payloadData || '';
        w.ws[out ? 'sent' : 'recv']++;
        w.ws[out ? 'bytesOut' : 'bytesIn'] += data.length;
        const text = params.response?.opcode === 1 ? data : Buffer.from(data, 'base64').toString('latin1');
        const word = /[ -~]{0,60}(error|fail|spam|restrict|block|feedback|limit|denied)[ -~]{0,60}/i.exec(text);
        if (word && w.ws.words.length < 10) w.ws.words.push(`${stamp()} ${out ? 'sent' : 'received'}: ${word[0]}`);
      }
    };
    wc.debugger.on('message', w.onMessage);
    await wc.debugger.sendCommand('Network.enable').catch(() => {});
    // The page keeps believing it has focus while the app hands the keyboard back to the recorder, so a
    // recording can't be paused or dropped because the window lost focus.
    await wc.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  }
  watches.set(target, w);
}
async function watchStop(target) {
  const w = watches.get(target);
  if (!w) return '';
  watches.delete(target);
  const wc = tab(target);
  wc.off('console-message', w.onConsole);
  if (w.onMessage) {
    wc.debugger.off('message', w.onMessage);
    await wc.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {});
  }
  const rows = [];
  for (const id of w.order) {
    const r = w.reqs.get(id);
    const shown = r.method !== 'GET' || r.status >= 400 || r.failed;
    if (!shown) continue;
    const body = r.body ? await r.body : '';
    rows.push(
      `${r.at} ${r.method} ${r.where}${r.op ? ` [${r.op}]` : ''}${r.size ? ` (${r.size} bytes out)` : ''} -> ${r.failed ? `FAILED ${r.failed}` : r.status ?? 'no answer yet'}${body ? ` ${body}` : ''}`,
    );
  }
  if (w.attached) {
    try {
      wc.debugger.detach();
    } catch {}
  }
  const ws = w.ws;
  return [
    w.note || '',
    `Network while sending (${rows.length} requests other than plain page loads):`,
    ...rows.slice(-70),
    ws.sent || ws.recv ? `Live connection: ${ws.sent} frames out (${ws.bytesOut} chars), ${ws.recv} in (${ws.bytesIn} chars)` : 'Live connection: no frames',
    ...ws.words,
    w.console.length ? `Page console:\n${w.console.join('\n')}` : 'Page console: no errors or warnings',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 16000);
}
ipcMain.handle('diag:watchStart', (_e, target) => watchStart(target));
// What Instagram answered to the upload and the send since `since` (ms), while a send is being watched.
ipcMain.handle('diag:sendProof', (_e, target, since = 0) => {
  const w = watches.get(target);
  const fresh = (x) => (x && x.at >= since ? x : null);
  return { watching: !!w?.onMessage, upload: fresh(w?.upload), send: fresh(w?.send) };
});
ipcMain.handle('diag:watchStop', (_e, target) => watchStop(target));

// The open chat: how many voice messages it shows, whether one is still sending, and any failure notice.
ipcMain.handle('dm:chatVoice', (_e, target = 'send', handle = '') =>
  runDm(tab(target), 'chatVoice', handle).catch((e) => ({ voices: 0, ours: 0, sending: false, failure: '', error: e.message })),
);
// Opens a lead's chat and reads it, without sending anything: used to find sends that went out although the app
// marked them failed. The chat's older messages can take a moment to load, so it looks a few times.
ipcMain.handle('dm:checkLead', (_e, target = 'send', handle) =>
  quietly(async () => {
    const wc = tab(target);
    try {
      await openDm(wc, handle);
    } catch (e) {
      return { state: 'nodm', error: e.message };
    }
    let best = null;
    for (let i = 0; i < 4; i++) {
      await pause(1500);
      const r = await runDm(wc, 'chatVoice', handle).catch(() => null);
      if (r && (!best || r.voices > best.voices || r.ours > best.ours)) best = r;
    }
    return best ? { state: 'ok', ...best } : { state: 'unreadable' };
  }),
);
const describeTab = (target) =>
  runDm(tab(target), 'describe').then(aboutText, (e) => `(couldn't read the page: ${e.message})`);
ipcMain.handle('diag:describe', (_e, target) => describeTab(target));
// When a send doesn't go through: the trace of what the tab showed at each step, the tab's state now, and a
// picture of it, in userData/diagnostics.
ipcMain.handle('diag:snap', async (_e, target, name, report = '') => {
  const dir = path.join(app.getPath('userData'), 'diagnostics');
  await fs.mkdir(dir, { recursive: true });
  const stem = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${safeName(name)}`);
  await fs.writeFile(`${stem}.txt`, `${report}\n\n## Now\n${await describeTab(target)}\n`);
  try {
    const img = await tab(target).capturePage();
    if (!img.isEmpty()) await fs.writeFile(`${stem}.png`, img.toPNG());
  } catch {}
  // Keep the last 60 files.
  const all = (await fs.readdir(dir)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - 60))) await fs.rm(path.join(dir, f), { force: true });
  return `${stem}.txt`;
});
ipcMain.handle('diag:reveal', (_e, file) => shell.showItemInFolder(file));
ipcMain.handle('reply:draft', (_e, key, prompt) => draftReply(key, prompt));
ipcMain.handle('reply:test', (_e, key) => testClaude(key));
ipcMain.handle('torrey:invite', (_e, cfg, args) => createInvite(cfg, args));
ipcMain.handle('torrey:test', (_e, cfg) => testTorrey(cfg));
ipcMain.handle('airtable:patch', (_e, at, id, fields) => leads.patchAirtable(at, id, fields));
ipcMain.handle('airtable:remove', (_e, at, id, opts) => leads.removeAirtable(at, id, opts));
ipcMain.handle('follow:config', (_e, at) => follower.configure(at));
ipcMain.handle('follow:set', (_e, on) => follower.setEnabled(!!on));
ipcMain.handle('follow:state', () => follower.snapshot());

ipcMain.handle('airtable:pull', (_e, at) => leads.pullAirtable(at));
ipcMain.handle('airtable:pullSent', (_e, at) => leads.pullSentAirtable(at));
ipcMain.handle('airtable:sent', (_e, at, id) => leads.markSentAirtable(at, id));
ipcMain.handle('tts', (_e, text, settings) => speak(text, settings));

app.whenReady().then(async () => {
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('microphone').catch(() => {});
  const onlyMedia = (_wc, permission, cb) => cb(permission === 'media');
  session.defaultSession.setPermissionRequestHandler(onlyMedia);
  session.fromPartition('persist:instagram').setPermissionRequestHandler(onlyMedia);
  injected = await fs.readFile(path.join(dir, 'src/ig-main.js'), 'utf8');
  follower = createFollowRunner({
    view: () => followView,
    statePath: path.join(app.getPath('userData'), 'follow-state.json'),
    igBase: IG_BASE,
    click: clickPoint,
    emit: (s) => toRecorder(s, 'follow:status'),
    onFollowed: (m) => toRecorder(m, 'follow:followed'),
    // Test runs only: short gaps between accounts. The daily limit still applies.
    fast: process.env.TVN_TEST_FOLLOW === '1',
  });
  createWindow();
  await follower.init();
});

app.on('activate', () => {
  if (!win) createWindow();
});
app.on('window-all-closed', () => app.quit());
