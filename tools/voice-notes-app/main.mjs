import { app, BaseWindow, WebContentsView, clipboard, ipcMain, screen, session, shell, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFollowRunner } from './follow-runner.mjs';
import * as leads from './src/leads.js';
import { speak } from './src/voice.js';

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
let follower;
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

const toRecorder = (m, channel = 'ig:status') => win && recorder.webContents.send(channel, m);
const ig = () => igView.webContents;

function layout() {
  const { width, height } = win.contentView.getBounds();
  recorder.setBounds({ x: 0, y: 0, width: PANE, height });
  // The 1px gap shows the window background as a divider. Both Instagram tabs share the right side; one sits on top.
  const right = { x: PANE + 1, y: 0, width: Math.max(0, width - PANE - 1), height };
  igView.setBounds(right);
  followView.setBounds(right);
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
  win.contentView.addChildView(recorder);
  win.contentView.addChildView(followView);
  win.contentView.addChildView(igView);
  layout();
  // Follows the content area rather than the window, which also catches the menu bar settling and full screen.
  win.contentView.on('bounds-changed', layout);
  win.on('closed', () => {
    recorder.webContents.close();
    igView.webContents.close();
    followView.webContents.close();
    win = null;
  });

  recorder.webContents.loadFile(path.join(dir, 'src/index.html'));
  recorder.webContents.once('did-finish-load', () => recorder.webContents.focus());

  const wc = igView.webContents;
  wc.on('dom-ready', async () => {
    if (!isInstagram(wc.getURL())) return;
    await wc.executeJavaScript(injected).catch(() => {});
    if (pendingArm) wc.send('ivn:arm', pendingArm);
  });
  // The pane can't be closed and reopened, so recover from a crashed Instagram page by reloading it.
  wc.on('render-process-gone', () => setTimeout(() => !wc.isDestroyed() && wc.reload(), 500));
  // Facebook / Instagram login popups stay in the app; everything else opens in the browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isInstagram(url) || /(^|\.)facebook\.com$/.test(new URL(url).hostname)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.loadURL(`${IG_BASE}/direct/inbox/`);
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
// `pt` comes from a page script: a point to click, { clicked } if it already clicked, or null if nothing was found.
function clickPoint(wc, pt) {
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

const igClick = async (wc, what) => clickPoint(wc, await wc.executeJavaScript(`(${igPage})(${JSON.stringify(what)})`, true));

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
  if (!ig().isLoading()) ig().send('ivn:arm', pendingArm);
});
ipcMain.handle('ig:disarm', () => {
  pendingArm = null;
  ig().send('ivn:disarm');
});
ipcMain.handle('ig:open', (_e, handle) => ig().loadURL(`${IG_BASE}/${encodeURIComponent(handle)}/`));
// Puts the keyboard in the Instagram pane, for when you need to finish something there by hand.
ipcMain.handle('ig:show', () => ig().focus());
ipcMain.handle('ig:grab', () => ig().executeJavaScript(GRAB));
ipcMain.handle('ig:do', async (_e, action, handle) => {
  const wc = ig();
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

// The recorder shows the follow tab on the right while its Follow screen is open.
ipcMain.handle('pane:show', (_e, which) => win.contentView.addChildView(which === 'follow' ? followView : igView));
ipcMain.handle('follow:config', (_e, at) => follower.configure(at));
ipcMain.handle('follow:set', (_e, on) => follower.setEnabled(!!on));
ipcMain.handle('follow:state', () => follower.snapshot());

ipcMain.handle('airtable:pull', (_e, at) => leads.pullAirtable(at));
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
    // Test runs only: short gaps and no time-of-day window. The daily caps still apply.
    fast: process.env.TVN_TEST_FOLLOW === '1',
  });
  createWindow();
  await follower.init();
});

app.on('activate', () => {
  if (!win) createWindow();
});
app.on('window-all-closed', () => app.quit());
