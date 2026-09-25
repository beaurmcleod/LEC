import * as store from './store.js';
import * as audio from './audio.js';
import * as leads from './leads.js';

// Read this off the screen when recording the pitch. About 32 seconds at a normal pace.
const PITCH_SCRIPT = `Figured a real voice beats another copy-paste DM. I'm Garrett with Torrey Labs — we're a peptide company here in San Diego, every batch third-party tested.

Your clients are probably already asking you about peptides for weight loss or recovery. We give you your own link: they order straight from us, you never touch product or money, and you get twenty percent on every order, for life. One of our trainers already clears a grand a month, just from referrals.

Worth a look? Reply and I'll send the details.`;

// One custom intro line per lead, then the whole pitch in one take. Setup can split the pitch into more parts.
const DEFAULT_TEMPLATE = [
  { id: 'intro', kind: 'slot', label: 'Intro', script: "Hey {name} — saw you're the {role} at {business}." },
  { id: 'pitch', kind: 'fixed', label: 'Pitch', script: PITCH_SCRIPT },
];

const OLD_SCRIPTS = { greet: 'Hi {name}!', specific: "I see you're the {role} at {business}." };
const OLD_SHAPES = {
  'greet:slot,pitch1:fixed,specific:slot,pitch2:fixed': ['pitch1', 'pitch2'],
  'greet:slot,specific:slot,pitch:fixed': ['pitch'],
};

// Earlier layouts had two custom lines ("Hi {name}!" and "I see you're the...") and, before that, a pitch split
// in two. An untouched copy moves to the single intro line. A recorded pitch is kept (halves joined), and the
// old per-lead lines are cleared so every lead shows the new intro as not recorded yet. Edited layouts stay
// as they are, but the pitch still gets the script if it has none.
async function migrateTemplate(t) {
  const shape = t.map((seg) => `${seg.id}:${seg.kind}`).join(',');
  const pitchIds = OLD_SHAPES[shape];
  const untouched = t.filter((seg) => seg.kind === 'slot').every((seg) => seg.script === OLD_SCRIPTS[seg.id]);
  if (!pitchIds || !untouched) {
    const pitch = t.find((seg) => seg.kind === 'fixed' && seg.id === 'pitch');
    if (pitch && pitch.script == null) {
      pitch.script = PITCH_SCRIPT;
      await store.put('kv', 'template', t);
    }
    return t;
  }
  const next = structuredClone(DEFAULT_TEMPLATE);
  const pitch = next[1];
  const oldPitch = t.find((seg) => seg.id === 'pitch');
  if (oldPitch?.label) pitch.label = oldPitch.label;
  if (pitchIds.length > 1) {
    const halves = (await Promise.all(pitchIds.map((id) => getAudio(`fixed:${id}`)))).filter(Boolean);
    if (halves.length) await setAudio(fixedKey(pitch), audio.concat(halves, 0), { source: 'joined' });
    for (const id of pitchIds) await delAudio(`fixed:${id}`);
  }
  for (const key of Object.keys(S.lens)) if (/^slot:.*:(greet|specific)$/.test(key)) await delAudio(key);
  await store.put('kv', 'template', next);
  return next;
}

// A rough read-aloud time, so the pitch stays short.
function readTime(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return words ? `${words} words · about ${Math.round(words / 160 * 60)} seconds out loud` : '';
}

const DEFAULT_SETTINGS = {
  gapMs: 0,
  leadInMs: 300,
  monitor: true,
  autoOpen: true,
  autoSend: true,
  autoSync: true,
  readyOnly: true,
  followPerDay: 50,
  airtable: {
    token: '',
    baseId: 'appdAJbStcwrV2bq5',
    table: 'Leads',
    formula: "AND({Instagram} != '', OR({Status} = 'New', {Status} = 'Researched', {Status} = 'Ready'), {Track} != 'Skip')",
    max: 100,
    writeBack: true,
  },
  eleven: {
    key: '',
    voiceId: '',
    model: 'eleven_v3',
    stability: 0.5,
    similarity: 0.75,
    style: 0,
    speed: 1,
    speakerBoost: true,
  },
};

const VOICE_DEFAULTS = { stability: 0.5, similarity: 0.75, style: 0, speed: 1, speakerBoost: true };
const MODELS = [
  ['eleven_v3', 'Eleven v3 (most expressive)'],
  ['eleven_v4', 'Eleven v4 (newest)'],
  ['eleven_multilingual_v2', 'Multilingual v2 (steadiest, all sliders apply)'],
];

const PLACEHOLDERS = ['name', 'first', 'role', 'business', 'handle', 'note', 'hook', 'category'];
// Refreshed from Airtable on every sync, unless you've edited that field here.
const REFRESH_FIELDS = ['first', 'role', 'business', 'category', 'hook', 'bio', 'research', 'notes', 'atStatus', 'followedAt'];
const MAX_SECONDS = 59;
const SYNC_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const S = {
  view: 'leads',
  filter: 'todo',
  currentId: null,
  template: [],
  settings: null,
  prospects: [],
  lens: {},
  rec: null,
  busy: '',
  armed: null,
  sending: null,
  send: { pid: null, state: '', text: '' },
  sync: { at: 0, error: '', running: false },
  follow: null,
};

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');

// ---------- helpers ----------

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const secs = (n) => `${n.toFixed(1)}s`;
const errText = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const toArrayBuffer = (x) => {
  const u8 = x instanceof ArrayBuffer ? new Uint8Array(x) : new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
};

let toastTimer;
function toast(msg, ms = 4000) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($toast.hidden = true), ms);
}

function setBusy(text) {
  S.busy = text;
  render();
}

const fixedKey = (seg) => `fixed:${seg.id}`;
const slotKey = (p, seg) => `slot:${p.id}:${seg.id}`;
const partKey = (p, seg) => (seg.kind === 'fixed' ? fixedKey(seg) : slotKey(p, seg));
const slots = () => S.template.filter((s) => s.kind === 'slot');
const current = () => S.prospects.find((p) => p.id === S.currentId);

const saveTemplate = () => store.put('kv', 'template', S.template);
// The follow runner lives in the main process and needs the Airtable details; the token stays in these settings.
const pushFollowConfig = () => {
  const { token, baseId, table } = S.settings.airtable;
  window.api.followConfig({ token, baseId, table, perDay: S.settings.followPerDay });
};
const saveSettings = () => {
  pushFollowConfig();
  return store.put('kv', 'settings', S.settings);
};

let savedTimer;
// Shows a short "Saved" pill once typing pauses, so it's clear Setup changes stuck.
function flashSaved() {
  const el = document.getElementById('saved');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    el.hidden = false;
    savedTimer = setTimeout(() => (el.hidden = true), 1500);
  }, 350);
}
const saveProspects = () => store.put('kv', 'prospects', S.prospects);
const saveLens = () => store.put('kv', 'lens', S.lens);

async function setAudio(key, samples, meta = {}) {
  await store.put('audio', key, { samples, ...meta });
  S.lens[key] = samples.length / audio.SR;
  await saveLens();
}

