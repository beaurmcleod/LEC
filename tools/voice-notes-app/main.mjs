import { app, BrowserWindow, clipboard, ipcMain, screen, session, shell, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import * as leads from './src/leads.js';
import { speak } from './src/voice.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const IG_BASE = (process.env.IG_BASE || 'https://www.instagram.com').replace(/\/$/, '');
const run = promisify(execFile);

// Instagram gets a plain Chrome user agent, not one that advertises Electron.
app.userAgentFallback = app.userAgentFallback
  .replace(/\(KHTML, like Gecko\) (?:(?!Chrome\/)\S+ )+/, '(KHTML, like Gecko) ')
  .replace(/ Electron\/\S+/, '');

let win;
let igWin;
let injected;
// The clip currently loaded into Instagram's mic. Re-sent after any full page load so a reload doesn't drop it.
let pendingArm = null;

const isInstagram = (url) => {
  try {
    const u = new URL(url);
    return url.startsWith(IG_BASE) || u.hostname === 'instagram.com' || u.hostname.endsWith('.instagram.com');
  } catch {
    return false;
  }
};

const toRecorder = (m) => win && !win.isDestroyed() && win.webContents.send('ig:status', m);

// Recorder on the left edge of the screen; Instagram fills the rest.
function createRecorderWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: 500,
    height: Math.min(900, area.height),
    minWidth: 420,
    minHeight: 600,
    title: 'Torrey Voice Notes',
    backgroundColor: '#111114',
    webPreferences: { preload: path.join(dir, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(dir, 'src/index.html'));
  win.on('closed', () => {
    win = null;
    if (igWin && !igWin.isDestroyed()) igWin.close();
  });
}

function createInstagramWindow({ show = true } = {}) {
  const b = win.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const left = b.x + b.width + 8;
  const width = Math.min(area.width, Math.max(700, Math.min(1200, area.x + area.width - left)));
  igWin = new BrowserWindow({
    width,
    height: b.height,
    x: Math.min(left, area.x + area.width - width),
    y: b.y,
    minWidth: 700,
    minHeight: 600,
    show,
    title: 'Instagram',
    backgroundColor: '#000000',
    webPreferences: {
      partition: 'persist:instagram',
      preload: path.join(dir, 'ig-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // Send runs while this window sits behind the recorder, so keep its timers and audio at full speed.
      backgroundThrottling: false,
    },
  });
  const ig = igWin.webContents;
  ig.on('dom-ready', async () => {
    if (!isInstagram(ig.getURL())) return;
    await ig.executeJavaScript(injected).catch(() => {});
    if (pendingArm) ig.send('ivn:arm', pendingArm);
  });
  // Facebook / Instagram login popups stay in the app; everything else opens in the browser.
  ig.setWindowOpenHandler(({ url }) => {
    if (isInstagram(url) || /(^|\.)facebook\.com$/.test(new URL(url).hostname)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  igWin.on('closed', () => {
    igWin = null;
    toRecorder({ state: 'closed' });
  });
  ig.loadURL(`${IG_BASE}/direct/inbox/`);
  return igWin;
}

const instagram = (opts) => (igWin && !igWin.isDestroyed() ? igWin : createInstagramWindow(opts));

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
  const byText = (re) => buttons().find((el) => re.test(el.textContent.trim()));
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
  const el = await waitFor(finders[action], action === 'send' ? 5000 : 10000);
  if (!el) return null;
  const target = el.closest('button, [role=button], a') || el;
  target.scrollIntoView({ block: 'center', inline: 'center' });
  await sleep(150);
  const r = target.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  if (hit && target.contains(hit)) return { x, y };
  target.click();
  return { clicked: true };
}

// A real mouse click where possible, so Instagram sees the same events as a person clicking.
async function igClick(wc, what) {
  const pt = await wc.executeJavaScript(`(${igPage})(${JSON.stringify(what)})`, true);
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

const pathOf = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    return '';
  }
};

async function openDm(wc, handle) {
  if (pathOf(wc.getURL()) !== `/${handle.toLowerCase()}`) {
    await wc.loadURL(`${IG_BASE}/${encodeURIComponent(handle)}/`).catch(() => {});
  } else if (wc.isLoading()) {
    await new Promise((r) => wc.once('did-stop-loading', r));
  }
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

ipcMain.handle('ig:arm', (_e, wav, meta) => {
  pendingArm = { wav, ...meta };
  const ig = instagram().webContents;
  if (!ig.isLoading()) ig.send('ivn:arm', pendingArm);
});
ipcMain.handle('ig:disarm', () => {
  pendingArm = null;
  if (igWin && !igWin.isDestroyed()) igWin.webContents.send('ivn:disarm');
});
ipcMain.handle('ig:open', (_e, handle) => {
  const w = instagram({ show: false });
  if (!w.isVisible() || w.isMinimized()) w.showInactive();
  return w.webContents.loadURL(`${IG_BASE}/${encodeURIComponent(handle)}/`);
});
ipcMain.handle('ig:show', () => {
  const w = instagram();
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
});
ipcMain.handle('ig:grab', () => instagram().webContents.executeJavaScript(GRAB));
ipcMain.handle('ig:do', async (_e, action, handle) => {
  const w = instagram({ show: false });
  if (!w.isVisible() || w.isMinimized()) w.showInactive();
  const wc = w.webContents;
  if (action === 'openDm') return openDm(wc, handle);
  if (action === 'clickMic' && !(await igClick(wc, 'mic'))) throw new Error("Couldn't find the mic button in the DM.");
  if (action === 'clickSend' && !(await igClick(wc, 'send'))) throw new Error("Couldn't find Instagram's send button.");
});
ipcMain.on('ig:status', (_e, m) => {
  if (['done', 'stopped', 'idle'].includes(m.state)) pendingArm = null;
  toRecorder(m);
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

ipcMain.handle('airtable:pull', (_e, at) => leads.pullAirtable(at));
ipcMain.handle('airtable:sent', (_e, at, id) => leads.markSentAirtable(at, id));
ipcMain.handle('tts', (_e, text, settings) => speak(text, settings));

app.whenReady().then(async () => {
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('microphone').catch(() => {});
  const onlyMedia = (_wc, permission, cb) => cb(permission === 'media');
  session.defaultSession.setPermissionRequestHandler(onlyMedia);
  session.fromPartition('persist:instagram').setPermissionRequestHandler(onlyMedia);
  injected = await fs.readFile(path.join(dir, 'src/ig-main.js'), 'utf8');
  createRecorderWindow();
  createInstagramWindow();
});

app.on('activate', () => {
  if (!win) {
    createRecorderWindow();
    createInstagramWindow();
  }
});
app.on('window-all-closed', () => app.quit());
