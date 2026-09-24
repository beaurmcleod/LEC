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