async function getAudio(key) {
  return (await store.get('audio', key))?.samples || null;
}

async function delAudio(key) {
  await store.del('audio', key);
  delete S.lens[key];
  await saveLens();
}

// Empty fields show as ___ so you can see what to improvise when recording.
function renderScript(script, p) {
  const vars = { ...p, handle: p.handle ? `@${p.handle}` : '' };
  return (script || '').replace(/\{(\w+)\}/g, (m, k) => (PLACEHOLDERS.includes(k) ? vars[k] || '___' : m));
}

function spokenScript(script, p) {
  return renderScript(script, p).replace(/\s*___\s*/g, ' ').replace(/\s+([.,!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

function missingFixed() {
  return S.template.filter((s) => s.kind === 'fixed' && !S.lens[fixedKey(s)]);
}

function missingParts(p) {
  return S.template.filter((s) => !S.lens[partKey(p, s)]);
}

const clipSeconds = (p) => S.template.reduce((n, s) => n + (S.lens[partKey(p, s)] || 0), 0);

// "Ready only" hides leads Make hasn't finished researching. Leads added by hand or CSV have no Airtable status and always show.
const researched = (p) => !S.settings.readyOnly || !p.atStatus || p.atStatus === 'Ready';
// Airtable leads only come up for a DM a day after the follow step followed them.
const followedLongEnough = (p) => !p.airtableId || (!!p.followedAt && Date.now() - Date.parse(p.followedAt) >= DAY_MS);
const shown = (p) => researched(p) && followedLongEnough(p);
const todoList = () => S.prospects.filter((p) => p.status === 'todo' && shown(p));
const newCount = () => todoList().filter((p) => p.isNew).length;

function filtered() {
  const list = S.prospects.filter(shown);
  return S.filter === 'all' ? list : list.filter((p) => p.status === S.filter);
}

// ---------- audio ----------

let player = null;

// Play buttons flip to Stop while their audio plays, without a full re-render.
function syncPlayButtons() {
  for (const el of document.querySelectorAll('[data-play]')) el.textContent = player?.key === el.dataset.play ? el.dataset.stop : el.dataset.label;
}

function stopPlay() {
  if (!player) return;
  try {
    player.src.stop();
  } catch {}
  player.ctx.close();
  player = null;
  syncPlayButtons();
}

function play(samples, key = '') {
  stopPlay();
  const ctx = new AudioContext({ sampleRate: audio.SR });
  const buf = ctx.createBuffer(1, samples.length, audio.SR);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.onended = () => player?.src === src && stopPlay();
  src.start();
  player = { ctx, src, key };
  syncPlayButtons();
}

function playButton(key, label, getSamples, attrs = {}, stopLabel = 'Stop') {
  const onclick = async () => {
    if (player?.key === key) return stopPlay();
    try {
      const samples = await getSamples();
      if (samples) play(samples, key);
    } catch (e) {
      toast(e.message);
    }
  };
  return h('button', { 'data-play': key, 'data-label': label, 'data-stop': stopLabel, onclick, ...attrs }, player?.key === key ? stopLabel : label);
}

let meterTimer;
async function toggleRecord(key) {
  if (S.rec) {
    if (S.rec.key !== key) return toast('Finish the current recording first.');
    return stopRecording();
  }
  if (S.sending) return toast('Wait for the send to finish.');
  stopPlay();
  const recorder = new audio.MicRecorder();
  try {
    await recorder.start();
  } catch (e) {
    return toast(`Can't use the mic (${e.name}). Allow it in System Settings > Privacy & Security > Microphone.`, 8000);
  }
  const started = performance.now();
  S.rec = { key, recorder };
  render();
  meterTimer = setInterval(() => {
    const t = document.getElementById('rec-timer');
    const m = document.getElementById('rec-meter');
    if (t) t.textContent = secs((performance.now() - started) / 1000);
    if (m) m.style.width = `${Math.max(0, Math.min(100, ((20 * Math.log10(recorder.level() + 1e-9) + 60) / 60) * 100))}%`;
  }, 50);
}

async function stopRecording() {
  const { key, recorder } = S.rec;
  S.rec = null;
  clearInterval(meterTimer);
  try {
    const samples = audio.processTake(await recorder.stop(), { chopStartMs: 60, chopEndMs: 180 });
    if (samples.length < audio.SR * 0.25) toast("Didn't catch that. Check your mic and try again.");
    else {
      await setAudio(key, samples, { source: 'mic' });
      // A re-take makes any clip already loaded into Instagram out of date.
      if (S.armed && key.includes(`:${S.armed}:`)) {
        window.api.disarm();
        setSend(S.armed, '', '');
      }
    }
  } catch {
    toast("Didn't catch that. Try a slightly longer take.");
  }
  render();
}

async function uploadFixed(seg, file) {
  try {
    const raw = await audio.decodeToMono(await file.arrayBuffer());
    const samples = audio.processTake(raw);
    if (!samples.length) return toast('That file sounds silent.');
    await setAudio(fixedKey(seg), samples, { source: 'file', name: file.name });
    render();
  } catch (e) {
    toast(`Couldn't read that file: ${e.message}`);
  }
}

const ttsReady = () => S.settings.eleven.key && S.settings.eleven.voiceId;

async function autoVoice(p, seg) {
  const text = spokenScript(seg.script, p);
  if (!text) throw new Error(`"${seg.label}" is empty for ${p.name || 'this lead'}`);
  const raw = await audio.decodeToMono(toArrayBuffer(await window.api.speak(text, S.settings.eleven)));
  await setAudio(slotKey(p, seg), audio.processTake(raw), { source: 'tts', text });
}

async function autoVoiceOne(p, seg) {
  setBusy(`Auto-voicing "${seg.label}"...`);
  try {
    await autoVoice(p, seg);
  } catch (e) {
    toast(errText(e));
  }
  setBusy('');
}

async function autoVoiceAll() {
  const jobs = [];
  for (const p of todoList()) {
    for (const seg of slots()) if (!S.lens[slotKey(p, seg)]) jobs.push([p, seg]);
  }
  if (!jobs.length) return toast('Every to-do lead already has its lines.');
  for (let i = 0; i < jobs.length; i++) {
    setBusy(`Auto-voicing ${i + 1} of ${jobs.length}...`);
    try {
      await autoVoice(...jobs[i]);
    } catch (e) {
      toast(errText(e), 8000);
      break;
    }
  }
  setBusy('');
}

async function buildClip(p) {
  const missing = missingParts(p);
  if (missing.length) throw new Error(`Still needs: ${missing.map((s) => s.label).join(', ')}`);
  const parts = [];
  for (const seg of S.template) parts.push(await getAudio(partKey(p, seg)));
  return audio.concat(parts, S.settings.gapMs);
}

// ---------- Send: open their DM, play the clip into the mic, hit send ----------

// Status updates from the Instagram pane. Send waits on these; otherwise they drive the status line.
const waiters = new Set();
function waitForStatus(states, ms) {
  return new Promise((resolve) => {
    const w = {
      states: [...states, 'error'],
      resolve: (m) => {
        clearTimeout(timer);
        waiters.delete(w);
        resolve(m);
      },
    };
    const timer = setTimeout(() => w.resolve({ state: 'timeout' }), ms);
    waiters.add(w);
  });
}

const STATUS_TEXT = {
  playing: 'Playing into Instagram...',
  done: 'Clip finished. Hit send in Instagram, then Mark sent.',
  stopped: 'Instagram stopped recording. If it sent, hit Mark sent.',
  idle: '',
};

window.api.onStatus((msg) => {
  for (const w of [...waiters]) if (w.states.includes(msg.state)) w.resolve(msg);
  if (['done', 'stopped', 'idle'].includes(msg.state)) S.armed = null;
  if (S.sending || !S.send.pid) return;
  let text = STATUS_TEXT[msg.state] ?? '';
  if (msg.state === 'armed') text = `Clip loaded (${fmt(msg.seconds)}). Open their DM in Instagram and click the mic.`;
  if (msg.state === 'error') text = msg.message;
  setSend(S.send.pid, msg.state, text);
});

function setSend(pid, state, text) {
  S.send = { pid, state, text };
  const el = document.getElementById('send-status');
  if (el && S.currentId === pid) {
    el.textContent = text;
    el.className = `status ${state}`;
    el.hidden = !text;
  }
}

async function sendNow(p) {
  if (S.rec || S.sending) return;
  if (!p.handle) return toast('Add their Instagram handle first (Edit details).');
  let samples;
  try {
    samples = await buildClip(p);
  } catch (e) {
    return toast(e.message);
  }
  stopPlay();
  const seconds = samples.length / audio.SR;
  if (seconds > MAX_SECONDS) toast('Heads up: this clip is over 60 seconds. Instagram may cut it off.', 7000);
  const say = (text, state = 'working') => setSend(p.id, state, text);
  // Anything the app can't do by itself is left for you with the clip still loaded, so one click finishes it.
  const handOff = (text) => {
    say(text, 'armed');
    window.api.showInstagram();
  };
  S.sending = p.id;
  render();
  try {
    say('Opening their DM...');
    const dmOpen = await window.api.igDo('openDm', p.handle).then(
      () => true,
      () => false,
    );

    say('Loading the clip...');
    const armed = waitForStatus(['armed'], 10000);
    await window.api.arm(audio.encodeWav(samples), { label: p.name, leadInMs: S.settings.leadInMs, monitor: S.settings.monitor });
    const a = await armed;
    if (a.state !== 'armed') throw new Error(a.message || "Instagram didn't take the clip. Try Send again.");
    S.armed = p.id;
    if (!dmOpen) return handOff("Couldn't open their DM by itself. The clip is loaded: open their DM in Instagram and click the mic.");

    say(`Recording into their DM (${fmt(seconds)})...`);
    const playing = waitForStatus(['playing'], 8000);
    const micClicked = await window.api.igDo('clickMic').then(
      () => true,
      () => false,
    );
    const pl = micClicked ? await playing : { state: 'timeout' };
    if (pl.state === 'error') throw new Error(pl.message);
    if (pl.state !== 'playing') return handOff('The clip is loaded. Click the mic in their DM and it plays in.');

    const done = await waitForStatus(['done', 'armed'], (seconds + 15) * 1000);
    if (done.state === 'armed') return handOff('Instagram stopped recording early. The clip is reloaded: click the mic to try again.');
    if (done.state !== 'done') throw new Error(done.message || 'The clip never finished playing. Check Instagram on the right.');

    if (!S.settings.autoSend) return handOff('Clip is in their DM. Hit send in Instagram, then Mark sent.');
    say('Sending...');
    const stopped = waitForStatus(['stopped'], 8000);
    const sendClicked = await window.api.igDo('clickSend').then(
      () => true,
      () => false,
    );
    const st = sendClicked ? await stopped : { state: 'timeout' };
    if (st.state !== 'stopped') return handOff('Clip is in their DM. Hit send in Instagram, then Mark sent.');

    say('Sent ✓', 'done');
    toast(`Sent to @${p.handle} ✓`);
    S.sending = null;
    await setStatus(p, 'sent', { advance: S.currentId === p.id });
  } catch (e) {
    say(errText(e), 'error');
  } finally {
    if (S.sending === p.id) {
      S.sending = null;
      render();
    }
  }
}

async function saveFile(p) {
  try {
    const file = await window.api.saveClip(audio.encodeWav(await buildClip(p)), p.handle || p.name);
    toast(`Saved to Music > Torrey Voice Notes and copied. Paste it anywhere.`);
    return file;
  } catch (e) {
    toast(errText(e));
  }
}

async function grab() {
  let info;
  try {
    info = await window.api.grab();
  } catch (e) {
    return toast(errText(e));
  }
  if (!info?.handle) return toast("Open the person's profile in Instagram on the right, then grab.");
  let p = S.prospects.find((x) => x.handle.toLowerCase() === info.handle.toLowerCase());
  if (!p) {
    p = leads.makeProspect({ handle: info.handle, business: info.displayName, bio: info.bio, source: 'instagram' });
    S.prospects.unshift(p);
  } else if (info.bio) {
    p.bio = info.bio;
  }
  await saveProspects();
  openLead(p.id, false);
}

// ---------- leads ----------

async function merge(incoming, { markNew = false } = {}) {
  let added = 0;
  let refreshed = 0;
  for (const inc of incoming) {
    const ex = S.prospects.find(
      (p) =>
        (inc.airtableId && p.airtableId === inc.airtableId) ||
        (inc.handle && p.handle && p.handle.toLowerCase() === inc.handle.toLowerCase()),
    );
    if (ex) {
      // Name and "what they do" follow Airtable only while they're still the auto-filled ones, so edits made
      // before edits were tracked survive too.
      const autoName = !ex.edited?.name && ex.name === leads.deriveName(ex);
      const autoNote = !ex.edited?.note && ex.note === leads.deriveNote(ex);
      for (const k of REFRESH_FIELDS) if (inc[k] && !ex.edited?.[k]) ex[k] = inc[k];
      if (autoName && inc.name) ex.name = inc.name;
      if (autoNote && inc.note) ex.note = inc.note;
      ex.airtableId ||= inc.airtableId;
      refreshed++;
    } else {
      if (markNew) inc.isNew = true;
      S.prospects.push(inc);
      added++;
    }
  }
  await saveProspects();
  return { added, refreshed };
}

function syncText() {
  if (!S.settings.airtable.token) return 'Airtable not connected.';
  if (S.sync.running) return 'Checking Airtable for new leads...';
  if (S.sync.error) return `Airtable: ${S.sync.error}`;
  if (!S.sync.at) return 'Not synced yet.';
  const min = Math.round((Date.now() - S.sync.at) / 60000);
  const n = newCount();
  return `Synced ${min < 1 ? 'just now' : `${min} min ago`}${n ? ` · ${n} new` : ''}`;
}

// Updates the sync line and the new-leads badge in place, so a background sync never interrupts recording or typing.
function paintSync() {
  const n = newCount();
  const badge = document.getElementById('new-badge');
  if (badge) {
    badge.textContent = n;
    badge.hidden = !n;
  }
  const line = document.getElementById('sync-line');
  if (line) {
    line.textContent = syncText();
    line.className = `grow small ${S.sync.error ? 'bad' : 'muted'}`;
  }
}

// Pulls new and updated leads from Airtable (where Make drops them). Runs on launch, every 15 minutes, and on Sync now.
async function sync({ quiet = false } = {}) {
  const at = S.settings.airtable;
  if (!at.token) {
    if (quiet) return;
    S.view = 'setup';
    render();
    return toast('Add your Airtable token first (Setup > Airtable).');
  }
  if (S.sync.running) return;
  S.sync.running = true;
  paintSync();
  try {
    // The first pull brings in the whole list, so nothing is flagged new until the second.
    const firstPull = !S.prospects.some((p) => p.airtableId);
    const formula = at.formula ? `AND(${at.formula}, ${leads.FOLLOWED_A_DAY_AGO})` : leads.FOLLOWED_A_DAY_AGO;
    const { added, refreshed } = await merge(await window.api.pullAirtable({ ...at, formula }), { markNew: !firstPull });
    S.sync.at = Date.now();
    S.sync.error = '';
    if (!quiet) toast(`${added} new lead${added === 1 ? '' : 's'}, ${refreshed} refreshed.`);
  } catch (e) {
    S.sync.error = errText(e);
    if (!quiet) toast(`Airtable: ${S.sync.error}`, 8000);
  }
  S.sync.running = false;
  if (S.view === 'leads' && !S.currentId && !S.rec) render();
  else paintSync();
}

async function importCSV(file) {
  try {
    const found = leads.fromCSV(await file.text());
    if (!found.length) return toast('No leads found in that file.');
    const { added, refreshed } = await merge(found);
    toast(`${added} new lead${added === 1 ? '' : 's'}, ${refreshed} refreshed.`);
  } catch (e) {
    toast(`CSV: ${e.message}`);
  }
  render();
}

async function addManual() {
  const p = leads.makeProspect({ source: 'manual' });
  S.prospects.unshift(p);
  await saveProspects();
  openLead(p.id, false);
}

function openLead(id, openProfile = true) {
  S.currentId = id;
  S.view = 'leads';
  const p = current();
  if (p?.isNew) {
    delete p.isNew;
    saveProspects();
  }
  render();
  window.scrollTo(0, 0);
  if (openProfile && S.settings.autoOpen && p?.handle) window.api.openProfile(p.handle).catch(() => {});
}

function nextTodo(fromId) {
  const list = todoList().filter((p) => p.id !== fromId);
  const i = S.prospects.findIndex((p) => p.id === fromId);
  return list.find((p) => S.prospects.indexOf(p) > i) || list[0] || null;
}

async function setStatus(p, status, { advance = true } = {}) {
  p.status = status;
  p.sentAt = status === 'sent' ? Date.now() : null;
  await saveProspects();
  const at = S.settings.airtable;
  if (status === 'sent' && at.writeBack && at.token && p.airtableId) {
    window.api.markSent(at, p.airtableId).catch((e) => toast(`Marked sent here, but Airtable said: ${errText(e)}`, 8000));
  }
  if (status === 'todo' || !advance) return render();
  const next = nextTodo(p.id);
  if (next) openLead(next.id);
  else {
    S.currentId = null;
    render();
    toast('That was the last one on your to-do list.');
  }
}

async function deleteLead(p) {
  if (!confirm(`Delete ${p.name || 'this lead'}?`)) return;
  for (const seg of S.template) await delAudio(slotKey(p, seg));
  S.prospects = S.prospects.filter((x) => x.id !== p.id);
  S.currentId = null;
  await saveProspects();
  render();
}

// ---------- template ----------

async function addSegment(kind) {
  const pitches = S.template.filter((seg) => seg.kind === 'fixed').length;
  const label = kind === 'fixed' ? `Pitch, part ${pitches + 1}` : 'New custom line';
  S.template.push({ id: leads.uid(), kind, label, script: '' });
  await saveTemplate();
  render();
}

async function removeSegment(seg) {
  if (!confirm(`Remove "${seg.label}"? Its recordings will be deleted.`)) return;
  S.template = S.template.filter((s) => s !== seg);
  const suffix = `:${seg.id}`;
  for (const key of Object.keys(S.lens)) {
    if (key === fixedKey(seg) || (key.startsWith('slot:') && key.endsWith(suffix))) await delAudio(key);
  }
  await saveTemplate();
  render();
}

async function moveSegment(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= S.template.length) return;
  [S.template[i], S.template[j]] = [S.template[j], S.template[i]];
  await saveTemplate();
  render();
}

// ---------- views ----------

function recButton(key, label = 'Record') {
  const on = S.rec?.key === key;
  return h(
    'button',
    { class: on ? 'rec' : '', onclick: () => toggleRecord(key), disabled: (!!S.rec && !on) || !!S.sending },
    on ? ['Stop ', h('span', { id: 'rec-timer' }, '0.0s')] : S.lens[key] ? 'Redo' : label,
  );
}

function meter(key) {
  return S.rec?.key === key ? h('div', { class: 'meter' }, h('div', { id: 'rec-meter' })) : null;
}

const goSetup = () => {
  S.view = 'setup';
  render();
};

function header() {
  const n = newCount();
  const leadsTab = () => {
    // Clicking Leads while already there goes back to the list.
    if (S.view === 'leads') S.currentId = null;
    S.view = 'leads';
    render();
  };
  return h(
    'header',
    { class: 'top' },
    h('h1', {}, 'Torrey Voice Notes'),
    h(
      'div',
      { class: 'tabs' },
      h('button', { class: `tab ${S.view === 'leads' ? 'on' : ''}`, onclick: leadsTab }, 'Leads', h('span', { id: 'new-badge', class: 'badge', hidden: !n }, n)),
      h(
        'button',
        { class: `tab ${S.view === 'follow' ? 'on' : ''}`, onclick: () => ((S.view = 'follow'), render()) },
        'Follow',
        h('span', { id: 'follow-dot', class: `dot ${followDot()}` }),
      ),
      h('button', { class: `tab ${S.view === 'setup' ? 'on' : ''}`, onclick: goSetup }, 'Setup'),
    ),
  );
}

function leadsView() {
  const all = S.prospects.filter(shown);
  const count = (st) => all.filter((p) => p.status === st).length;
  const chip = (id, label) =>
    h('button', { class: `tab ${S.filter === id ? 'on' : ''}`, onclick: () => ((S.filter = id), render()) }, label);
  const file = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: (e) => e.target.files[0] && importCSV(e.target.files[0]) });
  const list = filtered();
  const need = missingFixed();
  const next = todoList()[0];
  const connected = !!S.settings.airtable.token;
  const waiting = S.prospects.filter((p) => p.status === 'todo');
  const notReady = waiting.filter((p) => !researched(p)).length;
  const notFollowed = waiting.filter((p) => researched(p) && !followedLongEnough(p)).length;

  return h(
    'main',
    {},
    need.length ? h('div', { class: 'status error' }, `Record your pitch first: ${need.map((s) => s.label).join(', ')}. `, h('button', { class: 'link', onclick: goSetup }, 'Go to Setup')) : null,
    h(
      'div',
      { class: 'card sync' },
      h(
        'div',
        { class: 'row-flex' },
        h('span', { id: 'sync-line', class: `grow small ${S.sync.error ? 'bad' : 'muted'}` }, syncText()),
        connected ? h('button', { onclick: () => sync(), disabled: S.sync.running }, 'Sync now') : h('button', { onclick: goSetup }, 'Connect Airtable'),
      ),
    ),
    h(
      'button',
      { class: 'enter', onclick: () => next && openLead(next.id), disabled: !next },
      next ? `Start next lead: ${next.name || `@${next.handle}`}` : 'Nothing left to do',
      next ? h('span', {}, 'Enter') : null,
    ),
    h(
      'div',
      { class: 'row-flex' },
      chip('todo', `To do (${count('todo')})`),
      chip('sent', `Sent (${count('sent')})`),
      chip('skipped', `Skipped (${count('skipped')})`),
      chip('all', 'All'),
      h('span', { class: 'grow' }),
      h(
        'label',
        { class: 'check inline', title: 'Only leads Make has finished researching (Status = Ready in Airtable)' },
        h('input', {
          type: 'checkbox',
          checked: S.settings.readyOnly,
          onchange: (e) => {
            S.settings.readyOnly = e.target.checked;
            saveSettings();
            render();
          },
        }),
        'Ready only',
      ),
    ),
    list.length
      ? h('div', { class: 'list' }, list.map(leadRow))
      : h('p', { class: 'muted' }, S.prospects.length ? 'Nothing here.' : 'No leads yet. Connect Airtable in Setup, import a CSV, or open a profile in Instagram on the right and hit Grab from IG.'),
    notReady || notFollowed
      ? h(
          'p',
          { class: 'muted small' },
          'Hidden for now: ',
          [notReady ? `${notReady} still being researched` : '', notFollowed ? `${notFollowed} not followed a day ago yet` : ''].filter(Boolean).join(', '),
          '.',
        )
      : null,
    h(
      'div',
      { class: 'row-flex small-actions' },
      h('button', { onclick: () => file.click() }, 'Import CSV'),
      h('button', { onclick: grab }, 'Grab from IG'),
      h('button', { onclick: addManual }, '+ Add'),
      ttsReady() ? h('button', { onclick: autoVoiceAll, disabled: !!S.busy }, 'Auto-voice all missing lines') : null,
      file,
    ),
    S.busy ? h('p', { class: 'muted small' }, S.busy) : null,
  );
}

function leadRow(p) {
  const total = S.template.length;
  const done = total - missingParts(p).length;
  let pill;
  if (p.status === 'sent') pill = h('span', { class: 'tag ok' }, 'sent');
  else if (p.status === 'skipped') pill = h('span', { class: 'tag' }, 'skipped');
  else if (done === total) pill = h('span', { class: 'tag ok' }, 'ready to send');
  else pill = h('span', { class: 'tag warn' }, `${done}/${total} parts`);
  return h(
    'button',
    { class: 'lead', onclick: () => openLead(p.id) },
    h(
      'div',
      { class: 'who' },
      h('span', {}, h('b', {}, p.name || '(no name)')),
      h('span', { class: 'muted small' }, [p.handle ? `@${p.handle}` : 'no handle', p.role, p.business !== p.name ? p.business : ''].filter(Boolean).join(' · ')),
    ),
    p.isNew ? h('span', { class: 'tag new' }, 'new') : null,
    pill,
  );
}

function field(label, value, onInput, attrs = {}) {
  return h('label', { class: 'field' }, label, h('input', { value, oninput: (e) => onInput(e.target.value), ...attrs }));
}

// One line of the voice note: your custom lines get Record / Play, the pitch parts just show they're there.
function lineRow(p, seg) {
  if (seg.kind === 'fixed') {
    const key = fixedKey(seg);
    const len = S.lens[key];
    return h(
      'div',
      { class: 'line fixed' },
      h('span', { class: 'grow' }, seg.label),
      len ? h('span', { class: 'tag' }, secs(len)) : h('button', { class: 'link warn', onclick: goSetup }, 'Record it in Setup'),
      len ? playButton(key, 'Play', () => getAudio(key), { class: 'icon' }) : null,
    );
  }
  const key = slotKey(p, seg);
  const len = S.lens[key];
  const live = S.rec?.key === key;
  return h(
    'div',
    { class: `line slot ${live ? 'live' : ''}` },
    h('div', { class: 'script', 'data-seg': seg.id }, renderScript(seg.script, p)),
    meter(key),
    h(
      'div',
      { class: 'row-flex' },
      recButton(key),
      playButton(key, 'Play', () => getAudio(key), { disabled: !len || live }),
      ttsReady() ? h('button', { onclick: () => autoVoiceOne(p, seg), disabled: !!S.busy || !!S.rec || !!S.sending }, 'Auto-voice') : null,
      h('span', { class: 'grow' }),
      len ? h('span', { class: 'tag ok' }, `✓ ${secs(len)}`) : h('span', { class: 'tag warn' }, 'not recorded'),
    ),
  );
}

const step = (n, title) => h('h2', { class: 'step' }, h('span', { class: 'n' }, n), title);

function detailView(p) {
  const list = filtered();
  const idx = list.indexOf(p);
  const go = (d) => list[idx + d] && openLead(list[idx + d].id);
  const todo = todoList();
  const pos = todo.indexOf(p);
  const edit = (k) => (v) => {
    p[k] = k === 'handle' ? leads.cleanHandle(v) : v;
    // Your edits win over later Airtable syncs.
    p.edited = { ...p.edited, [k]: true };
    saveProspects();
    for (const el of document.querySelectorAll('[data-seg]')) {
      el.textContent = renderScript(S.template.find((s) => s.id === el.dataset.seg).script, p);
    }
  };
  const ref = [
    ['Personal hook', p.hook],
    ['Category', p.category],
    ['IG bio', p.bio],
    ['Research', p.research],
    ['Notes', p.notes],
  ].filter(([, v]) => v);
  const missing = missingParts(p);
  const sendStatus = S.send.pid === p.id ? S.send : { state: '', text: '' };
  const sending = S.sending === p.id;
  const blocked = !!missing.length || !!S.rec || !!S.sending;
  const who = [p.role, p.business && p.business !== p.name ? p.business : ''].filter(Boolean).join(' at ');

  return h(
    'main',
    {},
    h(
      'div',
      { class: 'row-flex' },
      h('button', { onclick: () => ((S.currentId = null), render()) }, '< All leads'),
      h('span', { class: 'grow muted small center' }, pos >= 0 ? `Lead ${pos + 1} of ${todo.length}` : ''),
      h('button', { onclick: () => go(-1), disabled: idx <= 0 }, 'Prev'),
      h('button', { onclick: () => go(1), disabled: idx < 0 || idx >= list.length - 1 }, 'Next'),
    ),
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'lead-title' },
        h('b', {}, p.name || '(no name)'),
        p.handle
          ? h('button', { class: 'link', title: 'Open their profile in Instagram', onclick: () => window.api.openProfile(p.handle).catch(() => {}) }, `@${p.handle}`)
          : h('span', { class: 'tag warn' }, 'no Instagram'),
      ),
      who ? h('p', { class: 'muted' }, who) : null,
      p.hook ? h('p', { class: 'small clamp', title: p.hook }, p.hook) : null,
      h(
        'details',
        { class: 'ref' },
        h('summary', {}, 'Edit details'),
        h(
          'div',
          { class: 'edit' },
          h('div', { class: 'grid2' }, field('Name to say', p.name, edit('name')), field('Role', p.role, edit('role'), { placeholder: 'e.g. owner, head coach' })),
          h('div', { class: 'grid2' }, field('Business', p.business, edit('business')), field('Instagram', p.handle, edit('handle'), { placeholder: 'handle' })),
          field('What they do', p.note, edit('note'), { placeholder: 'e.g. small group training' }),
        ),
      ),
      ref.length ? h('details', { class: 'ref' }, h('summary', {}, 'Lead info'), h('dl', {}, ref.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))) : null,
    ),

    step('1', 'Record your lines'),
    h('div', { class: 'card lines' }, S.template.map((seg) => lineRow(p, seg))),
    h('p', { class: 'muted small' }, 'Space records the next line. Enter previews. ⌘ Enter sends.'),
    S.busy ? h('p', { class: 'muted small' }, S.busy) : null,

    step('2', 'Listen'),
    missing.length
      ? h('button', { class: 'big', disabled: true }, `Record ${missing.map((s) => s.label).join(', ')} first`)
      : playButton(`preview:${p.id}`, `▶ Preview the whole clip (${fmt(clipSeconds(p))})`, () => buildClip(p), { class: 'big', disabled: !!S.rec || !!S.sending }, '■ Stop preview'),

    step('3', 'Send'),
    h(
      'button',
      { class: 'enter', onclick: () => sendNow(p), disabled: blocked || !p.handle },
      sending ? 'Sending...' : p.handle ? `Send to @${p.handle}` : 'Add their Instagram to send',
      sending ? null : h('span', {}, '⌘ Enter'),
    ),
    h('p', { id: 'send-status', class: `status ${sendStatus.state}`, hidden: !sendStatus.text }, sendStatus.text),
    p.status === 'todo'
      ? h(
          'div',
          { class: 'row-flex small' },
          h('button', { class: 'link', onclick: () => setStatus(p, 'sent'), disabled: sending }, 'Mark sent'),
          h('button', { class: 'link', onclick: () => setStatus(p, 'skipped'), disabled: sending }, 'Skip'),
          h('button', { class: 'link', onclick: () => saveFile(p), disabled: !!missing.length }, 'Save as file'),
          h('span', { class: 'grow' }),
          h('button', { class: 'link', onclick: () => deleteLead(p), disabled: sending }, 'Delete'),
        )
      : h(
          'div',
          { class: 'row-flex' },
          h('span', { class: 'tag' }, p.status),
          h('button', { onclick: () => setStatus(p, 'todo') }, 'Move back to to-do'),
          h('span', { class: 'grow' }),
          h('button', { class: 'link', onclick: () => deleteLead(p) }, 'Delete'),
        ),
  );
}

