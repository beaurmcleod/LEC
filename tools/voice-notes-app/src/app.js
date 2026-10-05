import * as store from './store.js';
import * as audio from './audio.js';
import * as leads from './leads.js';
import * as replies from './replies.js';
import * as discover from './find.js';
import * as limits from './limits.js';
import { clip as clipText } from './text.js';

// Read this off the screen when recording the pitch. About 32 seconds at a normal pace.
const PITCH_SCRIPT = `Figured a real voice beats another copy-paste DM. I'm Garrett with Torrey Labs — we're a peptide company here in San Diego, every batch third-party tested.

Your clients are probably already asking you about peptides for weight loss or recovery. We give you your own link: they order straight from us, you never touch product or money, and you get twenty percent on every order, for life. One of our trainers already clears a grand a month, just from referrals.

Worth a look? Reply and I'll send the details.`;

// The intro is kept short and leaves the pitch to do the talking. {detail} (their Airtable "Personal hook")
// and {crowd} are there for a longer, email-style opener.
const INTRO_SCRIPT = 'Hey {name}, saw that you have a pretty impressive {kind}.';
// Earlier defaults. An untouched copy is upgraded on launch.
const OLD_INTROS = [
  "Hey {name} — saw you're the {role} at {business}.",
  'Hey {name} — {detail} A lot of {crowd} ask us where to find peptides with real lab reports.',
  'Hey {name} — {detail}, and a lot of {crowd} ask us for lab-tested peptides.',
];
const FALLBACK_DETAIL = "saw you're the {role} at {business}";

