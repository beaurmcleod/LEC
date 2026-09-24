import { app, BrowserWindow, WebContentsView, clipboard, ipcMain, session, shell, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import * as leads from './src/leads.js';
import { speak } from './src/voice.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const IG_BASE = (process.env.IG_BASE || 'https://www.instagram.com').replace(/\/$/, '');
const PANEL_WIDTH = 460;
const run = promisify(execFile);

// Instagram gets a plain Chrome user agent, not one that advertises Electron.
app.userAgentFallback = app.userAgentFallback
  .replace(/\(KHTML, like Gecko\) (?:(?!Chrome\/)\S+ )+/, '(KHTML, like Gecko) ')
  .replace(/ Electron\/\S+/, '');

let win;
let igView;

const isInstagram = (url) => {
  try {
    const u = new URL(url);
    return url.startsWith(IG_BASE) || u.hostname === 'instagram.com' || u.hostname.endsWith('.instagram.com');
  } catch {
    return false;
  }
};

function layout() {
  const [w, h] = win.getContentSize();
  igView.setBounds({ x: PANEL_WIDTH, y: 0, width: Math.max(0, w - PANEL_WIDTH), height: h });
}

async function createWindow() {
  const injected = await fs.readFile(path.join(dir, 'src/ig-main.js'), 'utf8');

  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    title: 'Torrey Voice Notes',
    backgroundColor: '#111114',
    webPreferences: { preload: path.join(dir, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(dir, 'src/index.html'));

  igView = new WebContentsView({
    webPreferences: {
      partition: 'persist:instagram',
      preload: path.join(dir, 'ig-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.contentView.addChildView(igView);
  layout();
  win.on('resize', layout);

  const ig = igView.webContents;
  ig.on('dom-ready', () => {
    if (isInstagram(ig.getURL())) ig.executeJavaScript(injected).catch(() => {});
  });
  // Facebook / Instagram login popups stay in the app; everything else opens in the browser.
  ig.setWindowOpenHandler(({ url }) => {
    if (isInstagram(url) || /(^|\.)facebook\.com$/.test(new URL(url).hostname)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  ig.loadURL(`${IG_BASE}/direct/inbox/`);
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

ipcMain.handle('ig:arm', (_e, wav, meta) => igView.webContents.send('ivn:arm', { wav, ...meta }));
ipcMain.handle('ig:disarm', () => igView.webContents.send('ivn:disarm'));
ipcMain.handle('ig:open', (_e, handle) => igView.webContents.loadURL(`${IG_BASE}/${encodeURIComponent(handle)}/`));
ipcMain.handle('ig:grab', () => igView.webContents.executeJavaScript(GRAB));
ipcMain.on('ig:status', (_e, m) => win?.webContents.send('ig:status', m));

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
  await createWindow();
});

app.on('window-all-closed', () => app.quit());