function segmentCard(seg, i) {
  const fixed = seg.kind === 'fixed';
  const key = fixedKey(seg);
  const file = h('input', { type: 'file', accept: 'audio/*', hidden: true, onchange: (e) => e.target.files[0] && uploadFixed(seg, e.target.files[0]) });
  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'row-flex' },
      h('span', { class: 'tag' }, `${i + 1}. ${fixed ? 'Recorded once' : 'Custom per lead'}`),
      h('span', { class: 'grow' }),
      h('button', { class: 'icon', title: 'Move up', onclick: () => moveSegment(i, -1), disabled: i === 0 }, '↑'),
      h('button', { class: 'icon', title: 'Move down', onclick: () => moveSegment(i, 1), disabled: i === S.template.length - 1 }, '↓'),
      h('button', { class: 'icon', title: 'Remove', onclick: () => removeSegment(seg) }, '×'),
    ),
    h('input', { value: seg.label, 'aria-label': 'Part name', oninput: (e) => ((seg.label = e.target.value), saveTemplate().then(flashSaved)) }),
    fixed
      ? [
          h(
            'label',
            { class: 'field' },
            'Script (read it while you record)',
            h('textarea', {
              class: 'read-along',
              'aria-label': `${seg.label} script`,
              oninput: (e) => {
                seg.script = e.target.value;
                e.target.nextSibling.textContent = readTime(seg.script);
                saveTemplate().then(flashSaved);
              },
            }, seg.script || ''),
            h('span', { class: 'muted small' }, readTime(seg.script)),
          ),
          meter(key),
          h(
            'div',
            { class: 'row-flex' },
            recButton(key),
            playButton(key, 'Play', () => getAudio(key), { disabled: !S.lens[key] }),
            h('button', { onclick: () => file.click() }, 'Upload file'),
            S.lens[key] ? h('span', { class: 'tag ok' }, secs(S.lens[key])) : h('span', { class: 'tag warn' }, 'empty'),
            file,
          ),
        ]
      : h('label', { class: 'field' }, 'What you say (per lead)', h('input', { value: seg.script, placeholder: 'Hey {name}!', oninput: (e) => ((seg.script = e.target.value), saveTemplate().then(flashSaved)) })),
  );
}