// One custom intro line per lead, then the whole pitch in one take. Setup can split the pitch into more parts.
const DEFAULT_TEMPLATE = [
  { id: 'intro', kind: 'slot', label: 'Intro', script: INTRO_SCRIPT },
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
// as they are, but the pitch still gets the script if it has none, and an untouched copy of an earlier
// default intro becomes the current one (recordings are kept, and tagged "old wording").
async function migrateTemplate(t) {
  const shape = t.map((seg) => `${seg.id}:${seg.kind}`).join(',');
  const pitchIds = OLD_SHAPES[shape];
  const untouched = t.filter((seg) => seg.kind === 'slot').every((seg) => seg.script === OLD_SCRIPTS[seg.id]);
  if (!pitchIds || !untouched) {
    const pitch = t.find((seg) => seg.kind === 'fixed' && seg.id === 'pitch');
    const intro = t.find((seg) => seg.kind === 'slot' && OLD_INTROS.includes(seg.script));
    const noScript = pitch && pitch.script == null;
    if (noScript) pitch.script = PITCH_SCRIPT;
    if (intro) intro.script = INTRO_SCRIPT;
    if (noScript || intro) await store.put('kv', 'template', t);
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
  matchLevels: true,
  toneMatch: true,
  introDb: 0,
  breath: true,
  breathPick: 0,
  breathDb: 0,
  breathSource: 'auto',
  leadInMs: 300,
  monitorWatching: false,
  autoOpen: true,
  autoSend: true,
  autoSync: true,
  readyOnly: true,
  // Remove on a lead: 'delete' deletes its Airtable record, 'skip' marks it Skip there instead.
  removeMode: 'delete',
  followGate: true,
  followPerDay: 50,
  // How much the account does a day and an hour (Setup > Safety limits). See src/limits.js.
  limits: structuredClone(limits.DEFAULT_LIMITS),
  engageAfterSend: true,
  claude: { key: '' },
  torrey: { key: '', site: 'https://torreylabs.store', percent: 20 },
  // quick: look at the inbox for unread messages every minute; notify: a notification for each reply; background: keep
  // working when the window is closed (Mac) and keep the Mac awake.
  replies: { watch: true, everyMin: 10, from: 'Garrett', auto: true, delayMin: 4, quick: true, notify: true, background: true },
  // Replies to emailed leads: answered from Garrett's mailbox with a Gmail app password. auto stays off until you've watched
  // a few go out; with it off, every answer waits under Replies for you to press Send.
  mail: { on: true, user: 'garrett@torreylabshq.com', pass: '', auto: false, from: 'Garrett' },
  // Finding accounts by hashtag: profiles read a day, and the hashtags (one per line).
  find: { perDay: discover.LIMITS.defaultPerDay, tags: discover.DEFAULT_TAGS.join('\n') },
  airtable: {
    token: '',
    baseId: 'appdAJbStcwrV2bq5',
    table: 'Leads',
    formula: "AND({Instagram} != '', OR({Status} = 'New', {Status} = 'Researched', {Status} = 'Ready'), {Track} != 'Skip')",
    max: 1000,
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

const PLACEHOLDERS = ['name', 'first', 'kind', 'detail', 'crowd', 'role', 'business', 'handle', 'note', 'hook', 'category'];
// Refreshed from Airtable on every sync, unless you've edited that field here.
const REFRESH_FIELDS = ['first', 'role', 'business', 'category', 'hook', 'bridge', 'bio', 'research', 'notes', 'atStatus', 'followedAt', 'igLiked', 'channel', 'atSentAt'];
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
  said: {},
  replies: { checking: false, lastAt: 0, note: '', issue: '', scan: null },
  // Replies to emailed leads, by Airtable record id (see emailCheck).
  emails: { items: {}, checking: false, lastAt: 0, note: '', issue: '' },
  rec: null,
  busy: '',
  armed: null,
  sending: null,
  send: { pid: null, state: '', text: '' },
  // Sends running in the hidden Instagram tab while you move on: the one in progress and the ones waiting.
  bg: { current: null, jobs: [] },
  watchSend: false,
  sync: { at: 0, error: '', running: false, pulled: null },
  follow: null,
  find: null,
  findVerdicts: {},
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
  window.api.followConfig({ token, baseId, table, perDay: S.settings.followPerDay, limits: S.settings.limits, startedAt: startedAt() });
  window.api.findConfig({ token, baseId, table, perDay: S.settings.find.perDay, tags: S.settings.find.tags });
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
const saveSaid = () => store.put('kv', 'said', S.said);

async function setAudio(key, samples, meta = {}) {
  await store.put('audio', key, { samples, ...meta });
  S.lens[key] = samples.length / audio.SR;
  await saveLens();
  if (key.startsWith('slot:')) {
    if (meta.text) S.said[key] = { text: meta.text, by: meta.source };
    else delete S.said[key];
    await saveSaid();
  }
}

async function getAudio(key) {
  return (await store.get('audio', key))?.samples || null;
}

async function delAudio(key) {
  await store.del('audio', key);
  delete S.lens[key];
  await saveLens();
  if (S.said[key]) {
    delete S.said[key];
    await saveSaid();
  }
}

// What a lead's line says right now, from its "slot:<lead>:<line>" key.
function lineText(key) {
  const [, pid, sid] = key.split(':');
  const p = S.prospects.find((x) => x.id === pid);
  const seg = S.template.find((x) => x.id === sid);
  return p && seg ? spokenScript(seg.script, p) : '';
}

// A recorded or auto-voiced line whose wording has changed since (a new intro, a new hook, a fixed name).
const outdated = (p, seg) => {
  const said = S.said[slotKey(p, seg)];
  return !!said && !!S.lens[slotKey(p, seg)] && said.text !== spokenScript(seg.script, p);
};

// Auto-voiced lines from before the app kept track of wording: their audio still has the text they were made from.
async function backfillSaid() {
  for (const key of Object.keys(S.lens).filter((k) => k.startsWith('slot:'))) {
    const rec = await store.get('audio', key);
    if (rec?.source === 'tts' && rec.text) S.said[key] = { text: rec.text, by: 'tts' };
  }
  await saveSaid();
}

// The name to greet someone by, or '' when all the app has is their business or handle (so it never says
// "Hey Made From Collective").
function personName(p) {
  const same = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();
  if (p.edited?.name) return leads.spokenName(p.name);
  const name = p.first || (p.name !== leads.deriveName(p) ? p.name : '');
  if (!name || same(name, p.business) || same(name, leads.spokenBusiness(p.business))) return '';
  return leads.spokenName(name);
}

// Lead details cleaned up for saying out loud. {detail} is the first point of their Personal hook, said to
// them ("saw you run HYROX prep"); with no hook, the Bridge's line about them, then their role and
// business. {crowd} is who they are ("trainers"), and {kind} their kind of business ("recovery studio").
function scriptVars(p) {
  const name = personName(p);
  const v = {
    ...p,
    name,
    first: name,
    role: leads.spokenRole(p.role),
    business: leads.spokenBusiness(p.business),
    handle: p.handle ? `@${p.handle}` : '',
    crowd: leads.crowd(p.category, p.role, p.business),
    kind: leads.kind(p.category, p.role, p.business),
  };
  v.detail =
    leads.spokenHook(p.hook, p.first || name) || leads.spokenBridge(p.bridge) || adaptScript(FALLBACK_DETAIL, v).replace(/\{(\w+)\}/g, (m, k) => v[k] || '');
  return v;
}

// Rewords a line around details the lead doesn't have, so it still sounds natural:
// no name -> "Hey there", no role -> "what you're doing at", no business -> the "at ..." part goes.
function adaptScript(script, v) {
  const R = "you(?:'|’)re the \\{role\\}";
  let s = script || '';
  for (const k of ['name', 'first']) if (!v[k]) s = s.replace(new RegExp(`\\b(hey|hi|hello|yo)(\\s+)\\{${k}\\}`, 'gi'), '$1$2there');
  if (!v.business) s = s.replace(/\s+(at|of|with|from) \{business\}/gi, '');
  if (!v.role) s = s.replace(new RegExp(`${R} (at|of|with) `, 'gi'), "what you're doing at ").replace(new RegExp(R, 'gi'), "what you're up to");
  return s;
}

// Empty fields show as ___ so you can see what to improvise when recording.
function renderScript(script, p) {
  const vars = scriptVars(p);
  return adaptScript(script, vars).replace(/\{(\w+)\}/g, (m, k) => (PLACEHOLDERS.includes(k) ? vars[k] || '___' : m));
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
// DMs wait until a day after the app followed the lead (Setup can turn this off). Leads added by hand or CSV aren't held.
const followedLongEnough = (p) => !S.settings.followGate || !p.airtableId || (!!p.followedAt && Date.now() - Date.parse(p.followedAt) >= DAY_MS);
// The holds only apply to leads still to do: a sent lead stays listed after it's followed.
const shown = (p) => p.status !== 'todo' || (researched(p) && followedLongEnough(p));
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
      await setAudio(key, samples, { source: 'mic', text: lineText(key) });
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

async function runVoiceJobs(jobs, verb) {
  let done = 0;
  for (const job of jobs) {
    setBusy(`${verb} ${done + 1} of ${jobs.length}...`);
    try {
      await autoVoice(...job);
      done++;
    } catch (e) {
      toast(errText(e), 8000);
      break;
    }
  }
  setBusy('');
  return done;
}

async function autoVoiceAll() {
  const jobs = [];
  for (const p of todoList()) {
    for (const seg of slots()) if (!S.lens[slotKey(p, seg)]) jobs.push([p, seg]);
  }
  if (!jobs.length) return toast('Every to-do lead already has its lines.');
  await runVoiceJobs(jobs, 'Auto-voicing');
}

// Auto-voiced lines whose wording changed, on every lead still to do (waiting ones too). Lines you recorded
// yourself are only flagged, since the app can't re-say them in your voice.
const staleVoiced = () =>
  S.prospects
    .filter((p) => p.status === 'todo')
    .flatMap((p) => slots().filter((seg) => outdated(p, seg) && S.said[slotKey(p, seg)].by === 'tts').map((seg) => [p, seg]));

async function revoiceAll() {
  const jobs = staleVoiced();
  const done = await runVoiceJobs(jobs, 'Re-voicing');
  if (done === jobs.length) toast(`Re-voiced ${done} line${done === 1 ? '' : 's'} with the new wording.`);
}

// The recorded-once parts (the pitch) joined up, with how loud they are, their tone and their room tone,
// remembered until one is re-recorded.
let pitchCache = { key: '' };
async function pitchInfo() {
  const fixed = S.template.filter((s) => s.kind === 'fixed');
  const key = fixed.map((s) => `${fixedKey(s)}:${S.lens[fixedKey(s)]}`).join('|');
  if (key !== pitchCache.key) {
    const parts = await Promise.all(fixed.map((s) => getAudio(fixedKey(s))));
    const joined = audio.concat(parts.filter(Boolean), 0);
    const has = joined.length > 0;
    pitchCache = { key, lufs: has ? audio.loudness(joined) : -Infinity, bands: has ? audio.toneBands(joined) : null, room: has ? audio.roomTone(joined) : -Infinity, joined };
  }
  return pitchCache;
}
const pitchLevel = async () => (await pitchInfo()).lufs;

// The breaths in a recorded-once part, remembered until it's re-recorded.
const breathCache = new Map();
async function breathsIn(seg) {
  const key = `${fixedKey(seg)}:${S.lens[fixedKey(seg)]}`;
  if (!breathCache.has(key)) {
    const samples = await getAudio(fixedKey(seg));
    breathCache.set(key, samples ? audio.findBreaths(samples) : []);
  }
  return breathCache.get(key);
}

// A breath you recorded yourself, set to a natural level under the pitch (about 22 dB below its speech, before
// the Breath volume slider). Kept under its own key, so it isn't a part of the voice note's layout.
const MY_BREATH = 'fixed:breath';
const MY_BREATH_DB = -22;
// The least air around the join, in ms: a natural pause before a breath, and a beat after it before the words.
const MIN_AIR = { before: 220, after: 120 };
async function myBreath() {
  const raw = S.lens[MY_BREATH] ? await getAudio(MY_BREATH) : null;
  if (!raw) return null;
  const pitch = await pitchInfo();
  const clip = Number.isFinite(pitch.lufs) ? audio.matchLoudness(raw, pitch.lufs + MY_BREATH_DB, 40).samples : raw;
  return { clip, mine: true, seconds: raw.length / audio.SR };
}

// The breath put between a custom line and the pitch part after it: one of the pitch's own breaths (so the room
// sound and the voice match), or the one you recorded. Yours is used when you chose it, or when the pitch has
// none. null when the breath is off or there's neither.
async function breathBefore(seg) {
  if (!S.settings.breath || seg?.kind !== 'fixed') return null;
  const list = await breathsIn(seg);
  const mine = S.settings.breathSource === 'mine' || !list.length ? await myBreath() : null;
  if (mine) return mine;
  if (!list.length) return null;
  const n = S.settings.breathPick % list.length;
  const b = list[n];
  return { clip: audio.breathClip(await getAudio(fixedKey(seg)), b), b, n, total: list.length, seconds: b.seconds };
}

// Builds a lead's whole voice note. Each custom line is EQ'd to the pitch's tone, turned up or down to the
// pitch's loudness, then trimmed by your Intro volume setting; a breath from the pitch goes between it and the
// pitch. Returns the samples, where the first join is, and what was measured on the way (for the readout).
async function assembleClip(p) {
  const missing = missingParts(p);
  if (missing.length) throw new Error(`Still needs: ${missing.map((s) => s.label).join(', ')}`);
  const st = S.settings;
  const pitch = await pitchInfo();
  const parts = [];
  const kinds = [];
  const info = { pitchLufs: pitch.lufs, pitchRoom: pitch.room, lines: [], breath: null };
  for (const [i, seg] of S.template.entries()) {
    let samples = await getAudio(partKey(p, seg));
    if (seg.kind === 'slot') {
      const line = { label: seg.label, lufs: audio.loudness(samples) };
      if (pitch.bands) {
        if (st.toneMatch) {
          const r = audio.toneMatch(samples, pitch.bands);
          samples = r.samples;
          line.tone = r.before;
          line.toneAfter = r.after;
        } else line.tone = audio.toneGap(audio.toneBands(samples), pitch.bands);
      }
      if (st.matchLevels && Number.isFinite(pitch.lufs)) samples = audio.matchLoudness(samples, pitch.lufs).samples;
      samples = audio.gainDb(samples, st.introDb);
      line.after = audio.loudness(samples);
      // A noisier room than the pitch's: ease the intro's trailing pause down to the pitch's room level.
      line.room = audio.roomTone(samples);
      const roomDrop = pitch.room - line.room;
      if (Number.isFinite(roomDrop) && roomDrop < -3) {
        samples = audio.easeTail(samples, 140, Math.max(-24, roomDrop));
        line.eased = true;
      }
      info.lines.push(line);
      parts.push(samples);
      kinds.push('slot');
      const next = S.template[i + 1];
      const breath = await breathBefore(next);
      if (next?.kind === 'fixed') {
        // The air around the join: what the takes already have, topped up to a natural pause (a take stopped
        // right after the last word has none), plus the Pause slider, most of it before the breath.
        const tail = audio.quietEdges(samples).tailMs;
        const head = audio.quietEdges(await getAudio(fixedKey(next))).headMs;
        const pads = breath && !breath.mine ? 60 : 0;
        const wantBefore = Math.max(0, MIN_AIR.before - tail - pads) + (breath ? st.gapMs * 0.6 : st.gapMs);
        const wantAfter = breath ? Math.max(0, MIN_AIR.after - head - pads) + st.gapMs * 0.4 : 0;
        const air = (msLen) => (msLen > 0 && pitch.joined?.length ? audio.roomAir(pitch.joined, msLen) : null);
        const before = air(wantBefore);
        if (before) (parts.push(before), kinds.push('air'));
        if (breath) {
          parts.push(audio.gainDb(breath.clip, st.breathDb));
          kinds.push('breath');
          info.breath ??= breath.mine ? { mine: true, seconds: breath.seconds } : { ...breath.b, n: breath.n + 1, total: breath.total };
          const after = air(wantAfter);
          if (after) (parts.push(after), kinds.push('air'));
        }
        info.timing = { before: tail + pads + wantBefore, after: head + pads + wantAfter };
      }
    } else {
      parts.push(samples);
      kinds.push('fixed');
    }
  }
  const { samples, starts } = audio.join(parts, 0);
  const slot = kinds.indexOf('slot');
  const fixed = kinds.findIndex((k, i) => i > slot && k === 'fixed');
  const joinAt = slot >= 0 && fixed >= 0 ? { end: starts[slot] + parts[slot].length, pitch: starts[fixed] } : null;
  return { samples, info, joinAt };
}

const buildClip = async (p) => (await assembleClip(p)).samples;

// Just the seam: the last stretch of the intro, the breath, and the first words of the pitch.
async function joinClip(p) {
  const { samples, joinAt } = await assembleClip(p);
  if (!joinAt) return samples;
  const from = Math.max(0, joinAt.end - 1.5 * audio.SR);
  const to = Math.min(samples.length, joinAt.pitch + 2.5 * audio.SR);
  return audio.fade(samples.slice(from, to), 15);
}

// ---------- Send: open their DM, play the clip into the mic, hit send ----------

// Status updates from the Instagram pane. Send waits on these; otherwise they drive the status line.
const waiters = new Set();
function waitForStatus(states, ms, target = 'dm') {
  return new Promise((resolve) => {
    const w = {
      target,
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
  const target = msg.target || 'dm';
  for (const w of [...waiters]) if (w.target === target && w.states.includes(msg.state)) w.resolve(msg);
  if (target !== 'dm') return;
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

// Opens their DM in one of the Instagram tabs, plays the clip into the mic and hits send, then waits for
// Instagram's own answer: the voice note counts as sent only when Instagram's servers answer the send with the
// new message's id. Returns '' once that's in, or which step needs a person ('nodm', 'nomic', 'early',
// 'nosend', 'unposted', 'unverified', 'rejected:...', 'yours'); throws on errors. Every attempt leaves a
// record: a short one in the lead's "Send log" in Airtable when it went out, the full step-by-step one when it
// didn't, and the full one with a screenshot under diagnostics either way.
async function deliver(p, samples, opts) {
  const { target } = opts;
  const trace = [];
  const proof = { line: '' };
  const mark = async (step) => {
    const about = await window.api.describeTab(target).catch((e) => `(couldn't read the tab: ${e.message})`);
    trace.push(`## ${step} · ${new Date().toLocaleTimeString()}\n${about}`);
  };
  const started = Date.now();
  await window.api.watchStart(target).catch(() => {});
  let left = '';
  let error = null;
  try {
    left = await deliverSteps(p, samples, opts, trace, mark, proof);
  } catch (e) {
    error = e;
    await mark('Stopped by an error').catch(() => {});
  }
  const network = await window.api.watchStop(target).catch((e) => `(couldn't read the network record: ${e.message})`);
  const outcome = error ? `ERROR: ${errText(error)}` : left === '' ? 'SENT' : left === 'already' ? 'ALREADY SENT BEFORE' : left === 'yours' ? 'left for you to press Send' : `NOT SENT: ${left}`;
  const build = S.build ? `build ${S.build.commit}` : 'development build';
  const head = [`Send to @${p.handle} (${p.name || ''}): ${outcome}`, `${new Date().toLocaleString()} · ${build} · ${target === 'dm' ? 'while watching' : 'in the background'} · ${Math.round((Date.now() - started) / 1000)}s`, proof.line].filter(Boolean);
  const full = [...head, trace.join('\n\n'), `## ${network}`].join('\n\n');
  const code = error ? 'error' : left === '' ? 'sent' : left.split(':')[0];
  const file = await window.api.snap(target, `${p.handle}-${code}`, full).catch(() => '');
  const fine = !error && (left === '' || left === 'already');
  if (fine) delete p.sendShot;
  else p.sendShot = file;
  logSend(p, fine ? head.join('\n') : full);
  if (error) throw error;
  return left;
}

// What Instagram's servers answered to the upload and the send, since `since`. Waits up to `ms` for the send's
// answer (or a failed upload, which means no send is coming).
async function sendProof(target, since, ms) {
  let got = { watching: false, upload: null, send: null };
  for (const end = Date.now() + ms; ; await new Promise((r) => setTimeout(r, 400))) {
    got = await window.api.sendProof(target, since).catch(() => got);
    if (got.send || (got.upload && !got.upload.ok) || !got.watching || Date.now() > end) return got;
  }
}
const answerText = (x, what) => (!x ? `no ${what} seen` : x.ok ? `${what} ok (${x.id})` : `${what} failed: ${x.error}`);

async function deliverSteps(p, samples, { target, monitor, say, onPlaying = () => {} }, trace, mark, proof) {
  const seconds = samples.length / audio.SR;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  say('Opening their DM...');
  const dmOpen = await window.api.igDo('openDm', p.handle, target).then(
    (href) => {
      if (typeof href === 'string' && href.startsWith('/direct/t/')) p.dm = { ...p.dm, href };
      return true;
    },
    () => false,
  );
  if (dmOpen) await mark('Their DM, opened');
  // Their chat before this send: after it there has to be one more voice message. And if one of ours is already
  // there, an earlier send went out: don't send them a second one.
  const readChat = () => window.api.chatVoice(target, p.handle).catch(() => ({ voices: 0, ours: 0 }));
  let chatBefore = dmOpen ? await readChat() : { voices: 0, ours: 0 };
  // An empty chat may just not have loaded its older messages yet: look once more before trusting it.
  if (dmOpen && !chatBefore.voices) {
    await pause(1200);
    chatBefore = await readChat();
  }
  trace.push(`Chat before the send: ${JSON.stringify(chatBefore)}`);
  if (dmOpen && chatBefore.ours > 0) {
    proof.line = `Their chat already has ${chatBefore.ours} voice message${chatBefore.ours === 1 ? '' : 's'} from us, so nothing was sent again.`;
    return 'already';
  }

  say('Loading the clip...');
  const armed = waitForStatus(['armed'], 10000, target);
  await window.api.arm(audio.encodeWav(samples), { label: p.name, leadInMs: S.settings.leadInMs, monitor }, target);
  const a = await armed;
  if (a.state !== 'armed') throw new Error(a.message || "Instagram didn't take the clip");
  if (target === 'dm') S.armed = p.id;
  if (!dmOpen) return 'nodm';

  say(`Recording into their DM (${fmt(seconds)})...`);
  const playing = waitForStatus(['playing'], 8000, target);
  const micWhat = await window.api.igDo('clickMic', null, target).then(
    (w) => w || 'clicked',
    () => '',
  );
  trace.push(`Mic click: ${micWhat || '(no mic control found)'}`);
  const pl = micWhat ? await playing : { state: 'timeout' };
  if (pl.state === 'error') throw new Error(pl.message);
  if (pl.state !== 'playing') return 'nomic';
  onPlaying(seconds);
  await pause(700);
  await mark('Recording, just after the mic click');

  const done = await waitForStatus(['done', 'armed'], (seconds + 15) * 1000, target);
  if (done.state === 'armed') return 'early';
  if (done.state !== 'done') throw new Error(done.message || 'the clip never finished playing');

  if (!S.settings.autoSend) return 'yours';
  say('Sending...');
  await mark('Clip finished, about to press Send');
  const clickAt = Date.now() - 250;
  const stopped = waitForStatus(['stopped'], 8000, target);
  const sendWhat = await window.api.igDo('clickSend', null, target).then(
    (w) => w || 'clicked',
    () => '',
  );
  trace.push(`Send click: ${sendWhat || '(no Send control found)'}`);
  const st = sendWhat ? await stopped : { state: 'timeout' };
  if (st.state !== 'stopped') return 'nosend';

  // Instagram letting go of the mic is no proof of a send: it does that on a discard too. The proof is its
  // servers' answer to the send: the new message's id.
  say('Waiting for Instagram to confirm...');
  let got = await sendProof(target, clickAt, 12000);
  if (got.watching && !got.send && !got.upload) {
    // Nothing went out yet. If a Send control is still on screen (a recording that needed a second press),
    // press it once more.
    const again = await window.api.igDo('clickSendAgain', null, target).catch(() => null);
    if (again) {
      trace.push(`A Send control was still on screen, so it was pressed again: ${again}`);
      got = await sendProof(target, clickAt, 12000);
    }
  }
  await mark('After the send');
  proof.line = got.watching
    ? `Instagram's answer: ${answerText(got.upload, 'upload')}; ${answerText(got.send, 'send')}`
    : "Instagram's answers couldn't be watched, so the chat on screen was checked instead";
  trace.push(proof.line);
  if (got.send && !got.send.ok) return `rejected:${got.send.error}`;
  if (got.upload && !got.upload.ok) return `rejected:${got.upload.error}`;
  if (got.watching && !got.send) return 'unposted';

  // The second proof: the voice message itself, in their chat. One more voice message than before the send,
  // no longer "Sending", and no failure notice.
  say('Checking their chat...');
  // In: one more voice message of ours than before, or one more voice message that's done sending.
  const shows = (c) => c.ours > chatBefore.ours || (c.voices > chatBefore.voices && !c.sending);
  let chat = null;
  for (const end = Date.now() + 30000; ; await pause(700)) {
    chat = await window.api.chatVoice(target, p.handle).catch((e) => ({ voices: 0, ours: 0, error: e.message }));
    if (chat.failure || shows(chat) || Date.now() > end) break;
  }
  trace.push(`Chat after the send: ${JSON.stringify(chat)} (before: ${chatBefore.voices} voice messages, ${chatBefore.ours} ours)`);
  if (chat.failure) return `rejected:${chat.failure}`;
  if (shows(chat)) {
    proof.line = [proof.line, `Their chat shows the new voice message (${chat.voices} now, ${chatBefore.voices} before)`].join('\n');
    return '';
  }
  await mark('Their chat, when the voice message should be there');
  // Instagram's servers gave the message an id: it went out, even when the chat is slow to show it. Marking it
  // failed would only lead to sending it twice.
  if (got.send?.ok) {
    proof.line = [proof.line, `Their chat hadn't shown it after 30 s (${chat.voices} voice messages, ${chat.sending ? 'one still "Sending"' : 'none sending'}), but Instagram's servers confirmed it went out.`].join('\n');
    return '';
  }
  return chat.voices > chatBefore.voices ? 'stillsending' : 'unverified';
}

// Every send's record goes into the lead's "Send log" in Airtable, so it can be read without anyone copying it
// out of the app.
async function logSend(p, report) {
  const at = S.settings.airtable;
  if (!at.writeBack || !at.token || !p.airtableId) return;
  await window.api.patchAirtable(at, p.airtableId, { 'Send log': report.slice(0, 90000) }).catch(() => {});
}

// Why a send didn't go through, in plain words.
const failText = (left) => (left.startsWith('rejected:') ? `Instagram said "${left.slice(9).replace(/[\s.·•]+(now|\d+\s*[a-z]+)\s*$/i, '')}"` : BG_FAIL[left.split(':')[0]] || left);

// What to do by hand when sending while watching.
const HAND_OFF = {
  nodm: "Couldn't open their DM by itself. The clip is loaded: open their DM in Instagram and click the mic.",
  nomic: 'The clip is loaded. Click the mic in their DM and it plays in.',
  early: 'Instagram stopped recording early. The clip is reloaded: click the mic to try again.',
  nosend: 'Clip is in their DM. Hit send in Instagram, then Mark sent.',
  yours: 'Clip is in their DM. Hit send in Instagram, then Mark sent.',
  unposted: "Send was clicked, but nothing reached Instagram's servers. Check the chat: if the note is there, Mark sent; if not, try again.",
  unverified: "Send was clicked, but the app couldn't confirm it with Instagram. Check the chat: if the note is there, Mark sent.",
  stillsending: 'The voice message is still "Sending" in their chat. Give it a moment: if it goes through, Mark sent; if it fails, try again.',
};
// Why a background send didn't go through.
const BG_FAIL = {
  nodm: "couldn't open their DM",
  nomic: "couldn't start a voice message in their DM",
  early: 'Instagram stopped recording early',
  nosend: "couldn't hit Instagram's send button",
  unposted: "Instagram never received the send (no send reached its servers after Send was clicked)",
  unverified: "couldn't confirm with Instagram that the note went out",
  stillsending: 'the voice message was still "Sending" in their chat after 30 seconds',
};

async function clipFor(p) {
  if (!p.handle) return toast('Add their Instagram handle first (Edit details).'), null;
  try {
    const samples = await buildClip(p);
    if (samples.length / audio.SR > MAX_SECONDS) toast('Heads up: this clip is over 60 seconds. Instagram may cut it off.', 7000);
    return samples;
  } catch (e) {
    return toast(e.message), null;
  }
}

// Send: runs in the background so you can go straight to the next lead. Needs auto-send, since nobody is
// watching the background tab to hit send by hand.
function sendLead(p) {
  if (S.rec || S.sending || p.status === 'sending') return;
  return S.settings.autoSend ? queueSend(p) : sendNow(p);
}

async function queueSend(p) {
  const samples = await clipFor(p);
  if (!samples) return;
  stopPlay();
  p.status = 'sending';
  delete p.sendIssue;
  await saveProspects();
  S.bg.jobs.push({ pid: p.id, samples });
  toast(`Sending to @${p.handle} in the background.`);
  if (S.currentId === p.id) {
    const next = nextTodo(p.id);
    if (next) openLead(next.id);
    else {
      S.currentId = null;
      render();
    }
  } else render();
  runQueue();
}

// One send at a time in the hidden tab, silently.
const isVoiceJob = (j) => !j.engage && !j.reply && !j.audit && !j.replycheck && !j.talkcheck;

async function runQueue() {
  if (S.bg.current) return;
  while (S.bg.jobs.length) {
    // Voice notes wait while the safety limits say so (Setup > Safety limits); everything else carries on.
    let g = { ok: true };
    if (S.bg.jobs.some((j) => isVoiceJob(j) && !j.force)) {
      g = voiceGate();
      // A wait already under way keeps its spread-out end time.
      if (g.ok && S.bg.hold && S.bg.hold.until > Date.now()) g = { ...S.bg.hold.g, ok: false, until: S.bg.hold.until };
    }
    const ready = S.bg.jobs.filter((j) => !isVoiceJob(j) || j.force || g.ok);
    if (!ready.length) return holdQueue(g);
    if (g.ok) S.bg.hold = null;
    // Sends first, then replies going out, then looks at chats for replies, then checks of failed sends.
    const rank = (j) => (j.engage ? (j.catchUp ? 3 : 0) : j.samples ? 1 : j.reply ? 2 : j.replycheck ? (j.urgent || j.hurry ? 2 : 3) : j.talkcheck ? 3 : j.audit ? 4 : 1);
    const job = ready.reduce((best, j) => (rank(j) < rank(best) ? j : best), ready[0]);
    S.bg.jobs.splice(S.bg.jobs.indexOf(job), 1);
    const p = S.prospects.find((x) => x.id === job.pid);
    if (job.engage) {
      if (p) await engage(p, job);
      continue;
    }
    if (job.reply) {
      if (p) await sendReplyNow(p, job.reply);
      continue;
    }
    if (job.audit) {
      if (p && p.status === 'todo' && p.sendIssue) await auditOne(p);
      continue;
    }
    if (job.talkcheck) {
      if (p && p.status === 'todo') await talkCheckOne(p);
      continue;
    }
    if (job.replycheck) {
      if (p && p.status === 'sent') await replyCheckOne(p, job);
      else if (!job.urgent) replyBatchStep(false);
      continue;
    }
    if (!p || p.status !== 'sending') continue;
    delete p.waitingLimit;
    const cur = (S.bg.current = { pid: p.id, handle: p.handle, text: 'Starting...', until: 0 });
    paintQueue();
    let issue = '';
    let already = false;
    try {
      const left = await deliver(p, job.samples, {
        target: 'send',
        monitor: false,
        say: (text) => ((cur.text = text), paintQueue()),
        onPlaying: (sec) => ((cur.until = Date.now() + sec * 1000), paintQueue()),
      });
      if (left === 'already') already = true;
      else if (left) issue = failText(left);
    } catch (e) {
      issue = errText(e);
    }
    if (already) {
      toast(`@${p.handle} already had our voice note, so it wasn't sent again. Marked sent ✓`, 6000);
      await markSent(p);
    } else if (issue) {
      window.api.disarm('send');
      p.status = 'todo';
      p.sendIssue = issue;
      delete p.auditedAt;
      await saveProspects();
      toast(`Didn't send to @${p.handle}: ${issue}. It's back in To do.`, 8000);
    } else {
      toast(`Sent to @${p.handle} ✓`);
      await markSent(p);
    }
    S.bg.current = null;
    paintQueue();
    refreshQuietly();
  }
  if (S.watchSend) {
    S.watchSend = false;
    showRightPane();
  }
}

// Voice notes waiting on a safety limit: the strip says why and when the next one goes, and the queue looks again
// then (and every few minutes). A wait between notes gets a random extra so they don't go out on a timer.
let holdTimer = null;
function holdQueue(g) {
  const c = capsNow();
  const same = S.bg.hold && S.bg.hold.g.reason === g.reason && S.bg.hold.until >= g.until;
  if (!same) {
    let until = g.until;
    if (g.reason === 'gap') until += Math.round(Math.random() * 0.4 * c.dmGapMs);
    // A day's limit opens at midnight, but voice notes wait for the morning.
    if ((g.reason === 'day' || g.reason === 'total') && c.window?.on) until = limits.nextWindow(until - 60 * 1000, c.window);
    S.bg.hold = { g, until };
  }
  for (const j of S.bg.jobs.filter(isVoiceJob)) {
    const p = S.prospects.find((x) => x.id === j.pid);
    if (p) p.waitingLimit = true;
  }
  clearTimeout(holdTimer);
  holdTimer = setTimeout(runQueue, Math.max(1000, Math.min(S.bg.hold.until - Date.now() + 500, 5 * 60 * 1000)));
  paintQueue();
}

// "Send one now" on the strip: the next voice note goes out despite the limit, after you confirm.
function sendOneAnyway() {
  const j = S.bg.jobs.find(isVoiceJob);
  if (!j) return;
  if (!confirm(`Send the next voice note now, even though ${limits.reasonText(S.bg.hold?.g || {}, 'dm') || 'the safety limit says to wait'}?`)) return;
  j.force = true;
  S.bg.hold = null;
  runQueue();
}

// Leads that say "send failed" whose voice note went out anyway (the app couldn't confirm it at the time): opens
// each one's chat in the hidden tab, without sending anything, and marks it sent when our voice message is
// there. Runs once for new failures a little after launch, and for all of them from the Leads screen.
function checkFailedSends({ manual = false } = {}) {
  const queued = new Set(S.bg.jobs.filter((j) => j.audit).map((j) => j.pid));
  const list = S.prospects.filter((p) => p.status === 'todo' && p.sendIssue && p.handle && !queued.has(p.id) && (manual || !p.auditedAt));
  if (!list.length) return manual ? toast('No failed sends to check.') : undefined;
  for (const p of list) S.bg.jobs.push({ pid: p.id, audit: true });
  toast(`Checking ${list.length} failed send${list.length === 1 ? '' : 's'} in their Instagram chats...`);
  runQueue();
}

async function auditOne(p) {
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, audit: true };
  paintQueue();
  const r = await window.api.checkLead('send', p.handle).catch((e) => ({ state: 'error', error: errText(e) }));
  p.auditedAt = Date.now();
  const base = p.sendIssue.replace(/ \(checked Instagram:.*\)$/, '');
  if (r.state === 'ok' && r.ours > 0) {
    delete p.sendIssue;
    delete p.sendShot;
    toast(`@${p.handle}: our voice note is in their chat. Marked sent ✓`);
    await markSent(p);
    logSend(p, `Send to @${p.handle} (${p.name || ''}): SENT (found later)\nChecked their chat on ${new Date().toLocaleString()}: ${r.ours} voice message${r.ours === 1 ? '' : 's'} from us already there, so the send marked "${base}" had gone out.`);
  } else {
    p.sendIssue = r.state === 'ok' ? `${base} (checked Instagram: no voice note from us in their chat)` : r.state === 'nodm' ? `${base} (checked Instagram: their DM wouldn't open)` : base;
    await saveProspects();
  }
  S.bg.current = null;
  paintQueue();
  refreshQuietly();
}

// Leads that got a voice note but were never followed (the step failed, or ran on an older build), or were followed
// but never liked (the hour's likes were used up), are caught up on their own, one at a time, 2 to 6 minutes apart,
// within the safety limits. Each lead gets up to 3 tries, 6 hours apart; a fresh send waits 10 minutes first, since
// its own follow-and-like runs right after it. It only runs while you're away from the computer (see `S.away`),
// because it puts the Instagram pane through their profiles and posts.
let lastCatchUp = 0;
let catchUpGap = 0;
// Followed, but no like has gone in and Airtable doesn't have one either.
const owesLikes = (p) => !!p.followedAt && p.likesDone !== true && p.igLiked !== 'true';
const catchUpLeft = (now = Date.now()) =>
  S.prospects.filter(
    (p) =>
      p.status === 'sent' &&
      p.handle &&
      (!p.followedAt || owesLikes(p)) &&
      p.atStatus !== 'Not interested' &&
      p.sentAt &&
      now - p.sentAt > 10 * 60 * 1000 &&
      now - p.sentAt < 30 * DAY_MS &&
      (p.catchUp?.tries || 0) < 3,
  );
const catchUpDue = (now = Date.now()) =>
  catchUpLeft(now)
    .filter((p) => !p.catchUp?.at || now - p.catchUp.at > 6 * 60 * 60 * 1000)
    .sort((a, b) => b.sentAt - a.sentAt);
function catchUpEngage() {
  if (!S.settings.engageAfterSend || !S.away || S.bg.current || S.bg.jobs.some((j) => j.engage)) return;
  const now = Date.now();
  if (now - lastCatchUp < catchUpGap) return;
  // While the follow limit is used up, only leads that already follow back (and just need their likes) are worth a visit.
  const f = S.follow;
  const followFull = !!f && (f.today >= f.cap || ['cap', 'hour', 'totalcap', 'paused'].includes(f.phase?.kind));
  const p = catchUpDue(now).find((x) => x.followedAt || !followFull);
  if (!p) return;
  p.catchUp = { tries: (p.catchUp?.tries || 0) + 1, at: now };
  saveProspects();
  lastCatchUp = now;
  catchUpGap = S.fast ? 1000 : (2 + Math.random() * 4) * 60 * 1000;
  S.bg.jobs.push({ pid: p.id, engage: true, catchUp: true });
  runQueue();
}

// Once a note is sent: follow them and like their 1st and 4th posts. It runs in the follow tab, straight
// after that send and before the next one.
function queueEngage(p) {
  if (!p.handle) return;
  if (!S.settings.engageAfterSend) {
    // Off in Setup: say so on the lead's record, so a missing follow is never a mystery.
    airtableReply(p, { 'IG log': `${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}, after the voice note: the follow and likes are off in Setup` });
    return;
  }
  // While you're using the app the pane would jump between profiles: leave it to the catch-up, once you step away.
  if (!S.away) return;
  S.bg.jobs.unshift({ pid: p.id, engage: true });
  runQueue();
}

async function engage(p, job = {}) {
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, engage: true };
  paintQueue();
  const r = await window.api.engage(p.handle, p.airtableId || '').catch((e) => ({ result: 'failed', note: errText(e) }));
  // Followed (or already following): done, here as in Airtable. Likes are done once one went in or there's nothing
  // to like (a private account, no posts); otherwise they're owed, and the catch-up comes back for them.
  if (r.followed || r.result === 'already') {
    p.followedAt ||= new Date().toISOString();
    p.likesDone = r.likes > 0 || !!r.private || /no posts yet/.test(r.likeWhy || '');
  }
  // A limit (including the follow limit, when only the likes went in), a pause, or you being in the app isn't a try:
  // the follow is still owed and the catch-up comes back for it.
  if (job.catchUp && ['limit', 'paused', 'later', 'notfollowed'].includes(r.result) && p.catchUp) {
    p.catchUp.tries = Math.max(0, p.catchUp.tries - 1);
    if (r.result === 'later') p.catchUp.at = 0;
  }
  saveProspects();
  if (r.result === 'later') {
    S.away = false;
    S.bg.current = null;
    paintQueue();
    return;
  }
  if (r.result === 'blocked') toast(`Instagram pushed back while following @${p.handle} ("${r.note}"). Follows and likes pause for 48 hours.`, 8000);
  else if (r.result === 'paused') toast(`@${p.handle}: the follow and likes were skipped (following is paused after an Instagram push-back). See the Follow screen.`, 8000);
  else if (r.result === 'failed') toast(`@${p.handle}: the follow step didn't finish (${r.note}). See the Follow screen.`, 8000);
  else if (!r.private && r.tried && !r.likes) toast(`@${p.handle}: followed, but no post was liked (${r.likeWhy || 'unknown'}). See the Follow screen.`, 8000);
  S.bg.current = null;
  paintQueue();
}

// ---------- Replies: watch the DM inbox, answer a clear yes with their code, draft the rest ----------
const RF = replies.REPLY_FIELDS;
const INTENT_LABEL = { yes: 'Yes', no: 'No', question: 'Question', unclear: 'Unclear' };

async function airtableReply(p, fields) {
  const at = S.settings.airtable;
  if (!at.writeBack || !at.token || !p.airtableId) return;
  try {
    await window.api.patchAirtable(at, p.airtableId, fields);
  } catch (e) {
    toast(`Airtable said: ${errText(e)}`, 8000);
  }
}

// Replies are read from each sent lead's own chat (their profile's Message button opens it; nothing is sent).
// The inbox watcher is what catches new messages, within a minute. While it works, the chat-by-chat sweep is
// only a backstop for leads messaged in the last 3 days (whatever they wrote then is new), every 30 minutes, so
// older chats are never read back. When the watcher can't read the inbox (or is off), the sweep does the work:
// leads messaged in the last two days every `everyMin` minutes (10 at least), the last two weeks hourly, up to
// 30 days every 6 hours. "Check now" always looks at every lead from the last 30 days.
const watcherWorks = () => {
  const sc = S.replies.scan;
  return !!(S.settings.replies.quick && sc && !sc.issue && sc.rows > 0 && Date.now() - sc.at < 10 * 60 * 1000);
};
function replyCadence(p, { manual = false } = {}) {
  const last = Math.max(p.sentAt || 0, p.reply?.sentAt || 0, p.reply?.at || 0);
  const age = Date.now() - last;
  if (!last || age > 30 * DAY_MS) return null;
  if (!manual && watcherWorks()) return age < 3 * DAY_MS ? 30 * 60 * 1000 : null;
  if (age < 2 * DAY_MS) return Math.max(10, Number(S.settings.replies.everyMin) || 10) * 60 * 1000;
  if (age < 14 * DAY_MS) return 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

// Queues a look at every sent lead that's due. Each look is its own background job, behind any send.
function checkReplies({ manual = false } = {}) {
  const r = S.settings.replies;
  if (!manual && !r.watch) return;
  const busy = new Set(S.bg.jobs.filter((j) => j.replycheck).map((j) => j.pid));
  if (S.bg.current?.check) busy.add(S.bg.current.pid);
  const due = S.prospects.filter((p) => {
    if (p.status !== 'sent' || !p.handle || busy.has(p.id)) return false;
    const every = replyCadence(p, { manual });
    return every && (manual || !p.replyCheckedAt || Date.now() - p.replyCheckedAt >= every);
  });
  if (!due.length) {
    if (manual) toast(busy.size ? 'Already checking.' : 'No sent leads from the last 30 days to check.');
    return;
  }
  S.replies.batch = { total: due.length, done: 0, found: 0 };
  S.replies.checking = true;
  for (const p of due) S.bg.jobs.push({ pid: p.id, replycheck: true });
  if (manual) toast(`Checking ${due.length} chat${due.length === 1 ? '' : 's'} for replies...`);
  refreshQuietly();
  runQueue();
}

function replyBatchStep(found) {
  const b = S.replies.batch;
  if (!b) return;
  b.done++;
  if (found) b.found++;
  if (b.done < b.total) return;
  S.replies = { ...S.replies, checking: false, batch: null, lastAt: Date.now(), note: b.found ? `${b.found} new ${b.found === 1 ? 'reply' : 'replies'}` : 'No new replies' };
}

// Their messages since our last one, and what came before, from a chat read oldest first.
function theirLatest(messages) {
  let i = messages.length;
  while (i > 0 && !messages[i - 1].mine) i--;
  const theirs = messages.slice(i);
  const text = theirs.map((m) => m.text || (m.voice ? '[voice message]' : '')).filter(Boolean).join('\n');
  return { ours: i > 0, theirs, text, history: messages.slice(0, i), voiceOnly: theirs.length > 0 && theirs.every((m) => m.voice && !m.text) };
}

// Copies a plain-text report of what one lead's chat looks like to the app, to paste along with a question.
async function copyChatReport(handle) {
  if (S.bg.current || S.replies.checking) return toast('Busy with something else. Try again in a minute.');
  S.bg.current = { handle, text: '', until: 0, check: true };
  paintQueue();
  toast(`Reading @${handle}'s chat...`);
  try {
    const report = await window.api.chatReport('send', handle, replies.leadNames(S.prospects.find((x) => x.handle === handle) || {}));
    const copied = await window.api.copyText(report).catch(() => false);
    toast(copied ? 'Report copied. Paste it into the chat.' : "Couldn't copy the report.", 6000);
  } catch (e) {
    toast(`Couldn't make the report: ${errText(e)}`, 6000);
  } finally {
    S.bg.current = null;
    paintQueue();
    refreshQuietly();
  }
}

// What each look at a chat read, so "No new replies" can be checked against what's really in the chat.
function noteSeen(p, r) {
  const msgs = r.messages || [];
  const theirs = msgs.filter((m) => !m.mine);
  const lastTheirs = [...theirs].reverse().find((m) => m.text || m.voice);
  const entry = {
    handle: p.handle,
    at: Date.now(),
    state: r.state,
    error: r.error || '',
    total: msgs.length,
    ours: msgs.length - theirs.length,
    theirs: theirs.length,
    last: lastTheirs ? lastTheirs.text || '[voice message]' : '',
    lastIsTheirs: !!msgs.length && !msgs[msgs.length - 1].mine,
    via: r.via || '',
    anchored: !!r.anchored,
  };
  S.replies.seen = [entry, ...(S.replies.seen || []).filter((x) => x.handle !== p.handle)].slice(0, 40);
}

// One lead's chat: anything new from them since our last message? `job.urgent` looks come from the inbox watcher
// (a message just arrived) and aren't part of a sweep; `job.row` is the inbox row that prompted them.
async function replyCheckOne(p, job = {}) {
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, check: true };
  paintQueue();
  const r = await window.api.readChat('send', p.handle, replies.leadNames(p)).catch((e) => ({ state: 'error', error: errText(e), messages: [] }));
  p.replyCheckedAt = Date.now();
  // A read receipt ("Seen yesterday") under our note isn't a message from them.
  r.messages = (r.messages || []).filter((m) => !replies.isReceipt(m));
  let found = false;
  noteSeen(p, r);
  if (job.row) {
    // The inbox's message is looked at once: remembered when the chat was read properly, retried in a few minutes if not.
    if (r.state === 'ok' && r.anchored) {
      p.inboxSeen = { preview: job.row.preview, at: Date.now() };
      delete p.inboxTryAt;
    } else Object.assign(p, { inboxTryAt: Date.now(), inboxTryPreview: job.row.preview });
  }
  if (r.state === 'loggedout') S.replies.issue = 'Instagram is logged out. Sign in on the right.';
  else if (r.state === 'ok') {
    S.replies.issue = '';
    found = await judgeChat(p, r);
  }
  if (!job.urgent) replyBatchStep(found);
  S.bg.current = null;
  paintQueue();
  await saveProspects();
  refreshQuietly();
}

// A lead still on the to-do list whose chat is in the inbox: we're already talking to them (by hand, outside the
// app). Their own chat is opened from their profile and, when it holds a message (Instagram labels each one
// "React to message from ..."), the lead moves to Sent here and in Airtable, so it isn't sent a cold voice note on
// top of the conversation. It doesn't count as a voice note sent today.
async function talkCheckOne(p) {
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, check: true };
  paintQueue();
  const r = await window.api.readChat('send', p.handle, replies.leadNames(p)).catch((e) => ({ state: 'error', error: errText(e), messages: [] }));
  p.talkCheckedAt = Date.now();
  const said = (r.messages || []).filter((m) => m.who);
  if (r.state === 'ok' && said.length && p.status === 'todo') {
    p.status = 'sent';
    p.sentAt = Date.now();
    p.sentBy = 'conversation';
    delete p.sendIssue;
    paintSentToday();
    toast(`@${p.handle}: you're already talking to them, so they've moved to Sent. (${said.some((m) => !m.mine) ? 'They wrote back.' : 'You wrote first.'})`, 9000);
    const at = S.settings.airtable;
    if (at.writeBack && at.token && p.airtableId) {
      window.api.markSent(at, p.airtableId).then(
        () => {
          p.atStatus = 'Sent';
          saveProspects();
        },
        (e) => toast(`Moved to Sent here, but Airtable said: ${errText(e)}`, 8000),
      );
    }
    queueEngage(p);
  }
  S.bg.current = null;
  paintQueue();
  await saveProspects();
  refreshQuietly();
}

// What a read of one chat means. Messages are only placed against our voice note, so a chat where the app
// didn't find it says nothing either way. Returns whether there's a new reply from them.
async function judgeChat(p, r) {
  if (!r.anchored) return false;
  const msgs = r.messages || [];
  const got = theirLatest(msgs);
  const anyTheirs = msgs.some((m) => !m.mine);
  const was = p.reply;
  // A reply recorded for someone who has written nothing: an earlier read got it wrong. Take it back.
  if (was && !was.sent && !anyTheirs && !p.partner?.code) {
    await clearFalseReply(p);
    return false;
  }
  if (got.ours && got.text && got.text !== was?.key) {
    await handleReply(p, got.text, got.history, { key: got.text, voiceOnly: got.voiceOnly });
    return true;
  }
  // They wrote, and someone has answered since (you, in the chat): nothing is waiting any more.
  if (was?.pending && anyTheirs && !got.theirs.length) {
    Object.assign(was, { pending: false, auto: false, dismissed: true, note: 'You answered them in the chat.' });
    await airtableReply(p, { [RF.handled]: true });
    toast(`@${p.handle}: you've answered in the chat, so it's cleared from Replies.`, 6000);
  }
  return false;
}

// Puts a lead back to "sent" in the app and in Airtable when a reply recorded for it turns out not to exist.
async function clearFalseReply(p) {
  delete p.reply;
  const back = !p.atStatus || /^(replied|sent)$/i.test(p.atStatus);
  await airtableReply(p, { ...(back ? { [RF.status]: 'Sent' } : {}), [RF.lastReply]: '', [RF.received]: null, [RF.intent]: null, [RF.suggested]: '', [RF.handled]: false });
  if (back) p.atStatus = 'Sent';
  toast(`@${p.handle} hadn't replied after all (an earlier read was wrong). Cleared.`, 7000);
}

// ---------- The inbox watcher ----------
// Every 30 seconds the hidden inbox tab is read for unread messages. One from a lead we sent a voice note to gets its
// chat read right away (ahead of the slower sweep), so a reply is seen within about a minute of arriving.
async function unreadScan({ manual = false } = {}) {
  const st = S.settings.replies;
  if (S.scanning || (!manual && !(st.watch && st.quick))) return;
  if (!S.prospects.some((p) => p.status === 'sent' && p.handle)) return;
  S.scanning = true;
  const scan = { at: Date.now(), rows: 0, unread: 0, leads: 0, via: '', issue: '' };
  try {
    const res = await window.api.unreadScan();
    scan.via = res.via || '';
    scan.rows = res.rows?.length || 0;
    if (res.state === 'loggedout') scan.issue = 'Instagram is logged out. Sign in on the right.';
    else if (res.state === 'unreadable') scan.issue = "the chat list in the inbox couldn't be read";
    else if (res.state !== 'ok') scan.issue = res.error || 'the inbox would not load';
    else {
      const plan = replies.inboxPlan(res.rows, S.prospects);
      Object.assign(scan, { unread: plan.unread, leads: plan.mine });
      // To-do leads that already have a chat with us: one look at each.
      for (const { p } of replies.talkPlan(res.rows, S.prospects)) {
        if (!S.bg.jobs.some((j) => j.talkcheck && j.pid === p.id) && !(S.bg.current?.check && S.bg.current.pid === p.id)) S.bg.jobs.push({ pid: p.id, talkcheck: true });
      }
      if (S.bg.jobs.some((j) => j.talkcheck)) runQueue();
      for (const { p, row } of plan.note) p.inboxSeen = { preview: row.preview, at: Date.now(), baseline: true };
      if (plan.note.length) await saveProspects();
      for (const { p, row } of plan.read) {
        const again = S.bg.jobs.find((j) => j.replycheck && j.pid === p.id);
        if (again) Object.assign(again, { hurry: true, row }); // a sweep's look moves up, and stays counted in the sweep
        else if (!(S.bg.current?.check && S.bg.current.pid === p.id)) S.bg.jobs.push({ pid: p.id, replycheck: true, urgent: true, row });
      }
      if (plan.read.length) runQueue();
    }
  } catch (e) {
    scan.issue = errText(e);
  }
  S.replies.scan = scan;
  S.scanning = false;
  if (manual && S.view === 'replies') refreshQuietly();
  else paintScan();
}

function scanLine() {
  const sc = S.replies.scan;
  if (!S.settings.replies.quick) return 'Inbox watcher off (Setup).';
  if (!sc) return 'Inbox watcher starting...';
  if (sc.issue) return `Inbox watcher: ${sc.issue}. The chat-by-chat check still runs.`;
  return `Inbox watcher: ${sc.rows} chat${sc.rows === 1 ? '' : 's'} in the inbox, ${sc.unread} unread${sc.leads ? `, ${sc.leads} from your leads` : ''} · checked ${ago(sc.at)}`;
}
function paintScan() {
  const el = document.getElementById('scan-line');
  if (el) el.textContent = scanLine();
}

// Copies what the app sees in the inbox, to paste along with a question.
async function copyInboxReport() {
  toast('Reading the inbox...');
  try {
    const report = await window.api.inboxReport();
    const copied = await window.api.copyText(report).catch(() => false);
    toast(copied ? 'Inbox report copied. Paste it into the chat.' : "Couldn't copy the report.", 6000);
  } catch (e) {
    toast(`Couldn't make the report: ${errText(e)}`, 6000);
  }
}

// A notification (click it to land on Replies), and the number waiting on you on the dock icon.
function notifyReply(title, body) {
  if (S.settings.replies.notify) window.api.notify({ title, body, tab: 'replies' }).catch(() => {});
}
let lastBadge = -1;
function syncBadge() {
  const n = pendingAll();
  if (n === lastBadge) return;
  lastBadge = n;
  window.api.badge(n).catch(() => {});
}
// While replies are being watched the window can be closed on a Mac and the app keeps going, with the Mac kept awake.
function applyBackground() {
  const r = S.settings.replies;
  window.api.keepRunning(!!(r.watch && r.background)).catch(() => {});
}

// What a reply gets: a yes or a question gets their code and how to set up, written for them, sent on its own
// after the delay in Setup (15 minutes by default), unless you answer first. A no is marked and left alone.
// Anything unclear, or a voice message, waits under Replies with a draft for you.
async function handleReply(p, text, history, { key = text, voiceOnly = false, keepSendAt = false } = {}) {
  const st = S.settings;
  const prev = p.reply;
  const at = keepSendAt && prev?.pending ? prev.at : Date.now();
  p.reply = { key, text, at, history: history.slice(-8).map(({ mine, text: t, voice }) => ({ mine, text: t || (voice ? '[voice message]' : ''), voice })), pending: true, intent: '', draft: '', why: '', issue: '', auto: false, sendAt: null };
  await airtableReply(p, { [RF.status]: 'Replied', [RF.lastReply]: text, [RF.received]: new Date(at).toISOString(), [RF.handled]: false });
  let intent = 'unclear';
  let draft = '';
  let why = '';
  try {
    if (voiceOnly) why = 'They answered with a voice message. Listen to it in the chat and reply here.';
    else if (st.claude.key) {
      const d = await window.api.replyDraft(st.claude.key, replies.replyPrompt(p, { text, history: p.reply.history, from: st.replies.from, percent: st.torrey.percent, site: st.torrey.site }));
      ({ intent, why } = d);
      draft = d.reply;
    } else {
      intent = replies.quickIntent(text);
      if (intent === 'yes') draft = replies.fallbackMessage(p, { ...replies.SLOTS, from: st.replies.from, percent: st.torrey.percent });
      why = 'Read without Claude (no API key in Setup), so only a plain yes or no is understood.';
    }
  } catch (e) {
    p.reply.issue = errText(e);
  }
  Object.assign(p.reply, { intent, draft, why });
  if (intent === 'no') {
    p.reply.pending = false;
    await airtableReply(p, { [RF.status]: 'Not interested', [RF.intent]: 'No', [RF.handled]: true });
    toast(`@${p.handle} said no thanks. Marked not interested.`);
    notifyReply(`${who(p)} isn't interested`, `"${text.slice(0, 90)}" · Marked not interested. Nothing was sent.`);
    return;
  }
  await airtableReply(p, { [RF.intent]: INTENT_LABEL[intent] || 'Unclear', [RF.suggested]: draft, [RF.handled]: false });
  if ((intent === 'yes' || intent === 'question') && draft && !p.reply.issue && st.replies.auto) {
    // A human pace: the delay in Setup, give or take a tenth. A reply that grew (they wrote again) keeps its turn.
    const delay = Math.max(0, Number(st.replies.delayMin) || 0) * 60 * 1000;
    let sendAt = at + delay + Math.round(delay * (Math.random() * 0.2 - 0.1));
    if (keepSendAt && prev?.sendAt) sendAt = Math.max(prev.sendAt, Date.now() + 30 * 1000);
    Object.assign(p.reply, { auto: true, sendAt });
    const mins = Math.max(0, Math.round((sendAt - Date.now()) / 60000));
    toast(`@${p.handle} ${intent === 'yes' ? 'said yes' : 'asked for more info'}. Their answer and code go out ${mins ? `in about ${mins} min` : 'shortly'} (Replies tab).`, 7000);
    notifyReply(`${who(p)} ${intent === 'yes' ? 'is interested' : 'wants more info'}`, `"${text.slice(0, 90)}" · Their answer and code go out ${mins ? `in about ${mins} min` : 'shortly'}. Open Replies to edit it or send it now.`);
    return;
  }
  toast(`@${p.handle} replied. A draft is waiting under Replies.`, 6000);
  notifyReply(`${who(p)} replied`, `"${text.slice(0, 90)}" · ${draft ? 'A draft is waiting for you.' : 'Waiting for you to answer.'}`);
}

const who = (p) => p.name || `@${p.handle}`;

// Auto-replies that are due go into the background queue.
function dueReplies() {
  for (const p of S.prospects) {
    const r = p.reply;
    if (!r?.pending || !r.auto || !r.sendAt || r.sendAt > Date.now()) continue;
    if (S.bg.jobs.some((j) => j.reply && j.pid === p.id) || S.bg.current?.pid === p.id) continue;
    S.bg.jobs.push({ pid: p.id, reply: { withCode: true, scheduled: true } });
  }
  runQueue();
}

// Reserves their code on torreylabs.store if needed, fills it into the message, and types it into the thread.
async function sendReplyNow(p, { text, withCode = false, scheduled = false }) {
  const st = S.settings;
  let vals = null;
  if (scheduled && !(p.reply?.pending && p.reply.auto)) return; // cancelled while it waited
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, reply: true };
  paintQueue();
  const done = async () => {
    S.bg.current = null;
    paintQueue();
    await saveProspects();
    refreshQuietly();
  };
  if (scheduled) {
    // Right before an auto-reply goes out, look at the chat again: if you answered them yourself, it's dropped;
    // if they wrote more, the answer is written again with everything they said.
    const chat = await window.api.readChat('send', p.handle, replies.leadNames(p)).catch(() => null);
    if (chat?.state === 'ok' && chat.anchored && chat.messages?.length) {
      const got = theirLatest(chat.messages);
      if (!got.theirs.length) {
        Object.assign(p.reply, { pending: false, auto: false, dismissed: true, note: 'You answered them in the chat, so the auto-reply was dropped.' });
        await airtableReply(p, { [RF.handled]: true });
        toast(`@${p.handle}: you already answered, so the auto-reply was dropped.`, 6000);
        return done();
      }
      if (got.text && got.text !== p.reply.key) {
        await handleReply(p, got.text, got.history, { key: got.text, voiceOnly: got.voiceOnly, keepSendAt: true });
        return done();
      }
    }
    text = p.reply.draft;
  }
  try {
    if (withCode) {
      if (!p.partner?.code) {
        if (!st.torrey.key) throw new Error('Add the Torrey Labs invite key in Setup to issue partner codes.');
        const { code, token } = await window.api.torreyInvite(st.torrey, {
          candidates: replies.codeCandidates(p),
          label: `${p.name || p.handle} (@${p.handle}), from a voice note`,
          rate: Math.min(0.5, Math.max(0, (Number(st.torrey.percent) || 20) / 100)),
        });
        p.partner = { code, invite: replies.inviteLink(st.torrey.site, token), link: replies.partnerLink(st.torrey.site, code), at: Date.now() };
        await saveProspects();
      }
      vals = p.partner;
      text = replies.hasSlots(text) ? replies.fillSlots(text, vals) : `${text.trim()}\n\n${replies.codeLines(vals)}`;
    }
    const r = await window.api.dmSend({ href: p.dm?.href, handle: p.handle, text });
    p.reply = { ...p.reply, pending: false, auto: false, sent: text, sentAt: Date.now(), issue: r?.state === 'sent' ? '' : "Sent, but the app couldn't confirm it landed. Check the thread." };
    p.dm = { ...p.dm, preview: `You: ${text.slice(0, 60)}` };
    await airtableReply(p, {
      [RF.suggested]: text,
      [RF.handled]: true,
      [RF.intent]: INTENT_LABEL[p.reply.intent] || (vals ? 'Yes' : 'Unclear'),
      ...(vals ? { [RF.status]: 'Code sent', [RF.code]: vals.code, [RF.link]: vals.link, [RF.invite]: vals.invite, [RF.codeSentAt]: new Date().toISOString() } : {}),
    });
    toast(`Replied to @${p.handle}${vals ? ` with their code ${vals.code}` : ''} ✓`);
    notifyReply(`Answered ${who(p)}`, vals ? `Sent their code ${vals.code} and how to set up.` : 'Your reply went out.');
  } catch (e) {
    // A failed auto-reply turns into a draft for you, so it can't keep retrying on its own.
    p.reply = { ...p.reply, pending: true, auto: false, draft: text, issue: errText(e) };
    await airtableReply(p, { [RF.suggested]: text, [RF.handled]: false });
    toast(`Couldn't reply to @${p.handle}: ${errText(e)}. It's waiting under Replies.`, 8000);
    notifyReply(`Couldn't answer ${who(p)}`, `${errText(e)} It's waiting under Replies.`);
  }
  return done();
}

function queueReply(p, reply) {
  S.bg.jobs.push({ pid: p.id, reply });
  toast(`Replying to @${p.handle}...`);
  runQueue();
}

const pendingReplies = () => S.prospects.filter((p) => p.reply?.pending);

// Updates the screen after a background change, unless that would interrupt recording or typing.
function refreshQuietly() {
  if (S.rec || S.view === 'setup' || document.activeElement?.matches?.('input, textarea')) return (paintQueue(), paintPipeline());
  render();
}

// ---------- Replies to emails ----------
// Leads emailed from Garrett's mailbox who write back. Make (TL5b) reads that mailbox and writes each reply into the lead's
// Airtable row (Status Replied, Last reply), so the app picks them up there, has Claude write the answer, and sends it from
// the mailbox itself with the app password in Setup. Each one is kept by the lead's Airtable record id.
const saveEmails = () => store.put('kv', 'emails', S.emails.items);
const pendingEmails = () => Object.values(S.emails.items).filter((e) => e.pending);
const pendingAll = () => pendingReplies().length + pendingEmails().length;
const emailReady = () => {
  const m = S.settings.mail;
  return !!(m.on && m.user && m.pass && S.settings.airtable.token);
};
const emailWho = (e) => e.lead.name || e.lead.business || e.email;
const OLD_REPLY_MS = 2 * 24 * 60 * 60 * 1000;

async function airtableEmail(e, fields) {
  const at = S.settings.airtable;
  if (!at.writeBack || !at.token || !e.airtableId) return;
  try {
    await window.api.patchAirtable(at, e.airtableId, fields);
  } catch (err) {
    toast(`Airtable said: ${errText(err)}`, 8000);
  }
}

function paintEmailLine() {
  const el = document.getElementById('email-line');
  if (el) {
    el.textContent = emailLine();
    el.className = `grow small ${S.emails.issue ? 'bad' : 'muted'}`;
  }
}
function emailLine() {
  const m = S.settings.mail;
  if (!m.on) return 'Email replies are off (Setup > Auto-reply).';
  if (!m.pass) return 'Email: add the Gmail app password in Setup > Auto-reply to answer emailed leads.';
  if (S.emails.checking) return 'Email: checking Airtable for replies...';
  if (S.emails.issue) return `Email: couldn't check (${S.emails.issue})`;
  return S.emails.lastAt ? `Email: answering as ${m.user} · last check ${ago(S.emails.lastAt)}: ${S.emails.note}` : `Email: answering as ${m.user} · no check yet`;
}

// Looks in Airtable for emailed leads who wrote back and turns each new reply into something to answer.
async function emailCheck({ manual = false } = {}) {
  const st = S.settings;
  if (S.emails.checking) return;
  if (!emailReady()) {
    if (manual) toast(st.airtable.token ? 'Add the Gmail app password in Setup > Auto-reply first.' : 'Add your Airtable token first (Setup > Airtable).');
    return;
  }
  S.emails.checking = true;
  paintEmailLine();
  let fresh = 0;
  try {
    const rows = await window.api.pullEmailReplies(st.airtable);
    for (const r of rows) {
      if (fresh >= 10) break;
      if (await takeEmailReply(r)) fresh++;
    }
    // Answered by hand (Reply handled ticked in Airtable) or no longer a reply there: it leaves the waiting list.
    const open = new Set(rows.map((r) => r.airtableId));
    for (const e of pendingEmails()) {
      if (open.has(e.airtableId) || e.sending) continue;
      Object.assign(e, { pending: false, auto: false, dismissed: true, note: 'Handled in Airtable, so nothing was sent.' });
    }
    await saveEmails();
    S.emails.lastAt = Date.now();
    S.emails.issue = '';
    S.emails.note = `${rows.length} unanswered ${rows.length === 1 ? 'reply' : 'replies'}${fresh ? `, ${fresh} new` : ''}`;
  } catch (err) {
    S.emails.issue = errText(err);
  }
  S.emails.checking = false;
  paintEmailLine();
  syncBadge();
  if (fresh || manual) refreshQuietly();
}

// One row from Airtable. Returns true when it is a reply the app hasn't seen.
async function takeEmailReply(r) {
  if (!r.email || wasRemoved(r)) return false;
  const { subject, body } = replies.splitEmail(r.lastReply);
  if (!body) return false;
  const at = Date.parse(r.replyAt) || Date.now();
  const ex = S.emails.items[r.airtableId];
  if (ex && ex.key === body && !ex.dismissed) return false;
  if (ex && ex.key === body && ex.dismissed && ex.at >= at) return false;
  const lead = {
    first: r.first,
    name: r.name,
    business: r.business,
    role: r.role,
    category: r.category,
    hook: r.hook,
    bio: r.bio,
    note: r.note,
    email: r.email,
    handle: r.handle,
  };
  // The thread so far: what we emailed, what they wrote before (and our answer to it), for the model to read.
  const history = [];
  if (r.emailBody) history.push({ mine: true, text: r.emailBody });
  if (ex?.key && ex.key !== body) {
    history.push({ mine: false, text: ex.key });
    if (ex.sent) history.push({ mine: true, text: ex.sent });
  }
  const again = !!(ex?.pending && ex.key !== body);
  const e = Object.assign(ex || {}, { id: r.airtableId, airtableId: r.airtableId, lead, email: r.email, subject: subject || r.emailSubject, at, key: body, text: body, history: history.slice(-6), pending: true, dismissed: false, note: '', sent: ex?.sent && ex.key === body ? ex.sent : '' });
  S.emails.items[r.airtableId] = e;
  await handleEmail(e, { keepSendAt: again });
  return true;
}

// What a reply gets: a yes or a question gets their code and how to set up, written for them; a no is marked and left alone;
// anything unclear waits under Replies with a draft. Answers go out on their own only when Setup says so.
async function handleEmail(e, { keepSendAt = false } = {}) {
  const st = S.settings;
  const from = st.mail.from || st.replies.from;
  const prevSendAt = e.sendAt;
  Object.assign(e, { intent: '', draft: '', why: '', issue: '', auto: false, sendAt: null });
  let intent = 'unclear';
  let draft = '';
  let why = '';
  try {
    if (st.claude.key) {
      const d = await window.api.replyDraft(st.claude.key, replies.replyPrompt(e.lead, { text: e.text, history: e.history, from, percent: st.torrey.percent, site: st.torrey.site, channel: 'email', subject: e.subject }));
      ({ intent, why } = d);
      draft = d.reply;
    } else {
      intent = replies.quickIntent(e.text);
      if (intent === 'yes') draft = replies.fallbackMessage(e.lead, { ...replies.SLOTS, from, percent: st.torrey.percent, email: true });
      why = 'Read without Claude (no API key in Setup), so only a plain yes or no is understood.';
    }
  } catch (err) {
    e.issue = errText(err);
  }
  Object.assign(e, { intent, draft, why });
  const name = emailWho(e);
  if (intent === 'no') {
    e.pending = false;
    await airtableEmail(e, { [RF.status]: 'Not interested', [RF.intent]: 'No', [RF.handled]: true });
    toast(`${name} said no thanks by email. Marked not interested.`);
    notifyReply(`${name} isn't interested`, `"${e.text.slice(0, 90)}" · Marked not interested. Nothing was sent.`);
    return saveEmails();
  }
  await airtableEmail(e, { [RF.intent]: INTENT_LABEL[intent] || 'Unclear', [RF.suggested]: draft, [RF.handled]: false });
  const old = Date.now() - e.at > OLD_REPLY_MS;
  if ((intent === 'yes' || intent === 'question') && draft && !e.issue && st.mail.auto && !old) {
    const delay = Math.max(0, Number(st.replies.delayMin) || 0) * 60 * 1000;
    let sendAt = Date.now() + delay + Math.round(delay * (Math.random() * 0.2 - 0.1));
    if (keepSendAt && prevSendAt) sendAt = Math.max(prevSendAt, Date.now() + 30 * 1000);
    Object.assign(e, { auto: true, sendAt });
    const mins = Math.max(0, Math.round((sendAt - Date.now()) / 60000));
    toast(`${name} ${intent === 'yes' ? 'said yes' : 'asked for more info'} by email. Their answer and code go out ${mins ? `in about ${mins} min` : 'shortly'} (Replies tab).`, 7000);
    notifyReply(`${name} ${intent === 'yes' ? 'is interested' : 'wants more info'}`, `"${e.text.slice(0, 90)}" · Their emailed answer and code go out ${mins ? `in about ${mins} min` : 'shortly'}. Open Replies to edit it or send it now.`);
  } else {
    toast(`${name} replied by email. A draft is waiting under Replies.`, 6000);
    notifyReply(`${name} replied by email`, `"${e.text.slice(0, 90)}" · ${draft ? 'A draft is waiting for you.' : 'Waiting for you to answer.'}`);
  }
  return saveEmails();
}

// Answers that are due go out one at a time.
async function dueEmails() {
  if (S.emails.sendingNow) return;
  const e = pendingEmails().find((x) => x.auto && x.sendAt && x.sendAt <= Date.now() && !x.sending);
  if (!e) return;
  S.emails.sendingNow = true;
  try {
    await sendEmailNow(e, { text: e.draft, withCode: true, scheduled: true });
  } finally {
    S.emails.sendingNow = false;
  }
}

// Reserves their code on torreylabs.store if needed, fills it into the message, and sends it from the mailbox.
async function sendEmailNow(e, { text, withCode = false, scheduled = false }) {
  const st = S.settings;
  if (e.sending || (scheduled && !(e.pending && e.auto))) return;
  e.sending = true;
  let vals = null;
  try {
    if (!st.mail.pass) throw new Error('Add the Gmail app password in Setup > Auto-reply first.');
    if (scheduled) {
      // Right before an answer goes out on its own, look at their row again: handled by hand, or they wrote more.
      const { found } = await window.api.pullAirtableByIds(st.airtable, [e.airtableId]);
      const now = found[0];
      if (!now || now.atStatus !== 'Replied' || now.replyHandled === 'true') {
        Object.assign(e, { pending: false, auto: false, dismissed: true, note: now ? `Airtable has them as ${now.atStatus || 'handled'} now, so the answer was dropped.` : 'They were deleted from Airtable, so the answer was dropped.' });
        toast(`${emailWho(e)}: handled elsewhere, so the emailed answer was dropped.`, 6000);
        return;
      }
      const latest = replies.splitEmail(now.lastReply).body;
      if (latest && latest !== e.key) {
        Object.assign(e, { history: [...e.history, { mine: false, text: e.key }].slice(-6), key: latest, text: latest, at: Date.parse(now.replyAt) || Date.now() });
        await handleEmail(e, { keepSendAt: true });
        return;
      }
      text = e.draft;
    }
    if (withCode || replies.hasSlots(text)) {
      if (!e.partner?.code) {
        if (!st.torrey.key) throw new Error('Add the Torrey Labs invite key in Setup to issue partner codes.');
        const { code, token } = await window.api.torreyInvite(st.torrey, {
          candidates: replies.codeCandidates(e.lead),
          label: `${emailWho(e)} (${e.email}), from an email reply`,
          rate: Math.min(0.5, Math.max(0, (Number(st.torrey.percent) || 20) / 100)),
        });
        e.partner = { code, invite: replies.inviteLink(st.torrey.site, token), link: replies.partnerLink(st.torrey.site, code), at: Date.now() };
        await saveEmails();
      }
      vals = e.partner;
      text = replies.hasSlots(text) ? replies.fillSlots(text, vals) : `${text.trim()}\n\n${replies.codeLines(vals)}`;
    }
    await window.api.mailSend(st.mail, { to: e.email, subject: replies.reSubject(e.subject), text, name: st.mail.from || st.replies.from });
    Object.assign(e, { pending: false, auto: false, sent: text, sentAt: Date.now(), issue: '' });
    await airtableEmail(e, {
      [RF.suggested]: text,
      [RF.handled]: true,
      [RF.intent]: INTENT_LABEL[e.intent] || (vals ? 'Yes' : 'Unclear'),
      ...(vals ? { [RF.status]: 'Code sent', [RF.code]: vals.code, [RF.link]: vals.link, [RF.invite]: vals.invite, [RF.codeSentAt]: new Date().toISOString() } : {}),
    });
    toast(`Emailed ${emailWho(e)}${vals ? ` with their code ${vals.code}` : ''} ✓`);
    notifyReply(`Answered ${emailWho(e)}`, vals ? `Emailed their code ${vals.code} and how to set up.` : 'Your email went out.');
  } catch (err) {
    // A failed answer turns into a draft for you, so it can't keep retrying on its own.
    Object.assign(e, { pending: true, auto: false, draft: text, issue: errText(err) });
    await airtableEmail(e, { [RF.suggested]: text, [RF.handled]: false });
    toast(`Couldn't email ${emailWho(e)}: ${errText(err)}. It's waiting under Replies.`, 8000);
    notifyReply(`Couldn't answer ${emailWho(e)}`, `${errText(err)} It's waiting under Replies.`);
  } finally {
    e.sending = false;
    await saveEmails();
    syncBadge();
    refreshQuietly();
  }
}

function emailCard(e) {
  const st = S.settings;
  const box = h('textarea', { 'aria-label': `Email reply to ${emailWho(e)}`, oninput: (ev) => ((e.draft = ev.target.value), saveEmails()) }, e.draft || '');
  const go = (withCode) => {
    const text = box.value.trim();
    if (!text) return toast('Write the reply first.');
    e.draft = text;
    sendEmailNow(e, { text, withCode });
    render();
  };
  return h(
    'div',
    { class: 'card reply email', 'data-email': e.email },
    h(
      'div',
      { class: 'row-flex' },
      h('b', { class: 'grow' }, emailWho(e), ' ', h('span', { class: 'muted small' }, `${e.email}${e.lead.business && e.lead.business !== emailWho(e) ? ` · ${e.lead.business}` : ''}`)),
      h('span', { class: 'tag' }, 'email'),
      e.intent ? h('span', { class: `tag ${e.intent === 'yes' ? 'ok' : e.intent === 'no' ? 'bad' : 'warn'}` }, INTENT_LABEL[e.intent] || e.intent) : null,
      h('span', { class: 'muted small' }, ago(e.at)),
    ),
    e.subject ? h('p', { class: 'muted small' }, `Subject: ${e.subject}`) : null,
    h('div', { class: 'msg theirs' }, e.text),
    e.why ? h('p', { class: 'muted small why' }, e.why) : null,
    e.issue ? h('p', { class: 'status error' }, e.issue) : null,
    e.auto && e.sendAt
      ? h(
          'p',
          { class: 'status armed row-flex', 'data-auto': '' },
          h('span', { class: 'grow' }, `Goes out on its own ${e.sendAt > Date.now() ? `in ${countdown(e.sendAt - Date.now())}` : 'now'}, with ${e.partner ? `their code ${e.partner.code}` : 'their own code'}. Edit it below if you like.`),
          h('button', { class: 'link', onclick: () => ((e.sendAt = Date.now()), saveEmails(), dueEmails(), render()) }, 'Send now'),
          h('button', { class: 'link', onclick: () => ((e.auto = false), saveEmails(), render()) }, 'Hold for me'),
        )
      : null,
    box,
    h(
      'div',
      { class: 'row-flex' },
      h('button', { class: 'enter', onclick: () => go(false), disabled: !!e.sending }, 'Send'),
      h('button', { onclick: () => go(true), disabled: !!e.sending, title: e.partner ? `Their code is ${e.partner.code}` : 'Reserves their code on torreylabs.store and adds the invite to the email' }, e.partner ? 'Send + their code' : 'Send + a code'),
      e.issue && st.claude.key && !e.draft ? h('button', { class: 'link', id: 'email-retry', onclick: async () => (toast('Asking Claude again...'), await handleEmail(e), render()) }, 'Write it again') : null,
      h('span', { class: 'grow' }),
      h(
        'button',
        {
          class: 'link',
          onclick: async () => {
            Object.assign(e, { pending: false, auto: false, dismissed: true });
            await airtableEmail(e, { [RF.handled]: true });
            await saveEmails();
            syncBadge();
            render();
          },
        },
        'Mark handled',
      ),
    ),
    !st.mail.pass ? h('p', { class: 'muted small' }, 'Add the Gmail app password in Setup > Auto-reply to send from here.') : null,
  );
}

// Where every lead is on the way from "found" to "replied", one line, each stage a tap to its screen.
function pipelineCounts() {
  const todo = S.prospects.filter((p) => p.status === 'todo' && p.handle);
  const gate = S.settings.followGate;
  const waitingSort = (S.find?.found || []).filter((e) => {
    const v = S.findVerdicts[e.handle];
    return !v || !v.status || v.status === 'New';
  }).length;
  return {
    sort: waitingSort,
    follow: todo.filter((p) => p.airtableId && !p.followedAt).length,
    day: gate ? todo.filter((p) => p.airtableId && p.followedAt && !followedLongEnough(p)).length : 0,
    ready: todoList().length,
    sent: S.prospects.filter((p) => p.status === 'sent' && p.handle).length,
    replies: pendingAll(),
  };
}
function pipelineStrip() {
  const c = pipelineCounts();
  const go = (view, filter) => () => {
    S.view = view;
    if (filter) S.filter = filter;
    S.currentId = null;
    render();
  };
  const stages = [
    ['Waiting for the sort', c.sort, go('find'), 'Accounts Find saved that the daily sort has not looked at yet. It marks each Qualified or Skipped and adds the good ones to Leads.'],
    ['To follow', c.follow, go('follow'), 'Leads waiting to be followed, with two of their posts liked.'],
    ['Followed, waiting a day', c.day, go('leads', 'todo'), 'Followed, and about to become ready: a lead can be messaged a day after it was followed.'],
    ['Ready for a voice note', c.ready, go('leads', 'todo'), 'Leads you can record and send to now.'],
    ['Sent', c.sent, go('leads', 'sent'), 'Voice notes sent.'],
    ['Replies waiting', c.replies, go('replies'), 'Replies waiting on you.'],
  ];
  return h(
    'nav',
    { id: 'pipeline', class: 'pipeline' },
    stages.map(([label, n, onclick, title], i) => [i ? h('span', { class: 'arrow' }, '›') : null, h('button', { class: `stage ${n ? 'has' : ''}`, title, onclick }, h('b', {}, n), ' ', label)]),
  );
}
const paintPipeline = () => document.getElementById('pipeline')?.replaceWith(pipelineStrip());

// The strip under the tabs that shows what's sending in the background.
function queueStrip() {
  return h('div', { id: 'send-queue', class: 'queue', hidden: true });
}
function paintQueue() {
  const el = document.getElementById('send-queue');
  if (!el) return;
  const cur = S.bg.current;
  const waiting = S.bg.jobs.filter(isVoiceJob).length;
  const hold = !cur && S.bg.hold && waiting ? S.bg.hold : null;
  el.hidden = !cur && !hold;
  if (hold) {
    const when = hold.until - Date.now() > 12 * 3600e3 || hold.g.reason === 'day' || hold.g.reason === 'total' || hold.g.reason === 'window' ? `at ${clock(hold.until)}` : `in ${countdown(hold.until - Date.now())}`;
    return el.replaceChildren(
      h('span', { class: 'grow' }, h('b', {}, `Next voice note ${when}`), `: ${limits.reasonText(hold.g, 'dm')} · ${waiting} waiting`),
      h('button', { class: 'link', onclick: sendOneAnyway }, 'Send one now'),
    );
  }
  if (!cur) return el.replaceChildren();
  const left = cur.until ? ` · ${countdown(cur.until - Date.now())} left` : '';
  const queued = S.bg.jobs.filter((j) => !j.engage && !j.replycheck && !j.audit).length;
  const more = queued ? ` · ${queued} more queued` : '';
  const what = cur.check
    ? [h('b', {}, cur.handle ? `Checking @${cur.handle}'s chat` : 'Checking Instagram'), ' for replies...']
    : cur.audit
      ? [h('b', {}, `Checking @${cur.handle}'s chat`), ' for our voice note...']
    : cur.reply
      ? [h('b', {}, `Replying to @${cur.handle}`), '...']
      : cur.engage
        ? [h('b', {}, `Following @${cur.handle}`), ' and liking 2 posts (in the follow tab)...']
        : [h('b', {}, `Sending to @${cur.handle}`), ` ${cur.text.replace(/\s*\(\d+:\d+\)\.\.\.$/, '...')}`];
  el.replaceChildren(
    h('span', { class: 'grow' }, ...what, `${left}${more}`),
    h('button', { class: 'link', onclick: toggleWatch }, S.watchSend ? 'Hide' : 'Watch'),
  );
}
setInterval(() => (S.bg.current?.until || S.bg.hold) && paintQueue(), 1000);

function toggleWatch() {
  S.watchSend = !S.watchSend;
  showRightPane();
  paintQueue();
}

// Sends in the Instagram pane you can see, handing off to you if a step needs a click.
async function sendNow(p) {
  if (S.rec || S.sending) return;
  const g = voiceGate();
  if (!g.ok && !confirm(`Safety limit: ${limits.reasonText(g, 'dm')}. Send this one anyway?`)) return;
  const samples = await clipFor(p);
  if (!samples) return;
  stopPlay();
  const say = (text, state = 'working') => setSend(p.id, state, text);
  S.sending = p.id;
  delete p.sendIssue;
  render();
  try {
    const left = await deliver(p, samples, { target: 'dm', monitor: S.settings.monitorWatching, say });
    if (left === 'already') {
      say("Their chat already has our voice note, so it wasn't sent again. Marked sent.", 'done');
      toast(`@${p.handle} already had our voice note. Marked sent ✓`);
      S.sending = null;
      await setStatus(p, 'sent', { advance: S.currentId === p.id });
      return;
    }
    if (left) {
      say(HAND_OFF[left.split(':')[0]] || `${failText(left)}. Check the thread in Instagram, then Mark sent or try again.`, 'armed');
      window.api.showInstagram();
      return;
    }
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
    if (wasRemoved(inc)) continue;
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
      // Skipped here only because Airtable had moved on, and Airtable has it as a lead to do again.
      if (inc.source === 'airtable' && ex.status === 'skipped' && /^Airtable/.test(ex.skipNote || '')) {
        ex.status = 'todo';
        delete ex.skipNote;
      }
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

// Airtable statuses that mean the lead is no longer an Instagram to-do.
const AT_DONE = ['Skip', 'Error', 'Research failed', 'Bounced'];

// The pull only returns New / Researched / Ready leads. A lead Airtable has since skipped, emailed, errored or deleted
// never comes back, so this Mac's old copy would sit under Waiting for good. Look those up by id and move them to Skipped.
async function refreshStale(at, seen) {
  const stale = S.prospects.filter((p) => p.status === 'todo' && p.airtableId && !seen.has(p.airtableId));
  if (!stale.length) return 0;
  const { found, missing } = await window.api.pullAirtableByIds(at, stale.map((p) => p.airtableId));
  let moved = 0;
  const skip = (p, note) => {
    Object.assign(p, { status: 'skipped', sentAt: null, skipNote: note });
    delete p.isNew;
    moved++;
  };
  for (const inc of found) {
    const p = stale.find((x) => x.airtableId === inc.airtableId);
    if (!p) continue;
    Object.assign(p, { atStatus: inc.atStatus, channel: inc.channel, atSentAt: inc.atSentAt, track: inc.track });
    if (inc.followedAt) p.followedAt ||= inc.followedAt;
    if (inc.igLiked) p.igLiked = inc.igLiked;
    if (inc.atStatus === 'Skip' || inc.track === 'Skip') skip(p, `Airtable: Skip${inc.skipReason ? ` (${inc.skipReason})` : ''}`);
    else if (AT_DONE.includes(inc.atStatus)) skip(p, `Airtable: ${inc.atStatus}`);
    else if (leads.SENT_STATUSES.includes(inc.atStatus) && inc.channel !== 'Instagram')
      skip(p, `Airtable: ${inc.atStatus}${inc.channel ? ` by ${inc.channel}` : ''}`);
  }
  for (const id of missing) {
    const p = stale.find((x) => x.airtableId === id);
    if (p) skip(p, 'Airtable: lead was deleted');
  }
  await saveProspects();
  return moved;
}

// Airtable is the record of what went out. Leads it has down as sent by Instagram voice note come back under
// Sent here, so the list survives anything that happens to this Mac's copy. Only leads still to do move.
async function restoreSent(list) {
  let n = 0;
  const seen = new Set();
  for (const inc of list) {
    if (!leads.sentOnInstagram(inc) || wasRemoved(inc)) continue;
    const ex = S.prospects.find(
      (p) =>
        (inc.airtableId && p.airtableId === inc.airtableId) ||
        (inc.handle && p.handle && p.handle.toLowerCase() === inc.handle.toLowerCase()),
    );
    const when = leads.sentAtMs(inc.atSentAt);
    if (ex) {
      seen.add(ex.id);
      Object.assign(ex, { atStatus: inc.atStatus, channel: inc.channel, atSentAt: inc.atSentAt, igLiked: inc.igLiked });
      if (inc.followedAt) ex.followedAt ||= inc.followedAt;
      ex.airtableId ||= inc.airtableId;
      if (ex.status !== 'todo') continue;
      Object.assign(ex, { status: 'sent', sentAt: when || ex.sentAt || Date.now(), sentBy: 'airtable' });
      delete ex.sendIssue;
      delete ex.isNew;
    } else {
      Object.assign(inc, { status: 'sent', sentAt: when || Date.now(), sentBy: 'airtable' });
      S.prospects.push(inc);
      seen.add(inc.id);
    }
    n++;
  }
  // A lead that only Airtable had as sent goes back to to-do when Airtable no longer has it that way.
  let back = 0;
  for (const p of S.prospects) {
    if (p.sentBy !== 'airtable' || p.status !== 'sent' || seen.has(p.id)) continue;
    Object.assign(p, { status: 'todo', sentAt: null });
    delete p.sentBy;
    back++;
  }
  if (n || back) {
    await saveProspects();
    paintSentToday();
  }
  return n;
}

// Leads sent here that Airtable still has as Ready: Airtable has no record of the note going out.
const readyButSent = () => S.prospects.filter((p) => p.status === 'sent' && p.airtableId && p.atStatus === 'Ready');
async function unsendReady() {
  for (const p of readyButSent()) {
    Object.assign(p, { status: 'todo', sentAt: null });
    delete p.sentBy;
  }
  await saveProspects();
  render();
}

// Errors that already name Airtable don't need the prefix.
const atError = (m) => (/^airtable\b/i.test(m) ? m : `Airtable: ${m}`);

function syncText() {
  if (!S.settings.airtable.token) return 'Airtable not connected.';
  if (S.sync.running) return 'Checking Airtable for new leads...';
  if (S.sync.error) return atError(S.sync.error);
  if (!S.sync.at) return 'Not synced yet.';
  const min = Math.round((Date.now() - S.sync.at) / 60000);
  const n = newCount();
  const got = S.sync.pulled === 0 ? ' · Airtable sent 0 leads (check the formula in Setup)' : S.sync.pulled ? ` · ${S.sync.pulled} leads from Airtable` : '';
  return `Synced ${min < 1 ? 'just now' : `${min} min ago`}${got}${n ? ` · ${n} new` : ''}`;
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
    const pulled = await window.api.pullAirtable(at);
    S.sync.pulled = pulled.length;
    const { added } = await merge(pulled, { markNew: !firstPull });
    let restored = 0;
    let moved = 0;
    let sentIssue = '';
    const seen = new Set(pulled.map((p) => p.airtableId));
    try {
      const sentList = await window.api.pullSentAirtable(at);
      for (const p of sentList) seen.add(p.airtableId);
      restored = await restoreSent(sentList);
    } catch (e) {
      sentIssue = errText(e);
    }
    try {
      moved = await refreshStale(at, seen);
    } catch (e) {
      sentIssue ||= errText(e);
    }
    S.sync.at = Date.now();
    S.sync.error = '';
    const todo = S.prospects.filter((p) => p.status === 'todo');
    const ready = todo.filter(shown).length;
    if (!quiet)
      toast(`Synced ${pulled.length} leads from Airtable (${added} new${restored ? `, ${restored} back under Sent` : ''}${moved ? `, ${moved} moved to Skipped because Airtable skipped or emailed them` : ''}). ${ready} ready to send, ${todo.length - ready} waiting.`, 6000);
    if (sentIssue && !quiet) toast(`Couldn't read Airtable's sent leads: ${sentIssue}`, 8000);
  } catch (e) {
    S.sync.error = errText(e);
    if (!quiet) toast(atError(S.sync.error), 8000);
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

// ---------- Safety limits ----------
// When the account started this (its first voice note sent from the app, or today), for the warm-up.
function startedAt() {
  const times = S.prospects.filter((p) => p.sentAt && p.sentBy !== 'airtable' && p.sentBy !== 'conversation').map((p) => p.sentAt);
  return times.length ? Math.min(...times) : Date.now();
}
// When each voice note went out, over the last day or so (sent from the app, or marked sent by hand).
const voiceTimes = () => S.prospects.filter((p) => p.status === 'sent' && p.sentBy !== 'conversation' && p.sentAt > Date.now() - 26 * 3600e3).map((p) => p.sentAt);
const capsNow = () => limits.caps(S.settings.limits, Date.now(), startedAt(), { fast: S.fast });
// Whether a voice note can go out now; the follow tab's counts come along for the combined limit.
function voiceGate() {
  const f = S.follow?.times || {};
  return limits.gate('dm', { dm: voiceTimes(), follow: f.follow || [], like: f.like || [] }, capsNow(), Date.now());
}
let lastVoicePush = '';
function pushVoiceTimes() {
  const t = voiceTimes();
  const key = t.join(',');
  if (key === lastVoicePush) return;
  lastVoicePush = key;
  window.api.voiceTimes(t).catch(() => {});
}

// Setup > Safety limits: the account's age sets the caps; any daily cap can be set lower; the warm-up and the
// daytime window for voice notes can be turned off. Shows what's been done today against each cap.
function limitsCard() {
  const lim = S.settings.limits;
  const c = capsNow();
  const L = limits.LEVELS[c.level];
  const f = S.follow || {};
  const done = { dm: sentToday(), follow: f.today || 0, like: f.likesToday || 0 };
  const save = () => {
    saveSettings().then(flashSaved);
    paintSentToday();
    const el = document.getElementById('limits-card');
    if (el) el.replaceWith(limitsCard());
    runQueue();
  };
  const customField = (k, label) =>
    h(
      'label',
      { class: 'field' },
      `${label} (the most is ${L[k]})`,
      h('input', {
        type: 'number',
        min: 1,
        max: L[k],
        placeholder: String(L[k]),
        value: lim.custom[k],
        onchange: (e) => ((lim.custom[k] = e.target.value ? Math.min(L[k], Math.max(1, parseInt(e.target.value, 10) || 1)) : ''), save()),
      }),
    );
  const row = (what, k, hour, extra = '') => h('div', { class: 'log-row' }, h('b', { class: 'small' }, what), h('span', { class: 'small' }, `${done[k]} of ${c[k]} today · at most ${hour} an hour${extra}`));
  return h(
    'div',
    { class: 'card', id: 'limits-card' },
    h('p', { class: 'muted small' }, "Instagram doesn't publish its limits, so these stay well under what accounts doing outreach report getting flagged for. Nothing is lost at a cap: queued voice notes wait and following picks up again."),
    h(
      'label',
      { class: 'field' },
      'How old is the Instagram account?',
      h(
        'select',
        { onchange: (e) => ((lim.level = e.target.value), save()) },
        Object.entries(limits.LEVELS).map(([k, v]) => h('option', { value: k, selected: k === c.level }, v.label)),
      ),
    ),
    row('Voice notes', 'dm', c.dmHour, `, ${Math.round(c.dmGapMs / 60000)}+ min apart${c.window?.on ? `, ${hourText(c.window.from)} to ${hourText(c.window.to)}` : ''}`),
    row('Follows', 'follow', c.followHour),
    row('Likes', 'like', c.likeHour),
    h('div', { class: 'log-row' }, h('b', { class: 'small' }, 'All together'), h('span', { class: 'small' }, `${done.dm + done.follow + done.like} of ${c.total} today`)),
    c.ramp < 1 ? h('p', { class: 'small' }, `Warming up: day ${c.days + 1} of 10, so today's caps are ${Math.round(c.ramp * 100)}% of the full ones (${L.dm} voice notes, ${L.follow} follows, ${L.like} likes).`) : null,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: lim.ramp !== false, onchange: (e) => ((lim.ramp = e.target.checked), save()) }), 'Warm up: start at about a third of the caps and build to the full ones over 10 days'),
    h(
      'label',
      { class: 'check' },
      h('input', { type: 'checkbox', checked: lim.window.on, onchange: (e) => ((lim.window.on = e.target.checked), save()) }),
      `Only send voice notes during the day (Pacific), from `,
      h('input', { type: 'number', min: 0, max: 23, value: lim.window.from, class: 'hour-input', onchange: (e) => ((lim.window.from = Math.min(22, Math.max(0, parseInt(e.target.value, 10) || 0))), save()) }),
      ' to ',
      h('input', { type: 'number', min: 1, max: 24, value: lim.window.to, class: 'hour-input', onchange: (e) => ((lim.window.to = Math.min(24, Math.max(lim.window.from + 1, parseInt(e.target.value, 10) || 20))), save()) }),
      ' (24-hour clock)',
    ),
    h('p', { class: 'small' }, 'Lower a daily cap (blank keeps the one for the account age):'),
    h('div', { class: 'grid2' }, customField('dm', 'Voice notes a day'), customField('like', 'Likes a day')),
    more('Good to know', h('p', { class: 'muted small' }, "Voice notes, follows and likes each have a daily and an hourly cap, the three share a combined daily cap, and a new setup warms up over its first 10 days. Follows a day is also set on the Follow screen; the lower of the two applies. Replies to people who wrote back aren't counted: they're conversations, not outreach. If Instagram ever shows \"action blocked\" or \"try again later\", following and liking stop for 48 hours on their own; pause the voice notes too and start again at about half.")),
  );
}
const hourText = (hr) => new Date(2000, 0, 1, hr % 24).toLocaleTimeString([], { hour: 'numeric' });

// Voice notes sent since midnight on this Mac, counting ones you marked sent by hand.
function sentToday() {
  const midnight = new Date().setHours(0, 0, 0, 0);
  return S.prospects.filter((p) => p.status === 'sent' && p.sentBy !== 'conversation' && p.sentAt >= midnight).length;
}

function sentBadge() {
  const n = sentToday();
  const cap = S.settings ? capsNow().dm : 0;
  return h('span', { id: 'sent-today', class: 'badge sent', title: `${n} voice note${n === 1 ? '' : 's'} sent today${cap ? ` (today's safe limit: ${cap})` : ''}` }, cap ? `✓ ${n}/${cap}` : `✓ ${n}`);
}

// In place, so a background send never interrupts recording or typing.
const paintSentToday = () => document.getElementById('sent-today')?.replaceWith(sentBadge());

async function markSent(p) {
  p.status = 'sent';
  p.sentAt = Date.now();
  delete p.sendIssue;
  await saveProspects();
  paintSentToday();
  pushVoiceTimes();
  queueEngage(p);
  const at = S.settings.airtable;
  if (at.writeBack && at.token && p.airtableId) {
    window.api.markSent(at, p.airtableId).then(
      () => {
        // Airtable now has it as Sent; the next sync would say so too.
        p.atStatus = 'Sent';
        saveProspects();
      },
      (e) => toast(`Marked sent here, but Airtable said: ${errText(e)}`, 8000),
    );
  }
}

async function setStatus(p, status, { advance = true } = {}) {
  if (status === 'sent') await markSent(p);
  else {
    p.status = status;
    p.sentAt = null;
    if (status !== 'skipped') delete p.skipNote;
    await saveProspects();
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

// Leads removed here, by Airtable record and by handle, so a sync (or Google Maps finding the place again) doesn't
// bring them back into the app.
const saveRemoved = () => store.put('kv', 'removed', S.removed);
const wasRemoved = (p) => (p.airtableId && S.removed.ids.includes(p.airtableId)) || (p.handle && S.removed.handles.includes(p.handle.toLowerCase()));

// Takes a lead out of the app and out of Airtable: its record is deleted there, or marked Skip, as Setup says.
async function removeLead(p) {
  const at = S.settings.airtable;
  const inAirtable = !!(p.airtableId && at.token);
  const skip = S.settings.removeMode === 'skip';
  const who = p.name || (p.handle ? `@${p.handle}` : 'this lead');
  const what = !inAirtable ? 'It is only in this app.' : skip ? 'It stays in Airtable, marked Skip, so nothing messages it again.' : 'Its record is deleted from Airtable.';
  if (!confirm(`Remove ${who}? ${what}`)) return;
  if (inAirtable) {
    try {
      await window.api.removeAirtable(at, p.airtableId, { mode: skip ? 'skip' : 'delete', reason: p.sendIssue || '' });
    } catch (e) {
      return toast(`Didn't remove ${who}: Airtable said ${errText(e)}`, 8000);
    }
  }
  for (const seg of S.template) await delAudio(slotKey(p, seg));
  if (p.airtableId) S.removed.ids.push(p.airtableId);
  if (p.handle) S.removed.handles.push(p.handle.toLowerCase());
  await saveRemoved();
  const next = S.currentId === p.id ? nextTodo(p.id) : null;
  S.prospects = S.prospects.filter((x) => x.id !== p.id);
  await saveProspects();
  paintSentToday();
  toast(`Removed ${who}${inAirtable ? (skip ? ' (marked Skip in Airtable)' : ' (deleted from Airtable)') : ''}.`);
  if (S.currentId === p.id) {
    if (next) return openLead(next.id);
    S.currentId = null;
  }
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
      h('button', { class: `tab ${S.view === 'leads' ? 'on' : ''}`, onclick: leadsTab }, 'Leads', h('span', { id: 'new-badge', class: 'badge', hidden: !n }, n), sentBadge()),
      h(
        'button',
        { class: `tab ${S.view === 'follow' ? 'on' : ''}`, onclick: () => ((S.view = 'follow'), render()) },
        'Follow',
        h('span', { id: 'follow-dot', class: `dot ${followDot()}` }),
      ),
      h(
        'button',
        { class: `tab ${S.view === 'find' ? 'on' : ''}`, onclick: () => ((S.view = 'find'), render(), refreshVerdicts(true)) },
        'Find',
        h('span', { id: 'find-dot', class: `dot ${findDot()}` }),
      ),
      h(
        'button',
        { class: `tab ${S.view === 'replies' ? 'on' : ''}`, onclick: () => ((S.view = 'replies'), render()) },
        'Replies',
        h('span', { id: 'reply-badge', class: 'badge', hidden: !pendingAll() }, pendingAll()),
      ),
      h('button', { class: `tab ${S.view === 'setup' ? 'on' : ''}`, onclick: goSetup }, 'Setup'),
    ),
  );
}

// How many to-do leads ready to send have their intro in.
function introCount() {
  if (!slots().length || (S.filter !== 'todo' && S.filter !== 'all')) return null;
  const todo = todoList();
  if (!todo.length) return null;
  const done = todo.filter((p) => ['recorded', 'auto'].includes(introState(p))).length;
  return h('p', { id: 'intro-count', class: 'muted small' }, `Intros in: ${done} of ${todo.length} ready to send${done < todo.length ? ` · ${todo.length - done} still need one` : ''}`);
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
  const waiting = S.prospects.filter((p) => p.status === 'todo' && !shown(p)).sort(byWaitOrder);
  const showWaiting = S.filter === 'todo' || S.filter === 'all';
  const notReady = waiting.filter((p) => !researched(p)).length;
  const gate = S.settings.followGate;
  const notFollowed = gate ? waiting.filter((p) => p.airtableId && !p.followedAt).length : 0;
  const followedToday = gate ? waiting.filter((p) => p.airtableId && p.followedAt && !followedLongEnough(p)).length : 0;
  // Leads that only the follow wait is holding back.
  const gated = gate ? waiting.filter((p) => researched(p) && !followedLongEnough(p)).length : 0;
  const stale = ttsReady() ? staleVoiced() : [];
  const unsure = readyButSent();
  const failedSends = S.prospects.filter((p) => p.status === 'todo' && p.sendIssue && p.handle);

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
    failedSends.length
      ? h(
          'div',
          { class: 'card row-flex', id: 'failed-sends' },
          h('span', { class: 'grow small' }, `${failedSends.length} lead${failedSends.length === 1 ? ' says' : 's say'} "send failed". Some of those notes may have gone out anyway: the app can look in each one's chat and mark it sent if our voice note is there.`),
          h('button', { onclick: () => checkFailedSends({ manual: true }), disabled: S.bg.jobs.some((j) => j.audit) || !!S.bg.current?.audit }, 'Check them on Instagram'),
        )
      : null,
    unsure.length
      ? h(
          'div',
          { class: 'card row-flex', id: 'unsure-sent' },
          h('span', { class: 'grow small' }, `${unsure.length} lead${unsure.length === 1 ? '' : 's'} under Sent ${unsure.length === 1 ? 'is' : 'are'} still Ready in Airtable, so Airtable has no record of the note going out.`),
          h('button', { onclick: unsendReady }, unsure.length === 1 ? 'Move it back to to-do' : 'Move them back to to-do'),
        )
      : null,
    stale.length
      ? h(
          'div',
          { class: 'card row-flex', id: 'revoice' },
          h('span', { class: 'grow small' }, `${stale.length} auto-voiced line${stale.length === 1 ? ' still says' : 's still say'} the old wording.`),
          h('button', { onclick: revoiceAll, disabled: !!S.busy }, `Re-voice ${stale.length === 1 ? 'it' : `all ${stale.length}`}`),
        )
      : null,
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
    introCount(),
    list.length
      ? h('div', { class: 'list' }, list.map(leadRow))
      : h(
          'p',
          { class: 'muted' },
          waiting.length && showWaiting
            ? 'Nothing ready to send yet. Your leads are below, with what each one is waiting on.'
            : S.prospects.length
              ? 'Nothing here.'
              : 'No leads yet. Connect Airtable in Setup, import a CSV, or open a profile in Instagram on the right and hit Grab from IG.',
        ),
    showWaiting && waiting.length
      ? [
          h('h2', { id: 'waiting-head' }, `Waiting (${waiting.length})`),
          h(
            'p',
            { id: 'hidden-line', class: 'muted small' },
            [
              notFollowed ? `${notFollowed} not followed yet` : '',
              followedToday ? `${followedToday} followed less than a day ago` : '',
              notReady ? `${notReady} not marked Ready in Airtable` : '',
            ]
              .filter(Boolean)
              .join(' · '),
            '. ',
            notFollowed || followedToday ? 'DMs go out a day after the app follows a lead.' : '',
          ),
          notFollowed ? followHint() : null,
          gated
            ? h(
                'p',
                {},
                h('button', { id: 'skip-gate', onclick: skipGate }, `Send to ${gated} Ready lead${gated === 1 ? '' : 's'} now (skip the follow wait)`),
              )
            : null,
          h('div', { class: 'list', id: 'waiting-list' }, waiting.slice(0, WAIT_SHOWN).map(waitRow)),
          waiting.length > WAIT_SHOWN ? h('p', { class: 'muted small' }, `...and ${waiting.length - WAIT_SHOWN} more.`) : null,
        ]
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

const WAIT_SHOWN = 60;

// What a lead is waiting on before it can be messaged.
function waitReasons(p) {
  const out = [];
  if (S.settings.followGate && p.airtableId) {
    if (!p.followedAt) out.push(['not followed yet', 'warn']);
    else if (!followedLongEnough(p)) {
      const hrs = Math.ceil((Date.parse(p.followedAt) + DAY_MS - Date.now()) / 3600e3);
      out.push([`followed · DM in ${hrs <= 1 ? 'under 1h' : `${hrs}h`}`, '']);
    }
  }
  if (!researched(p)) out.push([`status: ${p.atStatus || 'none'}`, '']);
  return out;
}

// Ready leads first, then followed ones, soonest to be messageable first.
const waitRank = (p) => (researched(p) ? 0 : 2) + (p.followedAt ? 0 : 1);
const byWaitOrder = (a, b) => waitRank(a) - waitRank(b) || (Date.parse(a.followedAt) || 0) - (Date.parse(b.followedAt) || 0);

function waitRow(p) {
  return h(
    'div',
    { class: 'lead static wait' },
    h(
      'div',
      { class: 'who' },
      h('span', {}, h('b', {}, p.name || '(no name)')),
      h('span', { class: 'muted small' }, [p.handle ? `@${p.handle}` : 'no handle', p.role, p.business !== p.name ? p.business : ''].filter(Boolean).join(' · ')),
    ),
    waitReasons(p).map(([text, cls]) => h('span', { class: `tag ${cls}` }, text)),
  );
}

// Whether a lead's custom intro is in: 'none' (not yet), 'old' (made with older wording), 'auto' (auto-voiced)
// or 'recorded' (your mic). null when the voice note has no per-lead line.
function introState(p) {
  const segs = slots();
  if (!segs.length) return null;
  const keys = segs.map((seg) => slotKey(p, seg));
  if (keys.some((k) => !S.lens[k])) return 'none';
  if (segs.some((seg) => outdated(p, seg))) return 'old';
  return keys.every((k) => S.said?.[k]?.by === 'tts') ? 'auto' : 'recorded';
}
const INTRO_TAG = {
  none: ['tag warn', 'no intro yet'],
  old: ['tag warn', 'intro: old wording'],
  auto: ['tag ok', '✓ intro (auto-voiced)'],
  recorded: ['tag ok', '✓ intro recorded'],
};
function introTag(p) {
  const st = introState(p);
  return st ? h('span', { class: `${INTRO_TAG[st][0]} intro-tag`, 'data-intro': st }, INTRO_TAG[st][1]) : null;
}

const leadIntroTag = (p) => {
  const tag = introTag(p);
  if (tag) tag.id = 'lead-intro';
  return tag;
};

function leadRow(p) {
  let pill;
  if (p.reply?.pending) pill = h('span', { class: 'tag warn' }, 'replied');
  else if (p.partner) pill = h('span', { class: 'tag ok' }, 'code sent');
  else if (p.status === 'sent') pill = h('span', { class: 'tag ok' }, 'sent');
  else if (p.status === 'sending') pill = h('span', { class: 'tag' }, 'sending...');
  else if (p.sendIssue) pill = h('span', { class: 'tag bad', title: p.sendIssue }, 'send failed');
  else if (p.status === 'skipped') pill = h('span', { class: 'tag' }, 'skipped');
  // To do: the row says whether their custom intro is in.
  const intro = p.status === 'todo' ? introTag(p) : null;
  return h(
    'button',
    { class: 'lead', onclick: () => openLead(p.id) },
    h(
      'div',
      { class: 'who' },
      h('span', {}, h('b', {}, p.name || '(no name)')),
      h('span', { class: 'muted small' }, [p.handle ? `@${p.handle}` : 'no handle', p.role, p.business !== p.name ? p.business : '', p.status === 'skipped' ? clipText(p.skipNote, 70) : ''].filter(Boolean).join(' · ')),
    ),
    p.isNew ? h('span', { class: 'tag new' }, 'new') : null,
    intro,
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
    /\{(name|first)\}/.test(seg.script || '')
      ? h(
          'p',
          { class: 'muted small', 'data-namehint': '', hidden: !!personName(p) },
          'No first name on file, so it opens with "Hey there". Know it? Add it under Edit details > Name to say.',
        )
      : null,
    meter(key),
    h(
      'div',
      { class: 'row-flex' },
      recButton(key),
      playButton(key, 'Play', () => getAudio(key), { disabled: !len || live }),
      ttsReady() ? h('button', { onclick: () => autoVoiceOne(p, seg), disabled: !!S.busy || !!S.rec || !!S.sending }, outdated(p, seg) ? 'Re-voice' : 'Auto-voice') : null,
      h('span', { class: 'grow' }),
      lineTag(p, seg),
    ),
  );
}

function lineTag(p, seg) {
  const len = S.lens[slotKey(p, seg)];
  const id = `tag-${seg.id}`;
  if (!len) return h('span', { id, class: 'tag warn' }, 'not recorded');
  if (outdated(p, seg)) return h('span', { id, class: 'tag warn', title: `Says: "${S.said[slotKey(p, seg)].text}"` }, `old wording · ${secs(len)}`);
  return h('span', { id, class: 'tag ok' }, `✓ ${secs(len)}`);
}

function handleTag(p) {
  return p.handle
    ? h('button', { id: 'lead-handle', class: 'link', title: 'Open their profile in Instagram', onclick: () => window.api.openProfile(p.handle).catch(() => {}) }, `@${p.handle}`)
    : h('span', { id: 'lead-handle', class: 'tag warn' }, 'no Instagram');
}

const whoText = (p) => [p.role, p.business && p.business !== p.name ? p.business : ''].filter(Boolean).join(' at ');

function sendButton(p) {
  const sending = S.sending === p.id || p.status === 'sending';
  const blocked = !!missingParts(p).length || !!S.rec || !!S.sending;
  return h(
    'button',
    { id: 'send-btn', class: 'enter', onclick: () => sendLead(p), disabled: blocked || !p.handle || p.status === 'sending' },
    sending ? 'Sending...' : p.handle ? `Send to @${p.handle}` : 'Add their Instagram to send',
    sending ? null : h('span', {}, '⌘ Enter'),
  );
}

// Brings the top of a lead's page, its script lines and the Send button up to date without redrawing the
// page, so the field you're typing in keeps the keyboard.
function paintLead(p) {
  const swap = (id, el) => document.getElementById(id)?.replaceWith(el);
  const name = document.getElementById('lead-name');
  if (name) name.textContent = p.name || '(no name)';
  swap('lead-handle', handleTag(p));
  const who = document.getElementById('lead-who');
  if (who) {
    who.textContent = whoText(p);
    who.hidden = !who.textContent;
  }
  swap('send-btn', sendButton(p));
  for (const el of document.querySelectorAll('[data-seg]')) {
    const seg = S.template.find((s) => s.id === el.dataset.seg);
    el.textContent = renderScript(seg.script, p);
    swap(`tag-${seg.id}`, lineTag(p, seg));
  }
  if (p.status === 'todo') swap('lead-intro', leadIntroTag(p));
  for (const el of document.querySelectorAll('[data-namehint]')) el.hidden = !!personName(p);
}

// Once you stop typing an Instagram handle, opens that profile on the right and fills in what's empty.
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
let handleTimer = null;
function openTypedHandle(p) {
  clearTimeout(handleTimer);
  if (!HANDLE_RE.test(p.handle)) return;
  handleTimer = setTimeout(async () => {
    const handle = p.handle;
    const dupe = S.prospects.find((x) => x !== p && x.handle.toLowerCase() === handle.toLowerCase());
    if (dupe) toast(`@${handle} is already a lead (${dupe.name || 'no name'}).`, 6000);
    try {
      await window.api.openProfile(handle);
      const info = await window.api.grab();
      if (p.handle !== handle || info?.handle?.toLowerCase() !== handle.toLowerCase()) return;
      // Only fills blanks, and only ones you haven't typed in yourself.
      let filled = false;
      if (!p.business && !p.edited?.business && info.displayName) {
        p.business = info.displayName;
        const input = document.querySelector('input[data-k="business"]');
        if (input && document.activeElement !== input) input.value = p.business;
        filled = true;
      }
      if (!p.bio && info.bio) {
        p.bio = info.bio;
        filled = true;
      }
      if (filled) {
        await saveProspects();
        if (S.currentId === p.id) paintLead(p);
      }
    } catch {}
  }, 700);
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
    paintLead(p);
    if (k === 'handle') openTypedHandle(p);
  };
  const ref = [
    ['Category', p.category],
    ['IG bio', p.bio],
    ['Research', p.research],
    ['Notes', p.notes],
  ].filter(([, v]) => v);
  const missing = missingParts(p);
  const sendStatus = S.send.pid === p.id ? S.send : { state: '', text: '' };
  const sending = S.sending === p.id;
  const blocked = !!missing.length || !!S.rec || !!S.sending;
  const who = whoText(p);

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
        h('b', { id: 'lead-name' }, p.name || '(no name)'),
        handleTag(p),
        p.status === 'todo' ? leadIntroTag(p) : null,
      ),
      h('p', { id: 'lead-who', class: 'muted', hidden: !who }, who),
      p.reply
        ? h(
            'p',
            { class: 'small' },
            h('b', {}, p.reply.pending ? 'Replied, waiting on you: ' : 'Replied: '),
            `“${p.reply.text.slice(0, 140)}${p.reply.text.length > 140 ? '…' : ''}” `,
            h('button', { class: 'link', onclick: () => ((S.view = 'replies'), render()) }, 'Open Replies'),
          )
        : null,
      p.partner ? h('p', { class: 'muted small' }, `Partner code ${p.partner.code} · ${p.partner.link}`) : null,
      h(
        'details',
        { class: 'ref' },
        h('summary', {}, 'Edit details'),
        h(
          'div',
          { class: 'edit' },
          h('div', { class: 'grid2' }, field('Name to say', p.name, edit('name')), field('Role', p.role, edit('role'), { placeholder: 'e.g. owner, head coach' })),
          h('div', { class: 'grid2' }, field('Business', p.business, edit('business'), { 'data-k': 'business' }), field('Instagram', p.handle, edit('handle'), { placeholder: 'handle or profile link' })),
          field('Personal hook (one real thing about them)', p.hook, edit('hook'), { placeholder: 'e.g. runs HYROX prep classes' }),
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
    missing.length ? null : joinPanel(p),

    step('3', 'Send'),
    sendButton(p),
    S.settings.autoSend && p.status === 'todo'
      ? h(
          'p',
          { class: 'muted small row-flex' },
          h('span', { class: 'grow' }, 'Sends in the background, silently, and opens your next lead right away.'),
          h('button', { onclick: () => sendNow(p), disabled: blocked, title: 'Runs the send in the Instagram pane on the right, so you can see each step' }, 'Send while watching'),
        )
      : null,
    p.sendIssue && p.status === 'todo'
      ? h(
          'p',
          { class: 'status error' },
          `The last send didn't go through: ${p.sendIssue}. Press Send to try again, or `,
          h('button', { class: 'link', onclick: () => sendNow(p), disabled: blocked }, 'send while watching'),
          ' to do it in the Instagram pane.',
          p.sendShot ? [' ', h('button', { class: 'link', onclick: () => window.api.revealShot(p.sendShot) }, 'See what Instagram showed')] : null,
          ' Page broken or account gone? ',
          h('button', { class: 'link', onclick: () => removeLead(p) }, 'Remove this lead'),
        )
      : null,
    h('p', { id: 'send-status', class: `status ${sendStatus.state}`, hidden: !sendStatus.text }, sendStatus.text),
    p.status === 'todo'
      ? h(
          'div',
          { class: 'row-flex small' },
          h('button', { class: 'link', onclick: () => setStatus(p, 'sent'), disabled: sending }, 'Mark sent'),
          h('button', { class: 'link', onclick: () => setStatus(p, 'skipped'), disabled: sending }, 'Skip'),
          h('button', { class: 'link', onclick: () => saveFile(p), disabled: !!missing.length }, 'Save as file'),
          h('span', { class: 'grow' }),
          h('button', { class: 'link bad', onclick: () => removeLead(p), disabled: sending, title: S.settings.removeMode === 'skip' ? 'Takes it out of the app and marks it Skip in Airtable' : 'Takes it out of the app and deletes it from Airtable' }, 'Remove lead'),
        )
      : h(
          'div',
          { class: 'row-flex' },
          h('span', { class: 'tag' }, p.status === 'sending' ? 'sending in the background' : p.status),
          p.status === 'sending' ? null : h('button', { onclick: () => setStatus(p, 'todo') }, 'Move back to to-do'),
          h('span', { class: 'grow' }),
          h('button', { class: 'link bad', onclick: () => removeLead(p), title: S.settings.removeMode === 'skip' ? 'Takes it out of the app and marks it Skip in Airtable' : 'Takes it out of the app and deletes it from Airtable' }, 'Remove lead'),
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
      : [
          h('label', { class: 'field' }, 'What you say (per lead)', h('input', { value: seg.script, placeholder: 'Hey {name}!', oninput: (e) => ((seg.script = e.target.value), saveTemplate().then(flashSaved)) })),
          /\{(kind|detail|crowd)\}/.test(seg.script || '')
            ? h(
                'p',
                { class: 'muted small' },
                '{kind} is their kind of business, from Category ("recovery studio", "gym"). {detail} is the first point of their Personal hook from Airtable, said to them ("saw you run HYROX prep"). {crowd} is who they are ("trainers", "gym owners").',
              )
            : null,
        ],
  );
}

// Which breath the join uses, with a way to hear it and pick another.
async function paintBreath() {
  const el = document.getElementById('breath-info');
  const seg = S.template.find((s, i) => s.kind === 'fixed' && S.template[i - 1]?.kind === 'slot');
  if (!el) return;
  if (!S.settings.breath || !seg || !S.lens[fixedKey(seg)]) return el.replaceChildren();
  const list = await breathsIn(seg);
  if (!list.length) {
    return el.replaceChildren(
      h('span', { class: 'muted' }, "No clear breath found in your pitch. Record your own under Listen on any lead's page, or re-record the pitch with a natural breath between sentences."),
    );
  }
  const n = S.settings.breathPick % list.length;
  const b = list[n];
  el.replaceChildren(
    h('span', { class: 'grow muted' }, `Using a ${b.seconds.toFixed(1)}s breath from ${secs(b.at)} into your pitch (${n + 1} of ${list.length}).`),
    playButton('breath', 'Play it', async () => (await breathBefore(seg))?.clip),
    list.length > 1
      ? h(
          'button',
          {
            onclick: () => {
              S.settings.breathPick = (n + 1) % list.length;
              stopPlay();
              saveSettings().then(flashSaved);
              paintBreath();
              if (document.getElementById('join-panel')) paintJoin(current());
            },
          },
          'Try another',
        )
      : null,
  );
}

// The join between the intro and the pitch, with the knobs to tune it by ear and a readout of what the app
// measured. Lives under Listen so a join that sounds off can be fixed without leaving the lead.
function joinPanel(p) {
  const st = S.settings;
  const changed = () => {
    stopPlay();
    saveSettings().then(flashSaved);
    paintJoin(p);
  };
  const check = (k, label) =>
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st[k], onchange: (e) => ((st[k] = e.target.checked), k === 'breath' && paintBreath(), changed()) }), label);
  const msSlider = (k, label, min, max, step) => anySlider(k, label, min, max, step, (v) => `${v} ms`);
  const dbSlider = (k, label, min, max, step) => anySlider(k, label, min, max, step, (v) => `${v > 0 ? '+' : ''}${v} dB`);
  const anySlider = (k, label, min, max, step, show) => {
    const out = h('span', { class: 'tag', 'data-out': k }, show(st[k]));
    return h(
      'div',
      { class: 'slider' },
      h('div', { class: 'row-flex' }, h('span', { class: 'grow' }, label), out),
      h('input', {
        type: 'range',
        min,
        max,
        step,
        value: st[k],
        'aria-label': label,
        oninput: (e) => ((st[k] = Number(e.target.value)), (out.textContent = show(st[k]))),
        onchange: changed,
      }),
    );
  };
  return h(
    'div',
    { class: 'card join', id: 'join-panel' },
    h(
      'div',
      { class: 'row-flex' },
      h('b', { class: 'grow' }, 'The join into the pitch'),
      playButton(`join:${p.id}`, '▶ Play just the join', () => joinClip(p), { disabled: !!S.rec || !!S.sending }, '■ Stop'),
    ),
    h('div', { id: 'join-readout', class: 'muted small' }, 'Measuring...'),
    check('matchLevels', "Match the intro to the pitch's volume"),
    dbSlider('introDb', 'Intro volume trim', -6, 6, 0.5),
    check('toneMatch', "Match the intro's tone to the pitch (EQ)"),
    check('breath', 'A breath between the intro and the pitch'),
    h('div', { id: 'breath-info', class: 'row-flex small' }),
    myBreathRow(),
    dbSlider('breathDb', 'Breath volume', -12, 12, 1),
    msSlider('gapMs', 'Pause between the intro and the pitch', 0, 1500, 50),
  );
}

// Record your own breath: one take, kept until you redo it. Used when the pitch has no breath to lend, or when
// you pick it.
function myBreathRow() {
  const st = S.settings;
  const have = !!S.lens[MY_BREATH];
  const pick = (v) => () => {
    st.breathSource = v;
    stopPlay();
    saveSettings().then(flashSaved);
    paintJoin(current());
  };
  return h(
    'div',
    { id: 'my-breath', class: 'row-flex small' },
    h('span', { class: 'muted' }, have ? `Your recorded breath (${secs(S.lens[MY_BREATH])})` : "Or record your own: press, breathe in like you're about to speak, press again."),
    recButton(MY_BREATH, 'Record a breath'),
    have ? playButton(MY_BREATH, 'Play', async () => (await myBreath())?.clip, { class: 'icon' }) : null,
    have
      ? h(
          'label',
          { class: 'check inline' },
          h('input', { type: 'radio', name: 'breath-source', checked: st.breathSource !== 'mine', onchange: pick('auto') }),
          "the pitch's",
        )
      : null,
    have ? h('label', { class: 'check inline' }, h('input', { type: 'radio', name: 'breath-source', checked: st.breathSource === 'mine', onchange: pick('mine') }), 'mine') : null,
  );
}

// What the app measured on this lead's join, in plain words.
let joinPaint = 0;
async function paintJoin(p) {
  const el = document.getElementById('join-readout');
  if (!el) return;
  const run = ++joinPaint;
  let out;
  try {
    const { info } = await assembleClip(p);
    if (run !== joinPaint) return;
    const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : '?');
    const line = info.lines[0];
    out = [];
    if (line) {
      const diff = line.after - info.pitchLufs;
      out.push(`Volume: your intro take ${f(line.lufs)} LUFS, ${f(line.after)} in the note; pitch ${f(info.pitchLufs)}. ${Math.abs(diff) <= 1 ? 'Matched.' : `Intro is ${f(Math.abs(diff))} dB ${diff > 0 ? 'louder' : 'quieter'}.`}`);
      if (line.tone) {
        const t = line.tone.tilt;
        const before = Math.abs(t) < 1.5 ? 'about the same tone as the pitch' : `${f(Math.abs(t))} dB ${t < 0 ? 'darker' : 'brighter'} than the pitch`;
        out.push(`Tone: your take is ${before}${line.toneAfter ? `; ${f(line.toneAfter.spread)} dB off after the EQ` : ' (EQ off)'}.`);
      }
      const roomDiff = line.room - info.pitchRoom;
      out.push(
        `Room tone: intro ${f(line.room)} dB, pitch ${f(info.pitchRoom)} dB.${line.eased ? " The intro's tail is eased down to the pitch's level before the join." : ''}${roomDiff > 8 ? ' For the cleanest join, record the intro in the same spot and at the same distance as the pitch.' : ''}`,
      );
    }
    const turned = S.settings.breathDb ? `, turned ${S.settings.breathDb > 0 ? 'up' : 'down'} ${Math.abs(S.settings.breathDb)} dB` : '';
    out.push(
      info.breath?.mine
        ? `Breath: your recorded breath (${info.breath.seconds.toFixed(1)}s), set ${-MY_BREATH_DB} dB below the pitch's speech${turned}.`
        : info.breath
          ? `Breath: a ${info.breath.seconds.toFixed(1)}s breath from ${secs(info.breath.at)} into the pitch (${info.breath.n} of ${info.breath.total}), ${info.breath.db} dB below the pitch's speech${turned}.`
          : S.settings.breath
            ? 'Breath: none found in the pitch and none recorded, so the intro runs straight into it. Record one below.'
            : 'Breath: off.',
    );
    if (info.timing) {
      const ms = (v) => `${Math.round(v)} ms`;
      out.push(`Timing: intro → ${ms(info.timing.before)} of air → ${info.breath ? `breath ${info.breath.seconds.toFixed(1)}s → ${ms(info.timing.after)} of air → ` : ''}pitch.`);
    }
  } catch (e) {
    out = [errText(e)];
  }
  el.replaceChildren(...out.map((t) => h('div', {}, t)));
}

// A long random key for the store's invite endpoint, made here so it never passes through anyone else's hands.
async function makeInviteKey() {
  const st = S.settings;
  if (st.torrey.key && !confirm('Replace the current invite key? The AFFILIATE_INVITE_KEY in Lovable has to be changed to match.')) return;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  st.torrey.key = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  saveSettings().then(flashSaved);
  const copied = await window.api.copyText(st.torrey.key).catch(() => false);
  toast(
    copied
      ? 'New invite key made and copied. Paste it into Lovable as AFFILIATE_INVITE_KEY.'
      : "New invite key made, but it couldn't be copied. Press Show key, select it and copy it (⌘C), then paste it into Lovable as AFFILIATE_INVITE_KEY.",
    8000,
  );
  render();
}

// Copies the invite key again, or says why it couldn't.
async function copyInviteKey() {
  const key = S.settings.torrey.key;
  if (!key) return toast('There is no key yet. Press Make a new key first.');
  const copied = await window.api.copyText(key).catch(() => false);
  toast(copied ? 'Invite key copied.' : "Couldn't copy it. Press Show key, select it and copy it (⌘C).");
}

// Shows or hides the invite key in its box, so it can be read or selected.
function toggleInviteKey(e) {
  const box = document.getElementById('torrey-key');
  if (!box) return;
  const hide = box.type === 'text';
  box.type = hide ? 'password' : 'text';
  e.target.textContent = hide ? 'Show key' : 'Hide key';
}

// Setup's Test buttons for the reply keys.
async function testKey(which) {
  const st = S.settings;
  const say = (text, cls) => {
    const el = document.getElementById(`${which}-test`);
    if (el) (el.textContent = text), (el.className = `small ${cls}`);
  };
  const key = which === 'claude' ? st.claude.key : which === 'mail' ? st.mail.pass : st.torrey.key;
  if (!key) return say(which === 'claude' ? 'Paste your Claude API key above first.' : which === 'mail' ? 'Paste the Gmail app password above first.' : 'Add the invite key above first (Make a new key).', 'bad');
  say('Checking...', 'muted');
  try {
    if (which === 'mail') {
      const r = await window.api.mailTest(st.mail);
      say(`Connected: Gmail accepted ${r.user}.`, 'ok');
    } else if (which === 'claude') {
      const r = await window.api.replyTest(st.claude.key);
      say(`Connected (${r.model}).`, 'ok');
    } else {
      const r = await window.api.torreyTest(st.torrey);
      say(`Connected: ${r.invites} partner invite${r.invites === 1 ? '' : 's'} on the store, ${r.claimed} claimed.`, 'ok');
    }
  } catch (e) {
    say(errText(e), 'bad');
  }
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

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

function replyCard(p) {
  const r = p.reply;
  const st = S.settings;
  const box = h('textarea', {
    'aria-label': `Reply to @${p.handle}`,
    oninput: (e) => {
      r.draft = e.target.value;
      saveProspects();
    },
  }, r.draft || '');
  const send = (withCode) => {
    const text = box.value.trim();
    if (!text) return toast('Write the reply first.');
    r.draft = text;
    queueReply(p, { text, withCode });
    render();
  };
  return h(
    'div',
    { class: 'card reply', 'data-reply': p.handle },
    h(
      'div',
      { class: 'row-flex' },
      h('b', { class: 'grow' }, p.name || `@${p.handle}`, ' ', h('span', { class: 'muted small' }, `@${p.handle}${p.business && p.business !== p.name ? ` · ${p.business}` : ''}`)),
      r.intent ? h('span', { class: `tag ${r.intent === 'yes' ? 'ok' : r.intent === 'no' ? 'bad' : 'warn'}` }, INTENT_LABEL[r.intent] || r.intent) : null,
      h('span', { class: 'muted small' }, ago(r.at)),
    ),
    (r.history || []).slice(-3).map((m) => h('div', { class: `msg ${m.mine ? 'mine' : 'theirs'} muted small` }, m.text)),
    h('div', { class: 'msg theirs' }, r.text),
    r.why ? h('p', { class: 'muted small why' }, r.why) : null,
    r.issue ? h('p', { class: 'status error' }, r.issue) : null,
    r.auto && r.sendAt
      ? h(
          'p',
          { class: 'status armed row-flex', 'data-auto': '' },
          h('span', { class: 'grow' }, `Goes out on its own ${r.sendAt > Date.now() ? `in ${countdown(r.sendAt - Date.now())}` : 'now'}, with ${p.partner ? `their code ${p.partner.code}` : 'their own code'}. Edit it below if you like; if you answer them in the chat first, it's dropped.`),
          h('button', { class: 'link', onclick: () => ((r.sendAt = Date.now()), saveProspects(), dueReplies(), render()) }, 'Send now'),
          h('button', { class: 'link', onclick: () => ((r.auto = false), saveProspects(), render()) }, 'Hold for me'),
        )
      : null,
    box,
    h(
      'div',
      { class: 'row-flex' },
      h('button', { class: 'enter', onclick: () => send(false), disabled: !!S.bg.current }, 'Send'),
      h('button', { onclick: () => send(true), disabled: !!S.bg.current, title: p.partner ? `Their code is ${p.partner.code}` : 'Reserves their code on torreylabs.store and adds the invite to the message' }, p.partner ? 'Send + their code' : 'Send + a code'),
      h('button', { class: 'link', onclick: () => window.api.igDo('openDm', p.handle, 'dm').then(() => window.api.showInstagram()).catch((e) => toast(errText(e))) }, 'Open the thread'),
      // Claude couldn't write it (an error is showing): ask again, with the same message.
      r.issue && st.claude.key && !r.draft
        ? h('button', { class: 'link', id: 'reply-retry', onclick: async () => (toast('Asking Claude again...'), await handleReply(p, r.text, r.history, { key: r.key, voiceOnly: false }), await saveProspects(), render()) }, 'Write it again')
        : null,
      h('span', { class: 'grow' }),
      h(
        'button',
        {
          class: 'link',
          onclick: async () => {
            r.pending = false;
            r.dismissed = true;
            await airtableReply(p, { [RF.handled]: true });
            await saveProspects();
            render();
          },
        },
        'Mark handled',
      ),
    ),
    !st.claude.key ? h('p', { class: 'muted small' }, 'Drafts are written by Claude once its API key is in Setup. Until then, write it here.') : null,
  );
}

function repliesView() {
  const st = S.settings;
  const pending = pendingReplies().sort((a, b) => b.reply.at - a.reply.at);
  const pendingMail = pendingEmails();
  const pendingTotal = pending.length + pendingMail.length;
  const doneMail = Object.values(S.emails.items).filter((e) => !e.pending && (e.sentAt || e.dismissed || e.intent === 'no'));
  const done = S.prospects.filter((p) => p.reply && !p.reply.pending).sort((a, b) => (b.reply.sentAt || b.reply.at) - (a.reply.sentAt || a.reply.at));
  const sent = S.prospects.filter((p) => p.status === 'sent').length;
  return h(
    'main',
    {},
    h(
      'div',
      { class: 'card sync' },
      h(
        'div',
        { class: 'row-flex' },
        h(
          'span',
          { class: `grow small ${S.replies.issue ? 'bad' : 'muted'}` },
          S.replies.issue
            ? `Couldn't check: ${S.replies.issue}`
            : S.replies.checking && S.replies.batch
              ? `Checking chats for replies (${S.replies.batch.done} of ${S.replies.batch.total})...`
              : `${st.replies.watch ? (watcherWorks() ? 'Watching for new messages from your leads, checked every 30 seconds' : `Watching your sent leads' chats (new ones every ${Math.max(10, st.replies.everyMin)} min)`) : 'Not watching for replies (Setup)'}${S.replies.lastAt ? ` · last check ${ago(S.replies.lastAt)}: ${S.replies.note}` : sent ? ' · no check yet' : ''}`,
        ),
        h('button', { onclick: () => (unreadScan({ manual: true }), checkReplies({ manual: true })), disabled: !!S.replies.checking }, 'Check now'),
      ),
      h(
        'div',
        { class: 'row-flex' },
        h('span', { id: 'scan-line', class: `grow small ${S.replies.scan?.issue ? 'bad' : 'muted'}` }, scanLine()),
        h('button', { class: 'link', onclick: copyInboxReport }, 'Copy inbox report'),
      ),
      S.replies.seen?.length
        ? h(
            'details',
            { class: 'small muted', id: 'reply-seen' },
            h('summary', {}, `What the last check read (${S.replies.seen.length} chat${S.replies.seen.length === 1 ? '' : 's'})`),
            S.replies.seen.map((e) =>
              h(
                'div',
                { class: 'log-row' },
                h('b', { class: 'small' }, `@${e.handle}`),
                h(
                  'span',
                  { class: 'small' },
                  e.state !== 'ok'
                    ? `couldn't read the chat (${e.error || e.state})`
                    : !e.total
                      ? 'the chat looked empty to the app'
                      : !e.anchored
                        ? "couldn't find our voice note in the chat, so nothing was read as a reply (use the report)"
                        : `${e.total} message${e.total === 1 ? '' : 's'} (${e.ours} ours, ${e.theirs} theirs)${e.last ? `, last from them: "${e.last.slice(0, 70)}"` : ''}${e.lastIsTheirs ? '' : ' · the last message is ours'}`,
                ),
                h('button', { class: 'link', onclick: () => copyChatReport(e.handle) }, 'Copy a report of this chat'),
              ),
            ),
          )
        : null,
    ),
    !st.claude.key || !st.torrey.key
      ? h(
          'p',
          { class: 'status' },
          [!st.claude.key ? 'Add the Claude API key in Setup so replies are written for each person.' : '', !st.torrey.key ? 'Add the Torrey Labs invite key in Setup so partner codes can be issued.' : ''].filter(Boolean).join(' '),
          ' ',
          h('button', { class: 'link', onclick: goSetup }, 'Open Setup'),
        )
      : null,
    h(
      'div',
      { class: 'card sync' },
      h(
        'div',
        { class: 'row-flex' },
        h('span', { id: 'email-line', class: `grow small ${S.emails.issue ? 'bad' : 'muted'}` }, emailLine()),
        h('button', { id: 'email-check', onclick: () => emailCheck({ manual: true }), disabled: !!S.emails.checking }, 'Check email now'),
      ),
    ),
    h('h2', {}, pendingTotal ? `Waiting on you (${pendingTotal})` : 'Nothing waiting on you'),
    pendingTotal
      ? [...pending.map((p) => [p.reply.at, replyCard(p)]), ...pendingMail.map((e) => [e.at, emailCard(e)])].sort((a, b) => b[0] - a[0]).map(([, card]) => card)
      : h(
          'p',
          { class: 'muted small' },
          st.replies.auto
            ? `A yes or a question for more info gets an answer written for them with their own partner code and how to set up, sent on its own after about ${st.replies.delayMin} min. A no is marked not interested. Anything unclear, or a voice message back, waits here for you.`
            : 'Every reply waits here with a draft for you to approve (automatic answers are off in Setup). A no is marked not interested.',
        ),
    done.length || doneMail.length ? h('h2', {}, 'Answered') : null,
    doneMail
      .sort((a, b) => (b.sentAt || b.at) - (a.sentAt || a.at))
      .slice(0, 40)
      .map((e) =>
        h(
          'div',
          { class: 'log-row reply-done', 'data-email-done': e.email },
          h('span', { class: 'muted small' }, ago(e.sentAt || e.at)),
          h('b', { class: 'small' }, emailWho(e)),
          h('span', { class: 'tag' }, 'email'),
          h('span', { class: `small ${e.intent === 'no' ? 'muted' : 'ok'}` }, e.intent === 'no' ? 'said no' : e.note ? e.note : e.sentAt ? (e.partner ? `emailed their code ${e.partner.code}` : 'emailed') : 'handled by hand'),
          e.sent ? h('span', { class: 'muted small', title: e.sent }, `“${clipText(e.sent, 70)}${e.sent.length > 70 ? '…' : ''}”`) : null,
        ),
      ),
    done.slice(0, 40).map((p) =>
      h(
        'div',
        { class: 'log-row reply-done' },
        h('span', { class: 'muted small' }, ago(p.reply.sentAt || p.reply.at)),
        h('b', { class: 'small' }, `@${p.handle}`),
        h('span', { class: `small ${p.reply.intent === 'no' ? 'muted' : 'ok'}` }, p.reply.intent === 'no' ? 'said no' : p.reply.note ? p.reply.note : p.reply.dismissed ? 'handled by hand' : p.partner ? `sent their code ${p.partner.code}` : 'replied'),
        p.reply.sent ? h('span', { class: 'muted small', title: p.reply.sent }, `“${p.reply.sent.slice(0, 70)}${p.reply.sent.length > 70 ? '…' : ''}”`) : null,
      ),
    ),
  );
}

// Setup is six short tabs instead of one long page. The checklist on top says what's still to do and jumps there;
// the controls most people never touch sit under "More".
const SETUP_TABS = [
  ['voice', 'Voice note'],
  ['sending', 'Sending'],
  ['leads', 'Airtable'],
  ['safety', 'Safety'],
  ['replies', 'Auto-reply'],
  ['autovoice', 'Auto-voice'],
];
const goSetupTab = (id) => {
  S.setupTab = id;
  render();
};

// What's set up and what isn't, one tap from the fix.
function setupChecklist() {
  const st = S.settings;
  const items = [
    ['Pitch recorded', !missingFixed().length, 'voice'],
    ['Airtable connected', !!st.airtable.token, 'leads'],
    ['Claude key', !!st.claude.key, 'replies'],
    ['Invite key (partner codes)', !!st.torrey.key, 'replies'],
    ['Email app password', !!st.mail.pass, 'replies'],
    ['Auto-voice (optional)', !!(st.eleven.key && st.eleven.voiceId), 'autovoice'],
  ];
  return h(
    'div',
    { class: 'checklist', id: 'setup-checklist' },
    items.map(([label, ok, tab]) => h('button', { class: `chip ${ok ? 'ok' : ''}`, title: ok ? 'Done' : 'Tap to set this up', onclick: () => goSetupTab(tab) }, `${ok ? '✓' : '○'} ${label}`)),
  );
}

// A collapsed group for the rarely-needed controls.
const more = (title, ...children) => h('details', { class: 'more' }, h('summary', {}, title), h('div', { class: 'more-body' }, ...children));

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
  const box = (obj, k, label, after) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[k], onchange: (e) => (check(obj, k)(e), after?.()) }), label);
  const total = S.template.filter((s) => s.kind === 'fixed').reduce((n, s) => n + (S.lens[fixedKey(s)] || 0), 0);
  // Opens on the pitch until it's recorded, then on Airtable until it's connected, then on the pitch again.
  if (!SETUP_TABS.some(([id]) => id === S.setupTab)) S.setupTab = !missingFixed().length && !at.token ? 'leads' : 'voice';
  const tab = S.setupTab;

  const panes = {
    voice: () => [
      h('h2', {}, 'Your voice note, in order'),
      S.template.map(segmentCard),
      h('div', { class: 'row-flex' }, h('button', { onclick: () => addSegment('fixed') }, '+ Pitch part'), h('button', { onclick: () => addSegment('slot') }, '+ Custom line')),
      h('p', { class: 'muted small' }, `Recorded parts total ${secs(total)}; keep the whole note under 60s. A custom line can use ${PLACEHOLDERS.map((k) => `{${k}}`).join(' ')}.`),
      more(
        'Tips for the pitch',
        h('p', { class: 'muted small' }, 'Record the pitch once, in one take, reading the script on screen, on the same mic and in the same spot you use for the intro line.'),
        h('p', { class: 'muted small' }, 'Want a custom line in the middle of the pitch? Add a pitch part, then use the arrows to put the line between the two.'),
        h('p', { class: 'muted small' }, 'Only say "every batch third-party tested" if you can send the certificate the moment someone asks, and keep the referral example true to the numbers.'),
      ),
      h('h2', {}, 'How the clip is joined'),
      h(
        'div',
        { class: 'card' },
        box(st, 'matchLevels', "Match each lead's intro to the pitch's volume (recommended)"),
        box(st, 'breath', "Put one of your pitch's own breaths between the intro and the pitch, so the join sounds natural", paintBreath),
        h('div', { id: 'breath-info', class: 'row-flex small' }),
        box(st, 'toneMatch', "Match the intro's tone to the pitch (EQ), so a take recorded closer to or farther from the mic still sounds like the same voice"),
        h('p', { class: 'muted small' }, "Fine-tune the join by ear under Listen on any lead's page."),
        more('More', h('label', { class: 'field' }, 'Silence before the clip starts in Instagram (ms)', h('input', { type: 'number', min: 0, max: 2000, value: st.leadInMs, oninput: num(st, 'leadInMs') }))),
      ),
    ],

    sending: () => [
      h('h2', {}, 'When you press Send'),
      h(
        'div',
        { class: 'card' },
        box(st, 'autoSend', "Send the voice note for me (off: it stops after recording so I can check it and press Instagram's send myself)"),
        box(st, 'autoOpen', "Open the lead's Instagram profile when I open a lead"),
        box(st, 'engageAfterSend', 'After a voice note sends, follow them and like their 1st and 4th posts (pinned posts skipped)'),
        box(st, 'monitorWatching', 'Play the clip out loud when I use Send while watching (background sends are always silent)'),
      ),
      h('h2', {}, 'How it all fits together'),
      h(
        'ol',
        { class: 'steps' },
        h('li', {}, h('b', {}, 'Find'), ' searches hashtags and saves each new account to IG Prospects. A daily sort marks each Qualified or Skipped, fills in their name, business, role and what they do, and adds the good ones to Leads.'),
        h('li', {}, h('b', {}, 'Follow'), ' follows each new lead and likes two of their posts, up to your daily limit. A lead shows up for a voice note a day after it was followed.'),
        h('li', {}, h('b', {}, 'Leads'), ': hit Start next lead, record your lines (Space), listen (Enter), then Send (⌘ Enter). It goes out as a normal voice note, and the follow and likes happen again if they were missed.'),
        h('li', {}, h('b', {}, 'Replies'), ' watches your inbox, tells a yes from a question from a no, and answers with their own partner code.'),
      ),
    ],

    leads: () => [
      h('h2', {}, 'Connect Airtable'),
      h(
        'div',
        { class: 'card' },
        h(
          'p',
          { class: 'muted small' },
          'Make a personal access token at ',
          h('a', { href: 'https://airtable.com/create/tokens', target: '_blank' }, 'airtable.com/create/tokens'),
          ': add the scopes data.records:read and data.records:write, and add the Torrey Labs base under Access. Copy it once it shows, since Airtable only shows it once.',
        ),
        h('label', { class: 'field' }, 'Token', h('input', { type: 'password', value: at.token, placeholder: 'pat...', oninput: txt(at, 'token') })),
        h('div', { class: 'row-flex' }, h('button', { id: 'at-test-btn', onclick: testAirtable }, 'Test connection'), h('span', { id: 'at-test', class: 'grow small muted' }, '')),
        box(st, 'autoSync', 'Check for new leads on launch and every 15 minutes'),
        box(at, 'writeBack', 'When a note is sent, update Airtable: Status = Sent, Channel = Instagram, Sent at = today, Touches = 1'),
        box(st, 'followGate', 'Only DM leads the app followed at least a day ago (recommended). Off: Ready leads can be messaged right away.'),
        more(
          'More',
          h('label', { class: 'field' }, 'Base ID', h('input', { value: at.baseId, oninput: txt(at, 'baseId') })),
          h('label', { class: 'field' }, 'Table', h('input', { value: at.table, oninput: txt(at, 'table') })),
          h('label', { class: 'field' }, 'Which leads to pull (Airtable formula)', h('textarea', { oninput: txt(at, 'formula') }, at.formula)),
          h('label', { class: 'field' }, 'Max leads per sync', h('input', { type: 'number', min: 1, max: 1000, value: at.max, oninput: num(at, 'max') })),
          h('p', { class: 'small' }, h('b', {}, 'Remove lead'), " (on a lead's page) takes it out of the app and:"),
          h('label', { class: 'check' }, h('input', { type: 'radio', name: 'remove-mode', checked: st.removeMode !== 'skip', onchange: () => ((st.removeMode = 'delete'), saveSettings().then(flashSaved)) }), 'deletes its record from Airtable. If Google Maps finds the place again, TL1 adds it back as New.'),
          h('label', { class: 'check' }, h('input', { type: 'radio', name: 'remove-mode', checked: st.removeMode === 'skip', onchange: () => ((st.removeMode = 'skip'), saveSettings().then(flashSaved)) }), 'marks it Skip in Airtable (Status and Track), with the reason. It stays out for good.'),
        ),
      ),
    ],

    safety: () => [h('h2', {}, 'Daily and hourly limits'), limitsCard()],

    replies: () => [
      h('h2', {}, 'Answering replies'),
      h(
        'div',
        { class: 'card' },
        box(st.replies, 'watch', "Watch sent leads' chats for replies", applyBackground),
        box(st.replies, 'auto', 'Answer a yes or a question for more info on its own, with their own partner code and how to set up'),
        h('label', { class: 'field' }, 'Wait before answering (minutes)', h('input', { type: 'number', min: 0, max: 240, step: 'any', value: st.replies.delayMin, oninput: (e) => ((st.replies.delayMin = Math.min(240, Math.max(0, parseFloat(e.target.value) || 0))), saveSettings().then(flashSaved)) })),
        h('p', { class: 'muted small' }, "If you answer them yourself first, the app drops its answer. A no is marked not interested; anything unclear waits under Replies for you."),
      ),
      h('h2', {}, 'Email'),
      h(
        'div',
        { class: 'card' },
        box(st.mail, 'on', 'Answer leads who reply to an email (they appear under Replies, from the replies Make saves in Airtable)'),
        h('label', { class: 'field' }, 'Send from (the mailbox the emails came from)', h('input', { id: 'mail-user', value: st.mail.user, oninput: txt(st.mail, 'user'), placeholder: 'garrett@torreylabshq.com' })),
        h('label', { class: 'field' }, 'Gmail app password', h('input', { id: 'mail-pass', type: 'password', value: st.mail.pass, oninput: txt(st.mail, 'pass'), placeholder: '16 letters' })),
        h('div', { class: 'row-flex' }, h('button', { id: 'mail-test-btn', onclick: () => testKey('mail'), disabled: !!S.busy }, 'Test email'), h('span', { id: 'mail-test', class: 'small muted' })),
        h('p', { class: 'muted small' }, 'Sign in to that Gmail as garrett@torreylabshq.com, open ', h('a', { href: 'https://myaccount.google.com/apppasswords', target: '_blank' }, 'myaccount.google.com/apppasswords'), ' (2-Step Verification has to be on), make one named Torrey Voice Notes, and paste the 16 letters here. It is not your normal password. The app only uses it to send answers from that address, it stays in this app, and you can revoke it any time on that same page.'),
        box(st.mail, 'auto', 'Send a yes or a question\'s answer by email on its own, after the wait above. Leave off at first: every email answer then waits under Replies for you to press Send.'),
      ),
      h('h2', {}, 'Keys'),
      h(
        'div',
        { class: 'card' },
        h('label', { class: 'field' }, 'Claude API key (writes each reply in your voice)', h('input', { type: 'password', value: st.claude.key, oninput: txt(st.claude, 'key'), placeholder: 'sk-ant-...' })),
        h('div', { class: 'row-flex' }, h('button', { onclick: () => testKey('claude'), disabled: !!S.busy }, 'Test Claude'), h('span', { id: 'claude-test', class: 'small muted' }), h('span', { class: 'muted small' }, 'Make one at console.anthropic.com. It stays in this app.')),
        h('label', { class: 'field' }, 'Torrey Labs invite key (issues partner codes)', h('input', { id: 'torrey-key', type: 'password', value: st.torrey.key, oninput: txt(st.torrey, 'key') })),
        h('div', { class: 'row-flex' }, h('button', { id: 'torrey-make', onclick: makeInviteKey }, 'Make a new key'), h('button', { id: 'torrey-copy', onclick: copyInviteKey }, 'Copy key'), h('button', { id: 'torrey-show', onclick: toggleInviteKey }, 'Show key'), h('button', { onclick: () => testKey('torrey'), disabled: !!S.busy }, 'Test Torrey Labs'), h('span', { id: 'torrey-test', class: 'small muted' })),
        h('p', { class: 'muted small' }, 'Press Make a new key (it is copied for you), then give Lovable the same value as the AFFILIATE_INVITE_KEY secret. This key can only create partner invites on torreylabs.store.'),
        h('label', { class: 'field' }, 'Store address in messages', h('input', { value: st.torrey.site, oninput: txt(st.torrey, 'site') })),
      ),
      more(
        'More',
        box(st.replies, 'quick', "Watch the inbox for unread messages every 30 seconds, and read a lead's chat the moment it writes"),
        box(st.replies, 'notify', 'Show a notification when a lead replies'),
        box(st.replies, 'background', 'Keep working in the background: closing the window hides it (Mac) and the app keeps watching, with the Mac kept awake. Quit from the menu to stop.', applyBackground),
        h(
          'div',
          { class: 'grid2' },
          h('label', { class: 'field' }, 'Check older leads every (minutes)', h('input', { type: 'number', min: 10, max: 120, value: st.replies.everyMin, oninput: (e) => ((st.replies.everyMin = Math.min(120, Math.max(10, parseInt(e.target.value, 10) || 10))), saveSettings().then(flashSaved)) })),
          h('label', { class: 'field' }, 'Sign replies as', h('input', { value: st.replies.from, oninput: txt(st.replies, 'from') })),
        ),
        h('label', { class: 'field' }, 'Partner share (%)', h('input', { type: 'number', min: 0, max: 50, value: st.torrey.percent, oninput: (e) => ((st.torrey.percent = Math.min(50, Math.max(0, parseInt(e.target.value, 10) || 0))), saveSettings().then(flashSaved)) })),
      ),
    ],

    autovoice: () => [
      h('h2', {}, 'Auto-voice (optional)'),
      h(
        'div',
        { class: 'card' },
        h('p', { class: 'muted small' }, "Skip recording each lead's lines: an ElevenLabs clone of your voice says them instead. Leave blank to record them yourself."),
        h('label', { class: 'field' }, 'ElevenLabs API key', h('input', { type: 'password', value: el.key, oninput: txt(el, 'key') })),
        h('label', { class: 'field' }, 'Voice ID (your cloned voice)', h('input', { value: el.voiceId, oninput: txt(el, 'voiceId') })),
        h('div', { class: 'row-flex' }, h('button', { onclick: testVoice, disabled: !ttsReady() || !!S.busy }, 'Test voice'), S.busy ? h('span', { class: 'muted small' }, S.busy) : null),
        more(
          'Voice tuning',
          h(
            'label',
            { class: 'field' },
            'Model',
            h(
              'select',
              { onchange: txt(el, 'model') },
              (MODELS.some(([id]) => id === el.model) ? MODELS : [...MODELS, [el.model, el.model]]).map(([id, label]) => h('option', { value: id, selected: id === el.model }, label)),
            ),
          ),
          slider(el, 'speed', 'Speed', 0.7, 1.2, 0.01, 'Slower', 'Faster'),
          slider(el, 'stability', 'Stability', 0, 1, 0.01, 'More variable', 'More stable'),
          slider(el, 'similarity', 'Similarity', 0, 1, 0.01, 'Low', 'High'),
          slider(el, 'style', 'Style exaggeration', 0, 1, 0.01, 'None', 'Exaggerated'),
          box(el, 'speakerBoost', 'Speaker boost (closer to your real voice)'),
          h('p', { class: 'muted small' }, 'Multilingual v2 uses every slider. v3 and v4 mostly listen to Stability (v3 rounds it to 0, 0.5 or 1).'),
          h('button', { class: 'link', onclick: resetVoice }, 'Reset sliders'),
        ),
      ),
    ],
  };

  return h(
    'main',
    {},
    setupChecklist(),
    h('div', { class: 'subtabs' }, SETUP_TABS.map(([id, label]) => h('button', { class: `tab ${tab === id ? 'on' : ''}`, onclick: () => goSetupTab(id) }, label))),
    panes[tab](),
    h('p', { id: 'build', class: 'muted small center' }, S.build ? `Build ${S.build.commit}, installed ${new Date(S.build.built).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Development build'),
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
      cap: `Done for today (${f.today} of ${f.cap} follows). Starts again ${clock(until)}.`,
      likecap: `Done for today: ${f.likesToday} of ${f.likeCap} likes, and each follow comes with two likes. Starts again ${clock(until)}.`,
      totalcap: `Done for today: the combined limit for voice notes, follows and likes is reached (Setup > Safety limits). Starts again ${clock(until)}.`,
      hour: `Pacing: the hourly limit is reached, so the next one is ${clock(until)}.`,
      away: "Waiting for you to step away: following flips the Instagram pane through profiles, so it holds off while you're using the app (2 minutes with no keyboard or mouse).",
      paused: `Paused until ${clock(until)} because Instagram pushed back. See Recent below.`,
      empty: 'Nobody new to follow. Checking Airtable again in 30 minutes.',
      error: 'Hit a snag (see Recent below). Trying again in 10 minutes.',
    }[kind] || 'Running.'
  );
}

// Setup's Test connection: pulls the leads, says what came back or exactly what's wrong, and syncs on success.
async function testAirtable() {
  const out = document.getElementById('at-test');
  const at = S.settings.airtable;
  const say = (text, cls) => {
    out.textContent = text;
    out.className = `grow small ${cls}`;
  };
  if (!at.token) return say('Paste your token above first.', 'bad');
  say('Checking...', 'muted');
  try {
    const got = await window.api.pullAirtable(at);
    const ready = got.filter((p) => p.atStatus === 'Ready').length;
    if (!got.length) return say('Connected, but no leads match the formula below.', 'bad');
    say(`Connected: ${got.length} leads match, ${ready} marked Ready.`, 'ok');
    sync({ quiet: true });
  } catch (e) {
    say(errText(e), 'bad');
  }
}

// Turns the follow wait off from the Leads screen; Setup > Airtable turns it back on.
function skipGate() {
  S.settings.followGate = false;
  saveSettings();
  toast('Follow wait is off. Turn it back on in Setup > Airtable.');
  render();
}

// On the Leads screen, when leads are waiting on the follow step but following isn't running.
function followHint() {
  const f = S.follow;
  if (f?.enabled && !['paused', 'error', 'setup'].includes(f.phase.kind)) return null;
  return h(
    'p',
    { id: 'follow-hint', class: `status ${followDot() === 'bad' ? 'error' : ''}` },
    'Following: ',
    followStatus(f),
    ' ',
    h('button', { class: 'link', onclick: () => ((S.view = 'follow'), render()) }, 'Open Follow'),
  );
}

function logText(e) {
  const likes = e.likes ? `liked ${e.likes} post${e.likes === 1 ? '' : 's'}` : e.private ? 'private, nothing to like' : `no posts liked${e.likeWhy ? ` (${e.likeWhy})` : ''}`;
  if (e.result === 'limit' || e.result === 'paused') return e.note;
  if (e.afterSend && (e.result === 'followed' || e.result === 'already' || e.result === 'notfollowed')) {
    const fol = e.result === 'followed' ? 'followed' : e.result === 'already' ? 'already following' : "didn't follow (the follow limit is reached)";
    return `After the voice note: ${fol}, ${likes}`;
  }
  if (e.result === 'followed') return e.liked ? `Followed and liked ${e.likes === 1 ? 'a post' : `${e.likes} posts`}` : `Followed, ${likes}`;
  if (e.result === 'already') return e.liked ? `Already following; liked ${e.likes === 1 ? 'a post' : `${e.likes} posts`}` : `Already following, ${likes}`;
  if (e.result === 'notfound') return 'Account not found, skipped';
  if (e.result === 'blocked') return `Instagram pushed back ("${e.note}"). Paused for 48 hours.${e.followed ? ' The follow went through.' : ''}`;
  if (e.result === 'loggedout') return 'Instagram is logged out. Stopped.';
  if (e.result === 'failed') return `${e.afterSend ? 'After the voice note' : e.now ? 'Follow + like now' : 'Stopped'}: ${e.note}${e.likes ? `; ${likes}` : ''}`;
  return e.note;
}

const logClass = (e) =>
  // A follow that should have come with a like but didn't stands out, so a like step that stops working is noticed.
  (['followed', 'already', 'notfollowed'].includes(e.result) && !e.likes && !e.liked && !e.private && e.likeWhy && !/no posts yet/.test(e.likeWhy) ? 'warn' : '') ||
  ({ followed: 'ok', already: 'muted', notfollowed: 'muted', limit: 'muted', paused: 'warn', notfound: 'muted', blocked: 'bad', failed: 'bad', loggedout: 'bad', error: 'warn' })[e.result] ||
  '';

// Follow screen: "Check" opens one profile and its first post in the follow tab and says what it finds, without
// following or liking anything. "Follow + like now" does the real thing on that account, right away, the same
// way a voice note triggers it, and shows the result (it also goes to the lead's IG log in Airtable).
async function probeLikes(doIt = false) {
  const input = document.getElementById('probe-handle');
  const handle = leads.cleanHandle(input?.value || '');
  if (!handle) return toast('Type an Instagram handle first.');
  if (S.probing) return;
  const out = document.getElementById('probe-out');
  const lead = S.prospects.find((x) => x.handle && x.handle.toLowerCase() === handle.toLowerCase());
  if (doIt && !confirm(`Follow @${handle} and like their 1st and 4th posts now?${lead?.airtableId ? ' The result goes to their record in Airtable too.' : ''}`)) return;
  S.probing = true;
  out.textContent = doIt ? `Following @${handle} and liking their posts...` : `Looking at @${handle}...`;
  try {
    if (doIt) {
      const r = await window.api.followEngageNow(handle, lead?.airtableId || '');
      S.probe = `@${handle}: ${r.line || r.note || r.result}`;
      if (r.result === 'followed' || r.result === 'already') toast(`@${handle}: ${r.likes ? `liked ${r.likes} post${r.likes === 1 ? '' : 's'}` : 'no post liked'} ✓`);
      if (lead && r.followed) lead.followedAt = new Date().toISOString();
    } else {
      const lines = await window.api.followProbe(handle);
      S.probe = lines.join('\n');
    }
  } catch (e) {
    S.probe = `${doIt ? 'It' : 'The check'} failed: ${errText(e)}`;
  }
  S.probing = false;
  out.textContent = S.probe;
  if (S.view === 'follow') render();
}

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
            [`Today: ${f.today} of ${f.cap} follows`, f.likeCap ? `${f.likesToday} of ${f.likeCap} likes` : '', `${f.total} followed in all`, f.skipped ? `${f.skipped} not found` : ''].filter(Boolean).join(' · '),
          )
        : null,
      catchUpLeft().length
        ? h(
            'p',
            { class: 'small' },
            `Catching up: ${catchUpLeft().length} lead${catchUpLeft().length === 1 ? '' : 's'} got a voice note but no follow or likes yet. Each is followed and 2 posts liked on its own, a few minutes apart, once you've been away from the computer for 2 minutes (Recent below, and their IG log in Airtable).${S.away ? '' : ' Holding off while you use the app.'}`,
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
            h(
              'div',
              { class: 'log-row' },
              h('span', { class: 'muted small' }, clock(e.at)),
              e.handle ? h('b', { class: 'small' }, `@${e.handle}`) : null,
              h('span', { class: `small ${logClass(e)}` }, logText(e)),
              e.shot ? h('button', { class: 'link', onclick: () => window.api.revealShot(e.shot) }, 'See what Instagram showed') : null,
            ),
          ),
        )
      : h('p', { class: 'muted small' }, 'Nothing yet.'),
    h(
      'p',
      { class: 'muted small' },
      'Pacing: your daily limit above, capped by Setup > Safety limits (with a like for each follow, an hourly cap, and a combined cap with voice notes; the day resets at midnight Pacific), 2 to 6 minutes between accounts, any time of day. If Instagram shows "action blocked", "try again later" or a security check, it stops and waits 48 hours.',
    ),
    h('h2', {}, 'Try it on one account'),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'muted small' }, "Follow + like now follows this account and likes their 1st and 4th posts right away, the same way a voice note triggers it, and says exactly what happened (the lead's IG log in Airtable gets the same line). Check only looks: it opens the profile and its first post and says whether the app can see the posts and the Like button, without following or liking. Press Copy to send the result over."),
      h(
        'div',
        { class: 'row-flex' },
        h('input', { id: 'probe-handle', placeholder: '@handle', value: S.probeHandle ?? (f?.log?.find((e) => e.handle)?.handle || ''), oninput: (e) => (S.probeHandle = e.target.value) }),
        h('button', { class: 'enter', onclick: () => probeLikes(true), disabled: !!S.probing }, 'Follow + like now'),
        h('button', { onclick: () => probeLikes(false), disabled: !!S.probing }, 'Check'),
        h('button', { class: 'link', onclick: () => S.probe && window.api.copyText(S.probe).then((ok) => toast(ok ? 'Copied.' : "Couldn't copy.")) }, 'Copy'),
      ),
      h('pre', { id: 'probe-out', class: 'small probe-out' }, S.probe || ''),
    ),
    h('p', { class: 'muted small' }, 'While this screen is open, the right side shows the follow tab so you can watch. Following keeps running when you go back to Leads.'),
  );
}

