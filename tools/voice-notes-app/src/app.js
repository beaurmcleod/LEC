import * as store from './store.js';
import * as audio from './audio.js';
import * as leads from './leads.js';
import * as replies from './replies.js';

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
  engageAfterSend: true,
  claude: { key: '' },
  torrey: { url: 'https://hvqerbhurepxjdyokzxx.supabase.co', key: '', site: 'https://torreylabs.store', percent: 20 },
  replies: { watch: true, everyMin: 5, from: 'Garrett' },
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
const REFRESH_FIELDS = ['first', 'role', 'business', 'category', 'hook', 'bridge', 'bio', 'research', 'notes', 'atStatus', 'followedAt', 'channel', 'atSentAt'];
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
  replies: { checking: false, lastAt: 0, note: '', issue: '' },
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
async function runQueue() {
  if (S.bg.current) return;
  while (S.bg.jobs.length) {
    // Checks of failed sends wait behind everything else, so they never hold up a send.
    const first = S.bg.jobs.findIndex((j) => !j.audit);
    const job = S.bg.jobs.splice(first >= 0 ? first : 0, 1)[0];
    const p = S.prospects.find((x) => x.id === job.pid);
    if (job.engage) {
      if (p) await engage(p);
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
    if (!p || p.status !== 'sending') continue;
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

// Once a note is sent: follow them and like their 1st and 4th posts. It runs in the hidden send tab, straight
// after that send and before the next one.
function queueEngage(p) {
  if (!S.settings.engageAfterSend || !p.handle) return;
  S.bg.jobs.unshift({ pid: p.id, engage: true });
  runQueue();
}

async function engage(p) {
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, engage: true };
  paintQueue();
  const r = await window.api.engage(p.handle, p.airtableId || '').catch((e) => ({ result: 'failed', note: errText(e) }));
  if (r.result === 'blocked') toast(`Instagram pushed back while following @${p.handle} ("${r.note}"). Follows and likes pause for 48 hours.`, 8000);
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

// The inbox shows a name (or handle) per thread, not the handle itself, so a thread is matched by the
// address remembered when the note was sent, and otherwise by the name.
function matchThread(t, list) {
  const byHref = list.find((p) => p.dm?.href && p.dm.href === t.href);
  if (byHref) return byHref;
  const name = String(t.name || '').trim().toLowerCase();
  if (!name) return null;
  const same = (v) => v && String(v).trim().toLowerCase() === name;
  return list.find((p) => same(p.handle) || same(p.name) || same(p.business) || same(`${p.first || ''}`)) || null;
}

const ourPreview = (s) => /^(you sent|you:|you replied|you reacted|you shared)/i.test(String(s || '').trim());

// Looks through the inbox for leads who wrote back since the last look. Runs in the hidden send tab, so it
// waits for any send or follow to finish first, and sends wait for it.
async function checkReplies({ manual = false } = {}) {
  const r = S.settings.replies;
  if (!manual && !r.watch) return;
  if (!manual && Date.now() - S.replies.lastAt < r.everyMin * 60 * 1000) return;
  if (S.bg.current || S.bg.jobs.length || S.sending || S.rec) {
    if (manual) toast('Wait for the current send to finish, then check again.');
    return;
  }
  const candidates = S.prospects.filter((p) => p.status === 'sent' && p.handle);
  if (!candidates.length) {
    S.replies = { ...S.replies, lastAt: Date.now(), note: 'Nothing sent yet, so nothing to check.' };
    return refreshQuietly();
  }
  S.replies.checking = true;
  S.bg.current = { pid: null, handle: '', text: '', until: 0, check: true };
  paintQueue();
  let found = 0;
  let issue = '';
  try {
    const inbox = await window.api.dmInbox();
    if (inbox.state === 'loggedout') throw new Error('Instagram is logged out. Sign in on the right.');
    if (inbox.state === 'unreadable') throw new Error("the app can't read Instagram's new inbox layout yet, so replies aren't being picked up");
    for (const t of inbox.threads || []) {
      const p = matchThread(t, candidates);
      if (!p) continue;
      const before = p.dm?.preview ?? null;
      p.dm = { ...p.dm, href: t.href, name: t.name };
      // Unchanged since last look, or the last message in the thread is ours: nothing new from them.
      if (t.preview === before || ourPreview(t.preview)) {
        p.dm.preview = t.preview;
        continue;
      }
      const thread = await window.api.dmThread(t.href);
      const msgs = thread.messages || [];
      let i = msgs.length;
      while (i > 0 && !msgs[i - 1].mine) i--;
      const theirs = msgs.slice(i).filter((m) => !m.voice).map((m) => m.text);
      p.dm.preview = t.preview;
      if (!theirs.length) continue;
      found++;
      await handleReply(p, theirs.join('\n'), msgs.slice(0, i));
    }
  } catch (e) {
    issue = errText(e);
  }
  S.replies = {
    checking: false,
    lastAt: Date.now(),
    issue,
    note: issue ? `Couldn't check: ${issue}` : found ? `${found} new ${found === 1 ? 'reply' : 'replies'}` : 'No new replies',
  };
  S.bg.current = null;
  paintQueue();
  await saveProspects();
  refreshQuietly();
  runQueue();
}

// What a reply gets: a clear yes is answered right away with their code; a no is marked and left alone;
// a question or anything unclear becomes a draft under Replies for you to approve.
async function handleReply(p, text, history) {
  const st = S.settings;
  p.reply = { text, at: Date.now(), history: history.slice(-8), pending: true, intent: '', draft: '', why: '', issue: '' };
  await airtableReply(p, { [RF.status]: 'Replied', [RF.lastReply]: text, [RF.received]: new Date().toISOString(), [RF.handled]: false });
  let intent = 'unclear';
  let draft = '';
  let why = '';
  try {
    if (st.claude.key) {
      const d = await window.api.replyDraft(st.claude.key, replies.replyPrompt(p, { text, history, from: st.replies.from, percent: st.torrey.percent, site: st.torrey.site }));
      ({ intent, why } = d);
      draft = d.reply;
    } else {
      intent = replies.quickIntent(text);
      if (intent === 'yes') draft = replies.fallbackMessage(p, { ...replies.SLOTS, from: st.replies.from, percent: st.torrey.percent });
      why = st.claude.key ? '' : 'Read without Claude (no API key in Setup).';
    }
  } catch (e) {
    p.reply.issue = errText(e);
  }
  Object.assign(p.reply, { intent, draft, why });
  if (intent === 'no') {
    p.reply.pending = false;
    await airtableReply(p, { [RF.status]: 'Not interested', [RF.intent]: 'No', [RF.handled]: true });
    toast(`@${p.handle} said no thanks. Marked not interested.`);
    return;
  }
  if (intent === 'yes' && draft && !p.reply.issue) return sendReplyNow(p, { text: draft, withCode: true });
  await airtableReply(p, { [RF.intent]: INTENT_LABEL[intent] || 'Unclear', [RF.suggested]: draft, [RF.handled]: false });
  toast(`@${p.handle} replied. A draft is waiting under Replies.`, 6000);
}

// Reserves their code on torreylabs.store if needed, fills it into the message, and types it into the thread.
async function sendReplyNow(p, { text, withCode = false }) {
  const st = S.settings;
  let vals = null;
  S.bg.current = { pid: p.id, handle: p.handle, text: '', until: 0, reply: true };
  paintQueue();
  try {
    if (withCode) {
      if (!p.partner?.code) {
        if (!st.torrey.key) throw new Error('Add the Torrey Labs Cloud key in Setup to issue partner codes.');
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
    p.reply = { ...p.reply, pending: false, sent: text, sentAt: Date.now(), issue: r?.state === 'sent' ? '' : "Sent, but the app couldn't confirm it landed. Check the thread." };
    p.dm = { ...p.dm, preview: `You: ${text.slice(0, 60)}` };
    await airtableReply(p, {
      [RF.suggested]: text,
      [RF.handled]: true,
      [RF.intent]: INTENT_LABEL[p.reply.intent] || (vals ? 'Yes' : 'Unclear'),
      ...(vals ? { [RF.status]: 'Code sent', [RF.code]: vals.code, [RF.link]: vals.link, [RF.invite]: vals.invite, [RF.codeSentAt]: new Date().toISOString() } : {}),
    });
    toast(`Replied to @${p.handle}${vals ? ` with their code ${vals.code}` : ''} ✓`);
  } catch (e) {
    p.reply = { ...p.reply, pending: true, draft: text, issue: errText(e) };
    await airtableReply(p, { [RF.suggested]: text, [RF.handled]: false });
    toast(`Couldn't reply to @${p.handle}: ${errText(e)}. It's waiting under Replies.`, 8000);
  }
  S.bg.current = null;
  paintQueue();
  await saveProspects();
  refreshQuietly();
}

function queueReply(p, reply) {
  S.bg.jobs.push({ pid: p.id, reply });
  toast(`Replying to @${p.handle}...`);
  runQueue();
}

const pendingReplies = () => S.prospects.filter((p) => p.reply?.pending);

// Updates the screen after a background change, unless that would interrupt recording or typing.
function refreshQuietly() {
  if (S.rec || S.view === 'setup' || document.activeElement?.matches?.('input, textarea')) return paintQueue();
  render();
}

// The strip under the tabs that shows what's sending in the background.
function queueStrip() {
  return h('div', { id: 'send-queue', class: 'queue', hidden: true });
}
function paintQueue() {
  const el = document.getElementById('send-queue');
  if (!el) return;
  const cur = S.bg.current;
  el.hidden = !cur;
  if (!cur) return el.replaceChildren();
  const left = cur.until ? ` · ${countdown(cur.until - Date.now())} left` : '';
  const queued = S.bg.jobs.filter((j) => !j.engage).length;
  const more = queued ? ` · ${queued} more queued` : '';
  const what = cur.check
    ? [h('b', {}, 'Checking Instagram for replies...')]
    : cur.audit
      ? [h('b', {}, `Checking @${cur.handle}'s chat`), ' for our voice note...']
    : cur.reply
      ? [h('b', {}, `Replying to @${cur.handle}`), '...']
      : cur.engage
        ? [h('b', {}, `Following @${cur.handle}`), ' and liking 2 posts...']
        : [h('b', {}, `Sending to @${cur.handle}`), ` ${cur.text.replace(/\s*\(\d+:\d+\)\.\.\.$/, '...')}`];
  el.replaceChildren(
    h('span', { class: 'grow' }, ...what, `${left}${more}`),
    h('button', { class: 'link', onclick: toggleWatch }, S.watchSend ? 'Hide' : 'Watch'),
  );
}
setInterval(() => S.bg.current?.until && paintQueue(), 1000);

function toggleWatch() {
  S.watchSend = !S.watchSend;
  showRightPane();
  paintQueue();
}

// Sends in the Instagram pane you can see, handing off to you if a step needs a click.
async function sendNow(p) {
  if (S.rec || S.sending) return;
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
      Object.assign(ex, { atStatus: inc.atStatus, channel: inc.channel, atSentAt: inc.atSentAt });
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
    let sentIssue = '';
    try {
      restored = await restoreSent(await window.api.pullSentAirtable(at));
    } catch (e) {
      sentIssue = errText(e);
    }
    S.sync.at = Date.now();
    S.sync.error = '';
    const todo = S.prospects.filter((p) => p.status === 'todo');
    const ready = todo.filter(shown).length;
    if (!quiet)
      toast(`Synced ${pulled.length} leads from Airtable (${added} new${restored ? `, ${restored} back under Sent` : ''}). ${ready} ready to send, ${todo.length - ready} waiting.`, 6000);
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

// Voice notes sent since midnight on this Mac, counting ones you marked sent by hand.
function sentToday() {
  const midnight = new Date().setHours(0, 0, 0, 0);
  return S.prospects.filter((p) => p.status === 'sent' && p.sentAt >= midnight).length;
}

function sentBadge() {
  const n = sentToday();
  return h('span', { id: 'sent-today', class: 'badge sent', title: `${n} voice note${n === 1 ? '' : 's'} sent today` }, `✓ ${n}`);
}

// In place, so a background send never interrupts recording or typing.
const paintSentToday = () => document.getElementById('sent-today')?.replaceWith(sentBadge());

async function markSent(p) {
  p.status = 'sent';
  p.sentAt = Date.now();
  delete p.sendIssue;
  await saveProspects();
  paintSentToday();
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
        { class: `tab ${S.view === 'replies' ? 'on' : ''}`, onclick: () => ((S.view = 'replies'), render()) },
        'Replies',
        h('span', { id: 'reply-badge', class: 'badge', hidden: !pendingReplies().length }, pendingReplies().length),
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
      h('span', { class: 'muted small' }, [p.handle ? `@${p.handle}` : 'no handle', p.role, p.business !== p.name ? p.business : ''].filter(Boolean).join(' · ')),
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

// Setup's Test buttons for the reply keys.
async function testKey(which) {
  const st = S.settings;
  const say = (text, cls) => {
    const el = document.getElementById(`${which}-test`);
    if (el) (el.textContent = text), (el.className = `small ${cls}`);
  };
  const key = which === 'claude' ? st.claude.key : st.torrey.key;
  if (!key) return say(which === 'claude' ? 'Paste your Claude API key above first.' : 'Paste the service role key above first.', 'bad');
  say('Checking...', 'muted');
  try {
    if (which === 'claude') {
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
    box,
    h(
      'div',
      { class: 'row-flex' },
      h('button', { class: 'enter', onclick: () => send(false), disabled: !!S.bg.current }, 'Send'),
      h('button', { onclick: () => send(true), disabled: !!S.bg.current, title: p.partner ? `Their code is ${p.partner.code}` : 'Reserves their code on torreylabs.store and adds the invite to the message' }, p.partner ? 'Send + their code' : 'Send + a code'),
      h('button', { class: 'link', onclick: () => window.api.igDo('openDm', p.handle, 'dm').then(() => window.api.showInstagram()).catch((e) => toast(errText(e))) }, 'Open the thread'),
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
          S.replies.checking
            ? 'Checking Instagram for replies...'
            : `${st.replies.watch ? `Watching for replies every ${st.replies.everyMin} min` : 'Not watching for replies (Setup)'}${S.replies.lastAt ? ` · last check ${ago(S.replies.lastAt)}: ${S.replies.note}` : sent ? ' · no check yet' : ''}`,
        ),
        h('button', { onclick: () => checkReplies({ manual: true }), disabled: S.replies.checking || !!S.bg.current }, 'Check now'),
      ),
    ),
    !st.claude.key || !st.torrey.key
      ? h(
          'p',
          { class: 'status' },
          [!st.claude.key ? 'Add the Claude API key in Setup so replies are written for each person.' : '', !st.torrey.key ? 'Add the Torrey Labs Cloud key in Setup so partner codes can be issued.' : ''].filter(Boolean).join(' '),
          ' ',
          h('button', { class: 'link', onclick: goSetup }, 'Open Setup'),
        )
      : null,
    h('h2', {}, pending.length ? `Waiting on you (${pending.length})` : 'Nothing waiting on you'),
    pending.length
      ? pending.map(replyCard)
      : h('p', { class: 'muted small' }, 'A clear yes gets their code automatically. A no is marked not interested. Questions and anything unclear show up here with a draft to approve.'),
    done.length ? h('h2', {}, 'Answered') : null,
    done.slice(0, 40).map((p) =>
      h(
        'div',
        { class: 'log-row reply-done' },
        h('span', { class: 'muted small' }, ago(p.reply.sentAt || p.reply.at)),
        h('b', { class: 'small' }, `@${p.handle}`),
        h('span', { class: `small ${p.reply.intent === 'no' ? 'muted' : 'ok'}` }, p.reply.intent === 'no' ? 'said no' : p.reply.dismissed ? 'handled by hand' : p.partner ? `sent their code ${p.partner.code}` : 'replied'),
        p.reply.sent ? h('span', { class: 'muted small', title: p.reply.sent }, `“${p.reply.sent.slice(0, 70)}${p.reply.sent.length > 70 ? '…' : ''}”`) : null,
      ),
    ),
  );
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
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.matchLevels, onchange: check(st, 'matchLevels') }), "Match each lead's intro to the pitch's volume (recommended)"),
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', checked: st.breath, onchange: (e) => (check(st, 'breath')(e), paintBreath()) }),
        "Put one of your pitch's own breaths between the intro and the pitch, so the join sounds natural",
      ),
      h('div', { id: 'breath-info', class: 'row-flex small' }),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.toneMatch, onchange: check(st, 'toneMatch') }), "Match the intro's tone to the pitch (EQ), so a take recorded closer to or farther from the mic still sounds like the same voice"),
      h('p', { class: 'muted small' }, "Fine-tune the join by ear under Listen on any lead's page: play just the join, trim the intro or breath volume, or add silence."),
      h('label', { class: 'field' }, 'Silence before the clip starts in Instagram (ms)', h('input', { type: 'number', min: 0, max: 2000, value: st.leadInMs, oninput: num(st, 'leadInMs') })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.monitorWatching, onchange: check(st, 'monitorWatching') }), 'Play the clip out loud when I use Send while watching (background sends are always silent)'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoOpen, onchange: check(st, 'autoOpen') }), "Open the lead's Instagram profile when I open a lead"),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoSend, onchange: check(st, 'autoSend') }), "Send hits Instagram's send button for me (off: it stops after recording so I can check it and send myself)"),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.engageAfterSend, onchange: check(st, 'engageAfterSend') }), 'After a voice note sends, follow them and like their 1st and 4th posts (pinned posts skipped)'),
    ),

    h('h2', {}, 'Airtable'),
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
      h('label', { class: 'field' }, 'Base ID', h('input', { value: at.baseId, oninput: txt(at, 'baseId') })),
      h('label', { class: 'field' }, 'Table', h('input', { value: at.table, oninput: txt(at, 'table') })),
      h('div', { class: 'row-flex' }, h('button', { id: 'at-test-btn', onclick: testAirtable }, 'Test connection'), h('span', { id: 'at-test', class: 'grow small muted' }, '')),
      h('label', { class: 'field' }, 'Which leads to pull (Airtable formula)', h('textarea', { oninput: txt(at, 'formula') }, at.formula)),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.followGate, onchange: check(st, 'followGate') }), 'Only DM leads the app followed at least a day ago (recommended). Off: Ready leads can be messaged right away.'),
      h('label', { class: 'field' }, 'Max leads per sync', h('input', { type: 'number', min: 1, max: 1000, value: at.max, oninput: num(at, 'max') })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoSync, onchange: check(st, 'autoSync') }), 'Check for new leads on launch and every 15 minutes'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: at.writeBack, onchange: check(at, 'writeBack') }), 'When a note is sent, update Airtable: Status = Sent, Channel = Instagram, Sent at = today, Touches = 1'),
      h('p', { class: 'small' }, h('b', {}, 'Remove lead'), ' (on a lead\'s page) takes it out of the app and:'),
      h('label', { class: 'check' }, h('input', { type: 'radio', name: 'remove-mode', checked: st.removeMode !== 'skip', onchange: () => ((st.removeMode = 'delete'), saveSettings().then(flashSaved)) }), 'deletes its record from Airtable. If Google Maps finds the place again, TL1 adds it back as New.'),
      h('label', { class: 'check' }, h('input', { type: 'radio', name: 'remove-mode', checked: st.removeMode === 'skip', onchange: () => ((st.removeMode = 'skip'), saveSettings().then(flashSaved)) }), 'marks it Skip in Airtable (Status and Track), with the reason. It stays out for good.'),
    ),

    h('h2', {}, 'Replies (Instagram)'),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'muted small' }, 'When someone writes back to a voice note, the app reads the reply in the hidden Instagram tab. A clear yes gets their partner code and invite right away; a no is marked not interested; a question or anything unclear waits under Replies with a draft for you to approve.'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.replies.watch, onchange: check(st.replies, 'watch') }), 'Watch the DM inbox for replies'),
      h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Check every (minutes)', h('input', { type: 'number', min: 1, max: 120, value: st.replies.everyMin, oninput: (e) => ((st.replies.everyMin = Math.min(120, Math.max(1, parseInt(e.target.value, 10) || 5))), saveSettings().then(flashSaved)) })), h('label', { class: 'field' }, 'Sign replies as', h('input', { value: st.replies.from, oninput: txt(st.replies, 'from') }))),
      h('label', { class: 'field' }, 'Claude API key (writes each reply in your voice)', h('input', { type: 'password', value: st.claude.key, oninput: txt(st.claude, 'key'), placeholder: 'sk-ant-...' })),
      h('div', { class: 'row-flex' }, h('button', { onclick: () => testKey('claude'), disabled: !!S.busy }, 'Test Claude'), h('span', { id: 'claude-test', class: 'small muted' })),
      h('p', { class: 'muted small' }, 'Make a key at console.anthropic.com. It stays in this app.'),
      h('label', { class: 'field' }, 'Torrey Labs Cloud URL', h('input', { value: st.torrey.url, oninput: txt(st.torrey, 'url'), placeholder: 'https://xxxx.supabase.co' })),
      h('label', { class: 'field' }, 'Torrey Labs Cloud service role key (issues partner codes)', h('input', { type: 'password', value: st.torrey.key, oninput: txt(st.torrey, 'key') })),
      h('div', { class: 'row-flex' }, h('button', { onclick: () => testKey('torrey'), disabled: !!S.busy }, 'Test Torrey Labs Cloud'), h('span', { id: 'torrey-test', class: 'small muted' })),
      h('p', { class: 'muted small' }, "In Lovable, open the Torrey Labs project's Cloud tab: the project URL and the service role key are in its settings. The key can write to the store's database, so it only ever lives in this app."),
      h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Store address in messages', h('input', { value: st.torrey.site, oninput: txt(st.torrey, 'site') })), h('label', { class: 'field' }, 'Partner share (%)', h('input', { type: 'number', min: 0, max: 50, value: st.torrey.percent, oninput: (e) => ((st.torrey.percent = Math.min(50, Math.max(0, parseInt(e.target.value, 10) || 0))), saveSettings().then(flashSaved)) }))),
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
    h(
      'p',
      { id: 'build', class: 'muted small center' },
      S.build ? `Build ${S.build.commit}, installed ${new Date(S.build.built).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Development build',
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
  if (e.afterSend && (e.result === 'followed' || e.result === 'already')) {
    const likes = e.likes ? `liked ${e.likes} post${e.likes === 1 ? '' : 's'}` : e.private ? 'private, nothing to like' : 'no posts liked';
    return `After the voice note: ${e.result === 'followed' ? 'followed' : 'already following'}, ${likes}`;
  }
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
  const body = S.view === 'setup' ? setupView() : S.view === 'follow' ? followView() : S.view === 'replies' ? repliesView() : p ? detailView(p) : leadsView();
  $app.replaceChildren(header(), queueStrip(), body);
  paintQueue();
  if (S.view === 'setup') paintBreath();
  else if (p && document.getElementById('join-panel')) {
    paintBreath();
    paintJoin(p);
  }
  showRightPane();
}

// The Follow screen puts the follow tab on the right, Watch shows the background send, otherwise the DM tab.
function showRightPane() {
  const want = S.view === 'follow' ? 'follow' : S.watchSend && S.bg.current ? 'send' : 'dm';
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
  };
  // The cap used to default to 100, which is fewer leads than the formula matches.
  if (S.settings.airtable.max === 100) S.settings.airtable.max = DEFAULT_SETTINGS.airtable.max;
  S.prospects = (await store.get('kv', 'prospects')) || [];
  S.removed = { ids: [], handles: [], ...((await store.get('kv', 'removed')) || {}) };
  for (const p of S.prospects.filter((x) => x.status === 'sending')) {
    p.status = 'todo';
    p.sendIssue = 'the app closed before it sent';
  }
  const fixedSegs = S.template.filter((s) => s.kind === 'fixed');
  if (fixedSegs.length && fixedSegs.every((s) => !S.lens[fixedKey(s)])) S.view = 'setup';
  pushFollowConfig();
  S.follow = await window.api.followState();
  render();
  if (S.settings.autoSync) sync({ quiet: true });
  setInterval(() => S.settings.autoSync && sync({ quiet: true }), SYNC_MS);
  setInterval(() => (paintSync(), paintSentToday()), 60 * 1000);
  // Failed sends that went out anyway: a first look a little after launch.
  setTimeout(() => checkFailedSends(), 30 * 1000);
  // Replies: a first look shortly after launch, then on the schedule in Setup.
  setTimeout(() => checkReplies(), 45 * 1000);
  setInterval(() => checkReplies(), 60 * 1000);
})();