function slider(obj, k, label, min, max, step, lo, hi) {
  const out = h('span', { class: 'tag' }, Number(obj[k]).toFixed(2));
  return h(
    'div',
    { class: 'slider' },
    h('div', { class: 'row-flex' }, h('b', { class: 'grow' }, label), out),
    h('input', {
      type: 'range',
      min,
      max,
      step,
      value: obj[k],
      'aria-label': label,
      oninput: (e) => {
        obj[k] = Number(e.target.value);
        out.textContent = obj[k].toFixed(2);
        saveSettings().then(flashSaved);
      },
    }),
    h('div', { class: 'row-flex muted small' }, h('span', { class: 'grow' }, lo), h('span', {}, hi)),
  );
}

async function testVoice() {
  setBusy('Generating a test line...');
  try {
    const raw = await audio.decodeToMono(toArrayBuffer(await window.api.speak("Hey, it's me. Quick test of how my voice notes sound.", S.settings.eleven)));
    play(audio.processTake(raw));
  } catch (e) {
    toast(errText(e), 8000);
  }
  setBusy('');
}

function resetVoice() {
  Object.assign(S.settings.eleven, VOICE_DEFAULTS);
  saveSettings().then(flashSaved);
  render();
}

function setupView() {
  const st = S.settings;
  const at = st.airtable;
  const el = st.eleven;
  const num = (obj, k) => (e) => {
    obj[k] = Math.max(0, parseInt(e.target.value, 10) || 0);
    saveSettings().then(flashSaved);
  };
  const txt = (obj, k) => (e) => {
    obj[k] = e.target.value.trim();
    saveSettings().then(flashSaved);
  };
  const check = (obj, k) => (e) => {
    obj[k] = e.target.checked;
    saveSettings().then(flashSaved);
  };
  const total = S.template.filter((s) => s.kind === 'fixed').reduce((n, s) => n + (S.lens[fixedKey(s)] || 0), 0);

  return h(
    'main',
    {},
    h('h2', {}, 'How it works'),
    h(
      'ol',
      { class: 'steps' },
      h('li', {}, 'Record your pitch below once, in one take, reading the script on screen. Use the same mic and spot you will use for the intro line.'),
      h('li', {}, 'Connect Airtable. New leads from Make show up by themselves (checked on launch and every 15 minutes).'),
      h('li', {}, 'Turn on Follow. It follows each lead and likes their latest post, up to your daily limit. A lead shows up for a DM a day after it was followed.'),
      h('li', {}, 'Hit Start next lead. You get a short script, and their profile opens in Instagram on the right.'),
      h('li', {}, 'Record your lines (Space), Preview to listen (Enter), then Send (⌘ Enter). The app opens their DM, plays the clip into the mic, and hits send. It arrives as a normal voice note.'),
    ),
    h('h2', {}, 'Your voice note, in order'),
    S.template.map(segmentCard),
    h('div', { class: 'row-flex' }, h('button', { onclick: () => addSegment('fixed') }, '+ Pitch part'), h('button', { onclick: () => addSegment('slot') }, '+ Custom line')),
    h('p', { class: 'muted small' }, 'Want a custom line in the middle of the pitch? Add a pitch part, then use the arrows to put the line between the two.'),
    h('p', { class: 'muted small' }, 'Before you record the pitch: only say "every batch third-party tested" if you can send the certificate the moment someone asks, and keep the referral example true to the numbers.'),
    h('p', { class: 'muted small' }, `Custom lines can use: ${PLACEHOLDERS.map((k) => `{${k}}`).join(' ')}. Recorded parts total ${secs(total)}; keep the whole note under 60s.`),

    h('h2', {}, 'Splicing and sending'),
    h(
      'div',
      { class: 'card' },
      h('label', { class: 'field' }, 'Extra pause between parts (ms, 0 = seamless crossfade)', h('input', { type: 'number', min: 0, max: 1000, value: st.gapMs, oninput: num(st, 'gapMs') })),
      h('label', { class: 'field' }, 'Silence before the clip starts in Instagram (ms)', h('input', { type: 'number', min: 0, max: 2000, value: st.leadInMs, oninput: num(st, 'leadInMs') })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.monitor, onchange: check(st, 'monitor') }), 'Play the clip out loud while it goes into Instagram'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoOpen, onchange: check(st, 'autoOpen') }), "Open the lead's Instagram profile when I open a lead"),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoSend, onchange: check(st, 'autoSend') }), "Send hits Instagram's send button for me (off: it stops after recording so I can check it and send myself)"),
    ),

    h('h2', {}, 'Airtable'),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'muted small' }, 'Make a personal access token at airtable.com/create/tokens with data.records:read and data.records:write, limited to the Torrey Labs base.'),
      h('label', { class: 'field' }, 'Token', h('input', { type: 'password', value: at.token, placeholder: 'pat...', oninput: txt(at, 'token') })),
      h('label', { class: 'field' }, 'Base ID', h('input', { value: at.baseId, oninput: txt(at, 'baseId') })),
      h('label', { class: 'field' }, 'Table', h('input', { value: at.table, oninput: txt(at, 'table') })),
      h('label', { class: 'field' }, 'Which leads to pull (Airtable formula)', h('textarea', { oninput: txt(at, 'formula') }, at.formula)),
      h('p', { class: 'muted small' }, 'On top of this, the app only pulls leads it followed at least a day ago.'),
      h('label', { class: 'field' }, 'Max leads per sync', h('input', { type: 'number', min: 1, max: 1000, value: at.max, oninput: num(at, 'max') })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoSync, onchange: check(st, 'autoSync') }), 'Check for new leads on launch and every 15 minutes'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: at.writeBack, onchange: check(at, 'writeBack') }), 'When a note is sent, update Airtable: Status = Sent, Channel = Instagram, Sent at = today, Touches = 1'),
    ),

    h('h2', {}, 'Auto-voice (optional)'),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'muted small' }, "Skip recording each lead's lines: an ElevenLabs clone of your voice says them instead. Leave blank to record them yourself."),
      h('label', { class: 'field' }, 'ElevenLabs API key', h('input', { type: 'password', value: el.key, oninput: txt(el, 'key') })),
      h('label', { class: 'field' }, 'Voice ID (your cloned voice)', h('input', { value: el.voiceId, oninput: txt(el, 'voiceId') })),
      h(
        'label',
        { class: 'field' },
        'Model',
        h(
          'select',
          { onchange: txt(el, 'model') },
          (MODELS.some(([id]) => id === el.model) ? MODELS : [...MODELS, [el.model, el.model]]).map(([id, label]) =>
            h('option', { value: id, selected: id === el.model }, label),
          ),
        ),
      ),
      slider(el, 'speed', 'Speed', 0.7, 1.2, 0.01, 'Slower', 'Faster'),
      slider(el, 'stability', 'Stability', 0, 1, 0.01, 'More variable', 'More stable'),
      slider(el, 'similarity', 'Similarity', 0, 1, 0.01, 'Low', 'High'),
      slider(el, 'style', 'Style exaggeration', 0, 1, 0.01, 'None', 'Exaggerated'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: el.speakerBoost, onchange: check(el, 'speakerBoost') }), 'Speaker boost (closer to your real voice)'),
      h('p', { class: 'muted small' }, 'Multilingual v2 uses every slider. v3 and v4 mostly listen to Stability (v3 rounds it to 0, 0.5 or 1).'),
      h(
        'div',
        { class: 'row-flex' },
        h('button', { onclick: testVoice, disabled: !ttsReady() || !!S.busy }, 'Test voice'),
        h('button', { class: 'link', onclick: resetVoice }, 'Reset sliders'),
      ),
      S.busy ? h('p', { class: 'muted small' }, S.busy) : null,
    ),
  );
}

