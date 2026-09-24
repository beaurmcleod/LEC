import * as store from './store.js';
import * as audio from './audio.js';
import * as leads from './leads.js';

const DEFAULT_TEMPLATE = [
  { id: 'greet', kind: 'slot', label: 'Greeting', script: 'Hi {name}!' },
  { id: 'pitch1', kind: 'fixed', label: 'Pitch, part 1' },
  { id: 'specific', kind: 'slot', label: 'About them', script: "I see you're the {role} at {business}." },
  { id: 'pitch2', kind: 'fixed', label: 'Pitch, part 2' },
];

const DEFAULT_SETTINGS = {
  gapMs: 0,
  leadInMs: 300,
  monitor: true,
  autoOpen: true,
  airtable: {
    token: '',
    baseId: 'appdAJbStcwrV2bq5',
    table: 'Leads',
    formula: "AND({Instagram} != '', OR({Status} = 'New', {Status} = 'Researched', {Status} = 'Ready'), {Track} != 'Skip')",
    max: 100,
    writeBack: true,
  },
  eleven: { key: '', voiceId: '', model: 'eleven_multilingual_v2' },
};

const PLACEHOLDERS = ['name', 'first', 'role', 'business', 'handle', 'note', 'hook', 'category'];
const REFRESH_FIELDS = ['first', 'role', 'business', 'category', 'hook', 'bio', 'research', 'notes'];
const MAX_SECONDS = 59;

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
  clip: null,
  send: { pid: null, state: '', text: '' },
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
const slots = () => S.template.filter((s) => s.kind === 'slot');
const current = () => S.prospects.find((p) => p.id === S.currentId);

const saveTemplate = () => store.put('kv', 'template', S.template);
const saveSettings = () => store.put('kv', 'settings', S.settings);
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
  return S.template.filter((s) => !S.lens[s.kind === 'fixed' ? fixedKey(s) : slotKey(p, s)]);
}

function filtered() {
  if (S.filter === 'all') return S.prospects;
  return S.prospects.filter((p) => p.status === S.filter);
}

// ---------- audio ----------

let player = null;
function stopPlay() {
  if (!player) return;
  try {
    player.src.stop();
  } catch {}
  player.ctx.close();
  player = null;
}

function play(samples) {
  stopPlay();
  const ctx = new AudioContext({ sampleRate: audio.SR });
  const buf = ctx.createBuffer(1, samples.length, audio.SR);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.onended = () => player?.src === src && stopPlay();
  src.start();
  player = { ctx, src };
}

async function playKey(key) {
  const s = await getAudio(key);
  if (s) play(s);
}

