import fs from 'node:fs/promises';
import * as F from './src/follow.js';
import * as leads from './src/leads.js';

const LOG_MAX = 60;
const EMPTY_RETRY_MS = 30 * 60 * 1000;
const ERROR_RETRY_MS = 10 * 60 * 1000;

// Follows and likes one lead at a time in its own Instagram tab, within the pacing in src/follow.js.
// Its counters, pause and log live in a small JSON file so they survive restarts.
export function createFollowRunner({ view, statePath, igBase, click, emit, onFollowed, fast = false }) {
  let state = { enabled: false, stopNote: '', days: {}, pausedUntil: 0, nextAt: 0, skipped: {}, log: [] };
  let at = null;
  let perDay = F.LIMITS.defaultPerDay;
  let timer = null;
  let busy = false;
  let phase = { kind: 'off', until: 0 };
  let queue = [];
  let current = null;

  const save = () => fs.writeFile(statePath, JSON.stringify(state)).catch(() => {});
  const addLog = (entry) => {
    state.log = [{ at: Date.now(), ...entry }, ...state.log].slice(0, LOG_MAX);
  };

  function snapshot() {
    const now = Date.now();
    return {
      enabled: state.enabled,
      stopNote: state.stopNote,
      phase,
      current,
      queue,
      today: F.followedToday(state, now),
      cap: perDay,
      total: Object.values(state.days || {}).reduce((a, b) => a + b, 0),
      skipped: Object.keys(state.skipped).length,
      log: state.log.slice(0, 25),
    };
  }
  const setPhase = (kind, until = 0) => {
    phase = { kind, until };
    emit(snapshot());
  };
  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(tick, Math.max(1000, ms));
  };

  const run = (wc, step) => wc.executeJavaScript(`(${F.followPage})(${JSON.stringify(step)})`, true);
  const open = (wc, url) => wc.loadURL(url).catch(() => {});

  async function visit(handle) {
    const wc = view().webContents;
    await open(wc, `${igBase}/${encodeURIComponent(handle)}/`);
    const p = await run(wc, 'profile');
    if (p.state === 'blocked') return { result: 'blocked', note: p.note };
    if (p.state === 'loggedout') return { result: 'loggedout' };
    if (p.state === 'notfound') return { result: 'notfound' };
    if (!['follow', 'following', 'requested'].includes(p.state)) return { result: 'failed', note: "couldn't find the Follow button" };

    let followed = false;
    let requested = p.state === 'requested';
    if (p.state === 'follow') {
      if (!(await click(wc, await run(wc, 'clickFollow')))) return { result: 'failed', note: "couldn't click Follow" };
      const a = await run(wc, 'afterFollow');
      if (a.state === 'blocked') return { result: 'blocked', note: a.note };
      if (a.state !== 'following' && a.state !== 'requested') return { result: 'failed', clicked: true, note: "couldn't confirm the follow" };
      followed = true;
      requested = a.state === 'requested';
    }

    // Private accounts (or a pending request) have nothing to like.
    const isPrivate = p.private || requested;
    let liked = false;
    if (!isPrivate && p.post) {
      await open(wc, new URL(p.post, igBase).href);
      const post = await run(wc, 'post');
      if (post.state === 'blocked') return { result: 'blocked', followed, note: post.note };
      liked = post.state === 'liked';
      if (post.state === 'like' && (await click(wc, await run(wc, 'clickLike')))) {
        const l = await run(wc, 'afterLike');
        if (l.state === 'blocked') return { result: 'blocked', followed, note: l.note };
        liked = l.state === 'liked';
      }
    }
    return { result: followed ? 'followed' : 'already', followed, liked, private: isPrivate };
  }

  async function settle(lead, r) {
    const now = Date.now();
    // A click that couldn't be confirmed still counts toward today's limit, to stay on the safe side.
    if (r.followed || r.clicked) F.recordFollow(state, now);
    if (r.result === 'blocked') state.pausedUntil = now + F.LIMITS.blockPauseMs;
    if (r.result === 'notfound') state.skipped[lead.id] = 'not found';
    if (r.result === 'loggedout' || r.result === 'failed') {
      state.enabled = false;
      state.stopNote = r.result === 'loggedout' ? 'loggedout' : `${r.note} on @${lead.handle}`;
    }
    state.nextAt = now + (fast ? 1500 : F.randomGap());
    addLog({ handle: lead.handle, result: r.result, followed: !!r.followed, liked: !!r.liked, private: !!r.private, note: r.note || '' });
    await save();
    if (r.followed || r.result === 'already') {
      try {
        await leads.markFollowedAirtable(at, lead.id, r.liked, new Date(now));
        onFollowed({ airtableId: lead.id, followedAt: new Date(now).toISOString() });
      } catch (e) {
        addLog({ handle: lead.handle, result: 'error', note: `Followed, but Airtable said: ${e.message}` });
      }
    }
  }

  async function tick() {
    clearTimeout(timer);
    if (busy) return;
    if (!state.enabled) return setPhase(state.stopNote ? 'stopped' : 'off');
    const now = Date.now();
    const g = F.gate(state, now, perDay);
    if (!g.ok) {
      setPhase(g.reason, g.until);
      return schedule(g.until - now);
    }
    if (!at?.token) return setPhase('setup');

    busy = true;
    let next = 0;
    try {
      setPhase('checking');
      queue = await leads.pullFollowQueue(at, { skip: state.skipped, want: 6 });
      const lead = queue[0];
      if (!lead) {
        setPhase('empty', now + EMPTY_RETRY_MS);
        next = EMPTY_RETRY_MS;
      } else {
        current = lead;
        setPhase('working');
        const r = await visit(lead.handle).catch((e) => ({ result: 'failed', note: e.message }));
        current = null;
        queue = queue.slice(1);
        await settle(lead, r);
      }
    } catch (e) {
      current = null;
      addLog({ result: 'error', note: e.message });
      setPhase('error', now + ERROR_RETRY_MS);
      next = ERROR_RETRY_MS;
    } finally {
      busy = false;
      save();
    }
    if (next) schedule(next);
    else tick();
  }

  return {
    async init() {
      try {
        state = { ...state, ...JSON.parse(await fs.readFile(statePath, 'utf8')) };
      } catch {}
      tick();
    },
    // Airtable details and the daily limit, from the app's settings.
    configure(cfg) {
      at = cfg;
      perDay = F.clampPerDay(cfg.perDay);
      if (!busy && ['setup', 'cap'].includes(phase.kind)) tick();
      else emit(snapshot());
    },
    setEnabled(on) {
      state.enabled = on;
      state.stopNote = '';
      save();
      if (!busy) tick();
      else emit(snapshot());
    },
    snapshot,
  };
}