// ---------- follow + like ----------

const clock = (t) => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const countdown = (ms) => fmt(Math.max(0, ms) / 1000);

function followDot() {
  const f = S.follow;
  if (!f?.enabled) return f?.stopNote ? 'bad' : '';
  return f.phase.kind === 'paused' || f.phase.kind === 'error' ? 'warn' : 'ok';
}

function followStatus(f) {
  if (!f) return 'Loading...';
  if (!f.enabled) {
    if (f.stopNote === 'loggedout') return 'Stopped: Instagram is logged out in the app. Log in on the right, then press Start.';
    if (f.stopNote) return `Stopped to be safe: ${f.stopNote}. Check Instagram on the right, then press Start.`;
    return 'Off. Press Start and it works through your leads in the background.';
  }
  const { kind, until } = f.phase;
  if (kind === 'gap') return ['Waiting between accounts. Next one in ', h('b', { id: 'follow-countdown' }, countdown(until - Date.now())), '.'];
  return (
    {
      setup: 'Add your Airtable token in Setup to start.',
      checking: 'Checking Airtable for who to follow...',
      working: `Following @${f.current?.handle || ''}...`,
      cap: `Done for today (${f.today} of ${f.cap}). Starts again ${clock(until)}.`,
      paused: `Paused until ${clock(until)} because Instagram pushed back. See Recent below.`,
      empty: 'Nobody new to follow. Checking Airtable again in 30 minutes.',
      error: 'Hit a snag (see Recent below). Trying again in 10 minutes.',
    }[kind] || 'Running.'
  );
}