let meterTimer;
async function toggleRecord(key) {
  if (S.rec) {
    if (S.rec.key !== key) return toast('Finish the current recording first.');
    return stopRecording();
  }
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
      if (S.clip && key.includes(`:${S.clip.pid}:`)) {
        S.clip = null;
        window.api.disarm();
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
  for (const p of S.prospects.filter((x) => x.status === 'todo')) {
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
  for (const seg of S.template) parts.push(await getAudio(seg.kind === 'fixed' ? fixedKey(seg) : slotKey(p, seg)));
  return audio.concat(parts, S.settings.gapMs);
}

// ---------- the Enter step: splice, save + copy, load into Instagram ----------

const STATUS_TEXT = {
  playing: 'Playing into Instagram...',
  done: 'Clip finished. Hit send in Instagram, then Mark sent.',
  stopped: 'Recording stopped. If it sent, hit Mark sent.',
  idle: 'Unloaded from Instagram.',
};

window.api.onStatus((msg) => {
  if (!S.send.pid) return;
  let text = STATUS_TEXT[msg.state] || '';
  if (msg.state === 'armed') text = `Loaded into Instagram's mic (${fmt(msg.seconds)}). Open their DM on the right and click the mic.`;
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

async function makeClip(p) {
  if (S.rec) return;
  let samples;
  try {
    samples = await buildClip(p);
  } catch (e) {
    return toast(e.message);
  }
  const seconds = samples.length / audio.SR;
  const wav = audio.encodeWav(samples);
  S.clip = { pid: p.id, seconds, file: null };
  setSend(p.id, 'armed', 'Loading into Instagram...');
  render();
  try {
    S.clip.file = await window.api.saveClip(wav, p.handle || p.name);
  } catch (e) {
    toast(`Couldn't save the clip: ${errText(e)}`);
  }
  try {
    await window.api.arm(wav, { label: p.name, leadInMs: S.settings.leadInMs, monitor: S.settings.monitor });
  } catch (e) {
    setSend(p.id, 'error', errText(e));
  }
  if (seconds > MAX_SECONDS) toast('Heads up: this clip is over 60 seconds. Instagram may cut it off.', 7000);
  render();
}

async function grab() {
  let info;
  try {
    info = await window.api.grab();
  } catch (e) {
    return toast(errText(e));
  }
  if (!info?.handle) return toast("Open the person's profile on the right, then grab.");
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

async function merge(incoming) {
  let added = 0;
  let refreshed = 0;
  for (const inc of incoming) {
    const ex = S.prospects.find(
      (p) =>
        (inc.airtableId && p.airtableId === inc.airtableId) ||
        (inc.handle && p.handle && p.handle.toLowerCase() === inc.handle.toLowerCase()),
    );
    if (ex) {
      for (const k of REFRESH_FIELDS) if (inc[k]) ex[k] = inc[k];
      ex.airtableId ||= inc.airtableId;
      refreshed++;
    } else {
      S.prospects.push(inc);
      added++;
    }
  }
  await saveProspects();
  return { added, refreshed };
}

async function pullAirtable() {
  const at = S.settings.airtable;
  if (!at.token) {
    S.view = 'setup';
    render();
    return toast('Add your Airtable token first (Setup > Airtable).');
  }
  setBusy('Pulling leads from Airtable...');
  try {
    const { added, refreshed } = await merge(await window.api.pullAirtable(at));
    toast(`${added} new lead${added === 1 ? '' : 's'}, ${refreshed} refreshed.`);
  } catch (e) {
    toast(`Airtable: ${errText(e)}`, 8000);
  }
  setBusy('');
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
  if (S.clip?.pid !== id) S.clip = null;
  render();
  window.scrollTo(0, 0);
  const p = current();
  if (openProfile && S.settings.autoOpen && p?.handle) window.api.openProfile(p.handle).catch(() => {});
}

function nextTodo(fromId) {
  const list = S.prospects.filter((p) => p.status === 'todo' && p.id !== fromId);
  const i = S.prospects.findIndex((p) => p.id === fromId);
  return list.find((p) => S.prospects.indexOf(p) > i) || list[0] || null;
}

async function setStatus(p, status) {
  p.status = status;
  p.sentAt = status === 'sent' ? Date.now() : null;
  await saveProspects();
  const at = S.settings.airtable;
  if (status === 'sent' && at.writeBack && at.token && p.airtableId) {
    window.api.markSent(at, p.airtableId).catch((e) => toast(`Marked sent here, but Airtable said: ${errText(e)}`, 8000));
  }
  if (status === 'todo') return render();
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
  S.template.push({ id: leads.uid(), kind, label: kind === 'fixed' ? 'New recorded part' : 'New custom line', script: '' });
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
    { class: on ? 'rec' : '', onclick: () => toggleRecord(key), disabled: !!S.rec && !on },
    on ? ['Stop ', h('span', { id: 'rec-timer' }, '0.0s')] : S.lens[key] ? 'Redo' : label,
  );
}

function meter(key) {
  return S.rec?.key === key ? h('div', { class: 'meter' }, h('div', { id: 'rec-meter' })) : null;
}

function header() {
  const tab = (id, label) =>
    h('button', { class: `tab ${S.view === id ? 'on' : ''}`, onclick: () => ((S.view = id), render()) }, label);
  return h('header', { class: 'top' }, h('h1', {}, 'Torrey Voice Notes'), h('div', { class: 'tabs' }, tab('leads', 'Leads'), tab('setup', 'Setup')));
}

function leadsView() {
  const count = (st) => S.prospects.filter((p) => p.status === st).length;
  const chip = (id, label) =>
    h('button', { class: `tab ${S.filter === id ? 'on' : ''}`, onclick: () => ((S.filter = id), render()) }, label);
  const file = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: (e) => e.target.files[0] && importCSV(e.target.files[0]) });
  const list = filtered();
  const need = missingFixed();

  return h(
    'main',
    {},
    need.length
      ? h('div', { class: 'status error' }, `Record your pitch first: ${need.map((s) => s.label).join(', ')}. `, h('button', { class: 'link', onclick: () => ((S.view = 'setup'), render()) }, 'Go to Setup'))
      : null,
    h(
      'div',
      { class: 'row-flex' },
      h('button', { class: 'primary', onclick: pullAirtable, disabled: !!S.busy }, 'Pull from Airtable'),
      h('button', { onclick: () => file.click() }, 'Import CSV'),
      h('button', { onclick: grab }, 'Grab from IG'),
      h('button', { onclick: addManual }, '+ Add'),
      file,
    ),
    ttsReady() ? h('button', { onclick: autoVoiceAll, disabled: !!S.busy }, 'Auto-voice all missing lines') : null,
    S.busy ? h('p', { class: 'muted small' }, S.busy) : null,
    h('div', { class: 'row-flex' }, chip('todo', `To do (${count('todo')})`), chip('sent', `Sent (${count('sent')})`), chip('skipped', `Skipped (${count('skipped')})`), chip('all', 'All')),
    list.length
      ? h('div', { class: 'list' }, list.map(leadRow))
      : h('p', { class: 'muted' }, S.prospects.length ? 'Nothing here.' : 'No leads yet. Pull them from Airtable, import a CSV, or open a profile on the right and hit Grab from IG.'),
  );
}

function leadRow(p) {
  const total = S.template.length;
  const done = total - missingParts(p).length;
  let pill;
  if (p.status === 'sent') pill = h('span', { class: 'tag ok' }, 'sent');
  else if (p.status === 'skipped') pill = h('span', { class: 'tag' }, 'skipped');
  else if (done === total) pill = h('span', { class: 'tag ok' }, 'ready');
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
    pill,
  );
}

function field(label, value, onInput, attrs = {}) {
  return h('label', { class: 'field' }, label, h('input', { value, oninput: (e) => onInput(e.target.value), ...attrs }));
}

function detailView(p) {
  const list = filtered();
  const idx = list.indexOf(p);
  const go = (d) => list[idx + d] && openLead(list[idx + d].id);
  const edit = (k) => (v) => {
    p[k] = k === 'handle' ? leads.cleanHandle(v) : v;
    saveProspects();
    if (S.clip?.pid === p.id) S.clip.stale = true;
    for (const el of document.querySelectorAll('[data-seg]')) {
      el.textContent = renderScript(S.template.find((s) => s.id === el.dataset.seg).script, p);
    }
  };
  const ref = [
    ['Category', p.category],
    ['Personal hook', p.hook],
    ['IG bio', p.bio],
    ['Research', p.research],
    ['Notes', p.notes],
  ].filter(([, v]) => v);
  const missing = missingParts(p);
  const sendStatus = S.send.pid === p.id ? S.send : { state: '', text: '' };
  const clip = S.clip?.pid === p.id ? S.clip : null;

  return h(
    'main',
    {},
    h(
      'div',
      { class: 'row-flex' },
      h('button', { onclick: () => ((S.currentId = null), render()) }, '< All leads'),
      h('span', { class: 'grow' }),
      h('button', { onclick: () => go(-1), disabled: idx <= 0 }, 'Prev'),
      h('button', { onclick: () => go(1), disabled: idx < 0 || idx >= list.length - 1 }, 'Next'),
    ),
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'lead-title' }, h('b', {}, p.name || '(no name)'), p.handle ? h('button', { class: 'link', onclick: () => window.api.openProfile(p.handle) }, `@${p.handle}`) : null),
      h('div', { class: 'grid2' }, field('Name to say', p.name, edit('name')), field('Role', p.role, edit('role'), { placeholder: 'e.g. owner, head coach' })),
      h('div', { class: 'grid2' }, field('Business', p.business, edit('business')), field('Instagram', p.handle, edit('handle'), { placeholder: 'handle' })),
      field('What they do', p.note, edit('note'), { placeholder: 'e.g. small group training' }),
      ref.length ? h('details', { class: 'ref' }, h('summary', {}, 'Lead info'), h('dl', {}, ref.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))) : null,
    ),
    h('h2', {}, 'Record the custom part'),
    slots().map((seg) => {
      const key = slotKey(p, seg);
      const len = S.lens[key];
      return h(
        'div',
        { class: `card rec-box ${S.rec?.key === key ? 'live' : ''}` },
        h('div', { class: 'row-flex' }, h('span', { class: 'tag' }, seg.label), len ? h('span', { class: 'tag ok' }, secs(len)) : h('span', { class: 'tag warn' }, 'not recorded')),
        h('div', { class: 'script', 'data-seg': seg.id }, renderScript(seg.script, p)),
        meter(key),
        h(
          'div',
          { class: 'row-flex' },
          recButton(key),
          h('button', { onclick: () => playKey(key), disabled: !len }, 'Play'),
          ttsReady() ? h('button', { onclick: () => autoVoiceOne(p, seg), disabled: !!S.busy || !!S.rec }, 'Auto-voice') : null,
        ),
      );
    }),
    h('p', { class: 'muted small' }, 'Space records the next missing line and stops it. Enter makes the clip.'),
    S.busy ? h('p', { class: 'muted small' }, S.busy) : null,
    h(
      'button',
      { class: 'enter', onclick: () => makeClip(p), disabled: !!missing.length || !!S.rec, title: missing.length ? `Still needs: ${missing.map((s) => s.label).join(', ')}` : '' },
      h('span', {}, 'Enter'),
      missing.length ? ` Still needs: ${missing.map((s) => s.label).join(', ')}` : ' Make the clip',
    ),
    clip
      ? h(
          'div',
          { class: 'card clip' },
          h('div', { class: 'row-flex' }, h('b', { class: 'grow' }, `Clip ready (${fmt(clip.seconds)})`), clip.file ? h('span', { class: 'tag ok' }, 'copied') : null),
          clip.stale ? h('p', { class: 'warn small' }, 'You changed details after making this. Press Enter again if the lines changed.') : null,
          h(
            'div',
            { class: 'row-flex' },
            h('button', { onclick: () => buildClip(p).then(play).catch((e) => toast(e.message)) }, 'Play'),
            h('button', { onclick: stopPlay }, 'Stop'),
            clip.file ? h('button', { onclick: () => makeClip(p) }, 'Copy again') : null,
            clip.file ? h('button', { onclick: () => window.api.reveal(clip.file) }, 'Show in Finder') : null,
            h('button', { onclick: () => window.api.disarm() }, 'Unload'),
          ),
        )
      : null,
    h('p', { id: 'send-status', class: `status ${sendStatus.state}`, hidden: !sendStatus.text }, sendStatus.text),
    p.status === 'todo'
      ? h('div', { class: 'row-flex' }, h('button', { class: 'primary', onclick: () => setStatus(p, 'sent') }, 'Mark sent, next lead'), h('button', { onclick: () => setStatus(p, 'skipped') }, 'Skip'))
      : h('div', { class: 'row-flex' }, h('span', { class: 'tag' }, p.status), h('button', { onclick: () => setStatus(p, 'todo') }, 'Move back to to-do')),
    h('button', { class: 'link', onclick: () => deleteLead(p) }, 'Delete this lead'),
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
    h('input', { value: seg.label, 'aria-label': 'Part name', oninput: (e) => ((seg.label = e.target.value), saveTemplate()) }),
    fixed
      ? [
          meter(key),
          h(
            'div',
            { class: 'row-flex' },
            recButton(key),
            h('button', { onclick: () => playKey(key), disabled: !S.lens[key] }, 'Play'),
            h('button', { onclick: () => file.click() }, 'Upload file'),
            S.lens[key] ? h('span', { class: 'tag ok' }, secs(S.lens[key])) : h('span', { class: 'tag warn' }, 'empty'),
            file,
          ),
        ]
      : h('label', { class: 'field' }, 'What you say (per lead)', h('input', { value: seg.script, placeholder: 'Hi {name}!', oninput: (e) => ((seg.script = e.target.value), saveTemplate()) })),
  );
}