window.api.onFollow((f) => {
  S.follow = f;
  const dot = document.getElementById('follow-dot');
  if (dot) dot.className = `dot ${followDot()}`;
  if (S.view === 'follow') render();
  else paintPipeline();
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


// ---------- find accounts by hashtag ----------

function findDot() {
  const f = S.find;
  if (!f?.enabled) return f?.stopNote ? 'bad' : '';
  return f.phase.kind === 'paused' || f.phase.kind === 'error' ? 'warn' : 'ok';
}

function findStatus(f) {
  if (!f) return 'Loading...';
  if (!f.enabled) {
    if (f.stopNote === 'loggedout') return 'Stopped: Instagram is logged out in the app. Log in on the right, then press Start.';
    if (f.stopNote) return `Stopped to be safe: ${f.stopNote}. Check Instagram on the right, then press Start.`;
    return 'Off. Press Start and it searches your hashtags in the background and saves each new account for the daily sort.';
  }
  const { kind, until } = f.phase;
  if (kind === 'gap') return ['Waiting a bit between pages. Next one in ', h('b', { id: 'find-countdown' }, countdown(until - Date.now())), '.'];
  return (
    {
      setup: 'Add your Airtable token in Setup to start.',
      notags: 'Add at least one hashtag below.',
      tag: `Searching #${f.current?.tag || ''}...`,
      profile: `Reading @${f.current?.handle || ''}...`,
      cap: `Done for today (${f.read} of ${f.cap} profiles). Starts again ${clock(until)}.`,
      paused: `Paused until ${clock(until)} because Instagram pushed back. See Recent below.`,
      idle: `Every hashtag was searched recently. The next search is ${clock(until)}.`,
      error: 'Hit a snag (see Recent below). Trying again in 10 minutes.',
    }[kind] || 'Running.'
  );
}

const followerText = (n) => (n == null ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M followers` : n >= 1e4 ? `${Math.round(n / 1e3)}K followers` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K followers` : `${n} followers`);

function findLogText(e) {
  if (e.result === 'saved') return `Saved${e.note ? `: ${e.note}` : ''}${e.tag ? ` (from #${e.tag})` : ''}`;
  if (e.result === 'searched') return `Searched: ${e.found} new account${e.found === 1 ? '' : 's'} of ${e.of} seen${e.via === 'posts' ? ' (read from post pages)' : ''}`;
  if (e.result === 'notfound') return 'Account not found, skipped';
  if (e.result === 'blocked') return `Instagram pushed back ("${e.note}"). Following and searching pause for 48 hours.`;
  if (e.result === 'loggedout') return 'Instagram is logged out. Stopped.';
  return e.note || e.result;
}
const findLogClass = (e) => ({ saved: 'ok', searched: '', empty: 'muted', notfound: 'muted', blocked: 'bad', failed: 'bad', loggedout: 'bad', error: 'warn' })[e.result] || '';

// What the daily sort decided about the accounts found here (Airtable's IG Prospects), refreshed now and then.
let verdictAt = 0;
async function refreshVerdicts(force = false) {
  const list = S.find?.found || [];
  if (!list.length || (!force && Date.now() - verdictAt < 60 * 1000)) return;
  verdictAt = Date.now();
  try {
    Object.assign(S.findVerdicts, await window.api.findVerdicts(list.slice(0, 60).map((e) => e.handle)));
    if (S.view === 'find' && !document.activeElement?.matches?.('input, textarea')) render();
  } catch {}
}

async function testFind() {
  const out = document.getElementById('find-test');
  const btn = document.getElementById('find-test-btn');
  btn.disabled = true;
  out.textContent = 'Searching the first hashtag and reading one profile. This takes about a minute...';
  try {
    out.textContent = await window.api.findTest('');
  } catch (e) {
    out.textContent = errText(e);
  }
  btn.disabled = false;
}

function findView() {
  const f = S.find;
  const on = !!f?.enabled;
  const st = S.settings.find;
  const verdict = (e) => {
    const v = S.findVerdicts[e.handle];
    if (!v || !v.status || v.status === 'New') return ['waiting for the sort', 'warn'];
    return v.status === 'Qualified' ? ['qualified', 'ok'] : [v.status.toLowerCase(), ''];
  };
  return h(
    'main',
    {},
    h(
      'div',
      { class: 'card' },
      h('p', { id: 'find-status', class: `follow-status ${findDot()}` }, findStatus(f)),
      h('button', { id: 'find-toggle', class: on ? 'big' : 'enter', onclick: () => window.api.findSet(!on), disabled: !f }, on ? 'Stop searching' : 'Start searching'),
      h(
        'label',
        { class: 'field inline-field' },
        'Profiles to read a day',
        h('input', {
          id: 'find-perday',
          type: 'number',
          min: 1,
          max: discover.LIMITS.maxPerDay,
          value: st.perDay,
          oninput: (e) => {
            if (!e.target.value) return;
            st.perDay = discover.clampPerDay(e.target.value);
            saveSettings().then(flashSaved);
          },
        }),
      ),
      f
        ? h(
            'p',
            { id: 'find-counts', class: 'muted small' },
            [`Today: ${f.read} of ${f.cap} profiles read`, `${f.saved} saved`, `${f.total.saved} saved in all`, f.pending ? `${f.pending} waiting to be read` : ''].filter(Boolean).join(' · '),
          )
        : null,
    ),
    h('h2', {}, 'Hashtags'),
    h(
      'div',
      { class: 'card' },
      h('label', { class: 'field' }, 'One per line. They are searched in turn, each at most twice a day, as the daily limit allows.', h('textarea', { id: 'find-tags', rows: 8, oninput: (e) => ((st.tags = e.target.value), saveSettings().then(flashSaved)) }, st.tags)),
      h(
        'div',
        { class: 'row-flex' },
        h('button', { id: 'find-test-btn', onclick: testFind }, 'Try one hashtag (saves nothing)'),
        h('button', { class: 'link', onclick: () => ((st.tags = discover.DEFAULT_TAGS.join('\n')), saveSettings().then(flashSaved), render()) }, 'Use the suggested list'),
      ),
      h('pre', { id: 'find-test', class: 'report' }),
    ),
    h('h2', {}, f?.found?.length ? `Found (${f.found.length})` : 'Found'),
    f?.found?.length
      ? h(
          'div',
          { class: 'list', id: 'find-found' },
          f.found.slice(0, 40).map((e) => {
            const v = S.findVerdicts[e.handle];
            const [text, cls] = verdict(e);
            return h(
              'div',
              { class: 'lead static', 'data-handle': e.handle },
              h(
                'div',
                { class: 'who' },
                h('span', {}, h('b', {}, `@${e.handle}`), e.name ? h('span', { class: 'muted small' }, ` ${e.name}`) : null),
                h('span', { class: 'muted small' }, [v?.business, v?.role || e.category, followerText(e.followers), e.private ? 'private' : '', `#${e.tag}`].filter(Boolean).join(' · ')),
                e.bio ? h('span', { class: 'muted small' }, e.bio) : null,
                v?.why ? h('span', { class: 'small' }, v.why) : null,
              ),
              h('span', { class: `tag ${cls}` }, text),
            );
          }),
        )
      : h('p', { class: 'muted small' }, 'Nothing yet. Each account it reads is saved to Airtable (IG Prospects) as New.'),
    h(
      'p',
      { class: 'muted small' },
      'Your daily sort routine decides who fits. It marks each new account Qualified or Skipped with a reason and a name, business and role, and copies the qualified ones into Leads, where they show up under Leads > Waiting.',
    ),
    h('h2', {}, 'Recent'),
    f?.log?.length
      ? h(
          'div',
          { class: 'card log' },
          f.log.map((e) =>
            h(
              'div',
              { class: 'log-row' },
              h('span', { class: 'muted small' }, clock(e.at)),
              e.handle ? h('b', { class: 'small' }, `@${e.handle}`) : e.tag ? h('b', { class: 'small' }, `#${e.tag}`) : null,
              h('span', { class: `small ${findLogClass(e)}` }, findLogText(e)),
              e.diag ? h('button', { class: 'link', onclick: () => window.api.revealShot(e.diag) }, 'See what Instagram showed') : null,
            ),
          ),
        )
      : h('p', { class: 'muted small' }, 'Nothing yet.'),
    h(
      'p',
      { class: 'muted small' },
      'It only reads: it never follows, likes or messages anyone. Pacing: your daily limit above (the day resets at midnight Pacific), 25 to 70 seconds between profiles, and about a minute after each hashtag page. If Instagram shows "action blocked", "try again later" or a security check, it stops and waits 48 hours, along with following. While this screen is open, the right side shows the tab it works in.',
    ),
  );
}

window.api.onFind((f) => {
  S.find = f;
  const dot = document.getElementById('find-dot');
  if (dot) dot.className = `dot ${findDot()}`;
  if (S.view !== 'find') return paintPipeline();
  // While you're typing in this screen, only the status line updates, so nothing you're editing is lost.
  if (document.activeElement?.matches?.('input, textarea')) {
    const el = document.getElementById('find-status');
    if (el) el.replaceChildren(...[].concat(findStatus(f)).map((x) => (typeof x === 'string' ? document.createTextNode(x) : x)));
  } else render();
});

setInterval(() => {
  const el = document.getElementById('find-countdown');
  if (el && S.find?.phase.until) el.textContent = countdown(S.find.phase.until - Date.now());
  if (S.view === 'find') refreshVerdicts();
}, 1000);

let pane = 'dm';
function render() {
  const p = current();
  if (S.currentId && !p) S.currentId = null;
  const body = S.view === 'setup' ? setupView() : S.view === 'follow' ? followView() : S.view === 'find' ? findView() : S.view === 'replies' ? repliesView() : p ? detailView(p) : leadsView();
  $app.replaceChildren(header(), ...(S.view === 'setup' ? [] : [pipelineStrip()]), queueStrip(), body);
  syncBadge();
  paintQueue();
  if (S.view === 'setup') paintBreath();
  else if (p && document.getElementById('join-panel')) {
    paintBreath();
    paintJoin(p);
  }
  showRightPane();
}

// The Follow and Find screens put the follow tab on the right, Watch shows the background send, otherwise the DM tab.
function showRightPane() {
  const want = S.view === 'follow' || S.view === 'find' ? 'follow' : S.watchSend && S.bg.current ? 'send' : 'dm';
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
    } else if (e.metaKey || e.ctrlKey) sendLead(p);
    else document.querySelector(`[data-play="preview:${p.id}"]`)?.click();
  }
});