function logText(e) {
  if (e.result === 'followed') return e.liked ? 'Followed and liked their latest post' : e.private ? 'Followed (private, nothing to like)' : "Followed (didn't like a post)";
  if (e.result === 'already') return e.liked ? 'Already following; liked their latest post' : 'Already following';
  if (e.result === 'notfound') return 'Account not found, skipped';
  if (e.result === 'blocked') return `Instagram pushed back ("${e.note}"). Paused for 48 hours.${e.followed ? ' The follow went through.' : ''}`;
  if (e.result === 'loggedout') return 'Instagram is logged out. Stopped.';
  if (e.result === 'failed') return `Stopped: ${e.note}`;
  return e.note;
}

const logClass = (e) => ({ followed: 'ok', already: 'muted', notfound: 'muted', blocked: 'bad', failed: 'bad', loggedout: 'bad', error: 'warn' })[e.result] || '';

function followView() {
  const f = S.follow;
  const on = !!f?.enabled;
  return h(
    'main',
    {},
    h(
      'div',
      { class: 'card' },
      h('p', { id: 'follow-status', class: `follow-status ${followDot()}` }, followStatus(f)),
      h('button', { class: on ? 'big' : 'enter', onclick: () => window.api.followSet(!on), disabled: !f }, on ? 'Stop following' : 'Start following'),
      h(
        'label',
        { class: 'field inline-field' },
        'Follows a day',
        h('input', {
          type: 'number',
          min: 1,
          max: 200,
          value: S.settings.followPerDay,
          oninput: (e) => {
            if (!e.target.value) return;
            S.settings.followPerDay = Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1));
            saveSettings().then(flashSaved);
          },
        }),
      ),
      f
        ? h(
            'p',
            { class: 'muted small' },
            [`Today: ${f.today} of ${f.cap} follows`, `${f.total} followed in all`, f.skipped ? `${f.skipped} not found` : ''].filter(Boolean).join(' · '),
          )
        : null,
    ),
    f?.queue?.length
      ? [
          h('h2', {}, 'Up next'),
          h(
            'div',
            { class: 'list' },
            f.queue.map((q) =>
              h(
                'div',
                { class: 'lead static' },
                h('div', { class: 'who' }, h('span', {}, h('b', {}, `@${q.handle}`)), h('span', { class: 'muted small' }, [q.name, q.category].filter(Boolean).join(' · '))),
                q.fit != null ? h('span', { class: 'tag' }, `fit ${q.fit}`) : null,
              ),
            ),
          ),
        ]
      : null,
    h('h2', {}, 'Recent'),
    f?.log?.length
      ? h(
          'div',
          { class: 'card log' },
          f.log.map((e) =>
            h('div', { class: 'log-row' }, h('span', { class: 'muted small' }, clock(e.at)), e.handle ? h('b', { class: 'small' }, `@${e.handle}`) : null, h('span', { class: `small ${logClass(e)}` }, logText(e))),
          ),
        )
      : h('p', { class: 'muted small' }, 'Nothing yet.'),
    h(
      'p',
      { class: 'muted small' },
      'Pacing: your daily limit above (the day resets at midnight Pacific), 2 to 6 minutes between accounts, any time of day. If Instagram shows "action blocked", "try again later" or a security check, it stops and waits 48 hours.',
    ),
    h('p', { class: 'muted small' }, 'While this screen is open, the right side shows the follow tab so you can watch. Following keeps running when you go back to Leads.'),
  );
}