function setupView() {
  const st = S.settings;
  const at = st.airtable;
  const el = st.eleven;
  const num = (obj, k) => (e) => {
    obj[k] = Math.max(0, parseInt(e.target.value, 10) || 0);
    saveSettings();
  };
  const txt = (obj, k) => (e) => {
    obj[k] = e.target.value.trim();
    saveSettings();
  };
  const check = (obj, k) => (e) => {
    obj[k] = e.target.checked;
    saveSettings();
  };
  const total = S.template.filter((s) => s.kind === 'fixed').reduce((n, s) => n + (S.lens[fixedKey(s)] || 0), 0);

  return h(
    'main',
    {},
    h('h2', {}, 'How it works'),
    h(
      'ol',
      { class: 'steps' },
      h('li', {}, 'Record your pitch parts below once. Use the same mic and spot you will use for the custom lines.'),
      h('li', {}, 'Pull your leads from Airtable. Opening a lead opens their Instagram on the right.'),
      h('li', {}, 'Record the custom lines (Space), then press Enter. The clip is spliced, saved, copied, and loaded into Instagram.'),
      h('li', {}, 'Open their DM on the right, click the mic, and hit send when it finishes.'),
    ),
    h('h2', {}, 'Your voice note, in order'),
    S.template.map(segmentCard),
    h('div', { class: 'row-flex' }, h('button', { onclick: () => addSegment('fixed') }, '+ Recorded-once part'), h('button', { onclick: () => addSegment('slot') }, '+ Custom line')),
    h('p', { class: 'muted small' }, `Custom lines can use: ${PLACEHOLDERS.map((k) => `{${k}}`).join(' ')}. Recorded parts total ${secs(total)}; keep the whole note under 60s.`),

    h('h2', {}, 'Splicing'),
    h(
      'div',
      { class: 'card' },
      h('label', { class: 'field' }, 'Extra pause between parts (ms, 0 = seamless crossfade)', h('input', { type: 'number', min: 0, max: 1000, value: st.gapMs, onchange: num(st, 'gapMs') })),
      h('label', { class: 'field' }, 'Silence before the clip starts in Instagram (ms)', h('input', { type: 'number', min: 0, max: 2000, value: st.leadInMs, onchange: num(st, 'leadInMs') })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.monitor, onchange: check(st, 'monitor') }), 'Play the clip out loud while it goes into Instagram'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.autoOpen, onchange: check(st, 'autoOpen') }), "Open the lead's Instagram profile when I open a lead"),
    ),

    h('h2', {}, 'Airtable'),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'muted small' }, 'Make a personal access token at airtable.com/create/tokens with data.records:read and data.records:write, limited to the Torrey Labs base.'),
      h('label', { class: 'field' }, 'Token', h('input', { type: 'password', value: at.token, placeholder: 'pat...', onchange: txt(at, 'token') })),
      h('label', { class: 'field' }, 'Base ID', h('input', { value: at.baseId, onchange: txt(at, 'baseId') })),
      h('label', { class: 'field' }, 'Table', h('input', { value: at.table, onchange: txt(at, 'table') })),
      h('label', { class: 'field' }, 'Which leads to pull (Airtable formula)', h('textarea', { onchange: txt(at, 'formula') }, at.formula)),
      h('label', { class: 'field' }, 'Max leads per pull', h('input', { type: 'number', min: 1, max: 1000, value: at.max, onchange: num(at, 'max') })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: at.writeBack, onchange: check(at, 'writeBack') }), 'When I hit Mark sent, update Airtable: Status = Sent, Channel = Instagram, Sent at = today'),
    ),

    h('h2', {}, 'Auto-voice (optional)'),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'muted small' }, "Skip recording each lead's lines: an ElevenLabs clone of your voice says them instead. Leave blank to record them yourself."),
      h('label', { class: 'field' }, 'ElevenLabs API key', h('input', { type: 'password', value: el.key, onchange: txt(el, 'key') })),
      h('label', { class: 'field' }, 'Voice ID (your cloned voice)', h('input', { value: el.voiceId, onchange: txt(el, 'voiceId') })),
      h('label', { class: 'field' }, 'Model', h('input', { value: el.model, onchange: txt(el, 'model') })),
    ),
  );
}