// ---------- boot ----------

(async () => {
  // Written by build-mac.mjs, so Setup can show which update is installed.
  S.build = await import('./build.js').then((m) => m.default).catch(() => null);
  S.lens = (await store.get('kv', 'lens')) || {};
  S.said = await store.get('kv', 'said');
  if (!S.said) {
    S.said = {};
    await backfillSaid();
  }
  S.template = await migrateTemplate((await store.get('kv', 'template')) || structuredClone(DEFAULT_TEMPLATE));
  const saved = (await store.get('kv', 'settings')) || {};
  S.settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    airtable: { ...DEFAULT_SETTINGS.airtable, ...saved.airtable },
    eleven: { ...DEFAULT_SETTINGS.eleven, ...saved.eleven },
    claude: { ...DEFAULT_SETTINGS.claude, ...saved.claude },
    torrey: { ...DEFAULT_SETTINGS.torrey, ...saved.torrey },
    replies: { ...DEFAULT_SETTINGS.replies, ...saved.replies },
    mail: { ...DEFAULT_SETTINGS.mail, ...saved.mail },
    find: { ...DEFAULT_SETTINGS.find, ...saved.find },
    limits: { ...DEFAULT_SETTINGS.limits, ...saved.limits, window: { ...DEFAULT_SETTINGS.limits.window, ...saved.limits?.window }, custom: { ...DEFAULT_SETTINGS.limits.custom, ...saved.limits?.custom } },
  };
  // The cap used to default to 100, which is fewer leads than the formula matches.
  if (S.settings.airtable.max === 100) S.settings.airtable.max = DEFAULT_SETTINGS.airtable.max;
  // Replies are now read chat by chat, so a lead is looked at every 10 minutes at most.
  if (S.settings.replies.everyMin < 10) S.settings.replies.everyMin = 10;
  // The old default wait of 15 minutes becomes 4: an answer should come quickly. A wait you chose yourself stays.
  if (saved.replies && saved.replies.quick === undefined && S.settings.replies.delayMin === 15) S.settings.replies.delayMin = 4;
  S.prospects = (await store.get('kv', 'prospects')) || [];
  S.removed = { ids: [], handles: [], ...((await store.get('kv', 'removed')) || {}) };
  S.emails.items = (await store.get('kv', 'emails')) || {};
  // One that was being sent when the app closed goes back to waiting; it is not sent again unless you press Send.
  for (const e of Object.values(S.emails.items)) delete e.sending;
  for (const p of S.prospects.filter((x) => x.status === 'sending')) {
    p.status = 'todo';
    // One that was only waiting on a safety limit goes back to To do as it was, to send again.
    if (!p.waitingLimit) p.sendIssue = 'the app closed before it sent';
    delete p.waitingLimit;
  }
  S.fast = await window.api.testFast().catch(() => false);
  S.away = await window.api.userAway().catch(() => true);
  const fixedSegs = S.template.filter((s) => s.kind === 'fixed');
  if (fixedSegs.length && fixedSegs.every((s) => !S.lens[fixedKey(s)])) S.view = 'setup';
  pushFollowConfig();
  S.follow = await window.api.followState();
  pushVoiceTimes();
  S.find = await window.api.findState();
  render();
  if (S.settings.autoSync) sync({ quiet: true });
  setInterval(() => S.settings.autoSync && sync({ quiet: true }), SYNC_MS);
  setInterval(() => (paintSync(), paintSentToday()), 60 * 1000);
  // Failed sends that went out anyway: a first look a little after launch.
  setTimeout(() => checkFailedSends(), 30 * 1000);
  // Replies: a first look shortly after launch, then on the schedule in Setup.
  setTimeout(() => checkReplies(), 45 * 1000);
  setInterval(() => checkReplies(), 60 * 1000);
  // Leads that got a voice note but no follow yet: caught up a few minutes apart.
  setInterval(() => window.api.userAway().then((a) => (S.away = a), () => {}), 5000);
  setTimeout(() => catchUpEngage(), S.fast ? 3000 : 90 * 1000);
  setInterval(() => catchUpEngage(), S.fast ? 2000 : 60 * 1000);
  // The inbox watcher: unread messages from leads, once a minute. Clicking a notification lands on Replies.
  setTimeout(() => unreadScan(), 20 * 1000);
  setInterval(() => unreadScan(), 30 * 1000);
  window.api.onNav?.(({ tab }) => ((S.view = tab || 'replies'), render()));
  applyBackground();
  // Auto-replies whose time has come, and the countdowns on the Replies tab.
  setInterval(dueReplies, 15 * 1000);
  // Emailed leads who wrote back: Airtable is checked every 5 minutes (Make writes each reply there every 15), answers that are due go out.
  setTimeout(() => emailCheck(), 60 * 1000);
  setInterval(() => emailCheck(), 5 * 60 * 1000);
  setInterval(dueEmails, 15 * 1000);
  setInterval(() => S.view === 'replies' && (pendingReplies().some((p) => p.reply.auto) || pendingEmails().some((e) => e.auto)) && refreshQuietly(), 20 * 1000);
})();