window.api.onFollow((f) => {
  S.follow = f;
  const dot = document.getElementById('follow-dot');
  if (dot) dot.className = `dot ${followDot()}`;
  if (S.view === 'follow') render();
});

window.api.onFollowed(({ airtableId, followedAt }) => {
  const p = S.prospects.find((x) => x.airtableId === airtableId);
  if (!p) return;
  p.followedAt = followedAt;
  saveProspects();
});

setInterval(() => {
  const el = document.getElementById('follow-countdown');
  if (el && S.follow?.phase.until) el.textContent = countdown(S.follow.phase.until - Date.now());
}, 1000);

let pane = 'dm';
function render() {
  const p = current();
  if (S.currentId && !p) S.currentId = null;
  const body = S.view === 'setup' ? setupView() : S.view === 'follow' ? followView() : p ? detailView(p) : leadsView();
  $app.replaceChildren(header(), body);
  // The Follow screen puts the follow tab on the right; everything else shows the DM tab.
  const want = S.view === 'follow' ? 'follow' : 'dm';
  if (want !== pane) {
    pane = want;
    window.api.showPane(want);
  }
}

// ---------- keyboard ----------

document.addEventListener('keydown', (e) => {
  if (e.repeat || e.target.closest?.('input, textarea, select, button, summary')) return;
  const p = current();
  if (e.code === 'Space') {
    e.preventDefault();
    if (S.rec) return stopRecording();
    if (S.view !== 'leads' || !p) return;
    const seg = slots().find((s) => !S.lens[slotKey(p, s)]);
    if (seg) toggleRecord(slotKey(p, seg));
  } else if (e.key === 'Enter' && S.view === 'leads') {
    e.preventDefault();
    if (!p) {
      const next = todoList()[0];
      if (next) openLead(next.id);
    } else if (e.metaKey || e.ctrlKey) sendNow(p);
    else document.querySelector(`[data-play="preview:${p.id}"]`)?.click();
  }
});

// ---------- boot ----------

(async () => {
  S.lens = (await store.get('kv', 'lens')) || {};
  S.template = await migrateTemplate((await store.get('kv', 'template')) || structuredClone(DEFAULT_TEMPLATE));
  const saved = (await store.get('kv', 'settings')) || {};
  S.settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    airtable: { ...DEFAULT_SETTINGS.airtable, ...saved.airtable },
    eleven: { ...DEFAULT_SETTINGS.eleven, ...saved.eleven },
  };
  S.prospects = (await store.get('kv', 'prospects')) || [];
  const fixedSegs = S.template.filter((s) => s.kind === 'fixed');
  if (fixedSegs.length && fixedSegs.every((s) => !S.lens[fixedKey(s)])) S.view = 'setup';
  pushFollowConfig();
  S.follow = await window.api.followState();
  render();
  if (S.settings.autoSync) sync({ quiet: true });
  setInterval(() => S.settings.autoSync && sync({ quiet: true }), SYNC_MS);
  setInterval(paintSync, 60 * 1000);
})();