function render() {
  const p = current();
  if (S.currentId && !p) S.currentId = null;
  const body = S.view === 'setup' ? setupView() : p ? detailView(p) : leadsView();
  $app.replaceChildren(header(), body);
}

// ---------- keyboard ----------

document.addEventListener('keydown', (e) => {
  if (e.repeat || e.target.closest?.('input, textarea, select, button')) return;
  const p = current();
  if (e.code === 'Space') {
    e.preventDefault();
    if (S.rec) return stopRecording();
    if (S.view !== 'leads' || !p) return;
    const seg = slots().find((s) => !S.lens[slotKey(p, s)]);
    if (seg) toggleRecord(slotKey(p, seg));
  } else if (e.key === 'Enter' && S.view === 'leads' && p) {
    e.preventDefault();
    makeClip(p);
  }
});

// ---------- boot ----------

(async () => {
  S.template = (await store.get('kv', 'template')) || structuredClone(DEFAULT_TEMPLATE);
  const saved = (await store.get('kv', 'settings')) || {};
  S.settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    airtable: { ...DEFAULT_SETTINGS.airtable, ...saved.airtable },
    eleven: { ...DEFAULT_SETTINGS.eleven, ...saved.eleven },
  };
  S.prospects = (await store.get('kv', 'prospects')) || [];
  S.lens = (await store.get('kv', 'lens')) || {};
  const fixedSegs = S.template.filter((s) => s.kind === 'fixed');
  if (fixedSegs.length && fixedSegs.every((s) => !S.lens[fixedKey(s)])) S.view = 'setup';
  render();
})();
