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
  const pause = () => new Promise((r) => setTimeout(r, fast ? 100 : 1500 + Math.random() * 2500));

  // Follows the account in `wc` if needed, then likes the posts at `likeAt` (0 = newest; pinned posts don't
  // count). Posts already liked are left alone.
  async function visit(wc, handle, likeAt = [0]) {
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
    let likes = 0;
    const hrefs = isPrivate ? [] : likeAt.map((i) => p.posts[i]).filter(Boolean);
    for (const href of hrefs) {
      await pause();
      await open(wc, new URL(href, igBase).href);
      const post = await run(wc, 'post');
      if (post.state === 'blocked') return { result: 'blocked', followed, liked: likes > 0, likes, note: post.note };
      if (post.state === 'liked') likes++;
      else if (post.state === 'like' && (await click(wc, await run(wc, 'clickLike')))) {
        const l = await run(wc, 'afterLike');
        if (l.state === 'blocked') return { result: 'blocked', followed, liked: likes > 0, likes, note: l.note };
        if (l.state === 'liked') likes++;
      }
    }
    return { result: followed ? 'followed' : 'already', followed, liked: likes > 0, likes, private: isPrivate };
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
        const r = await visit(view().webContents, lead.handle).catch((e) => ({ result: 'failed', note: e.message }));
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
    // After a voice note sends: follow them and like their 1st and 4th posts, in the tab that sent it. Skipped
    // while Instagram's push-back pause is on; a new push-back starts one. Follows count toward today's total.
    async engage(wc, { handle, airtableId }) {
      const now = Date.now();
      if (state.pausedUntil > now) return { result: 'paused', until: state.pausedUntil };
      const r = await visit(wc, handle, [0, 3]).catch((e) => ({ result: 'failed', note: e.message }));
      if (r.followed || r.clicked) F.recordFollow(state, now);
      if (r.result === 'blocked') state.pausedUntil = now + F.LIMITS.blockPauseMs;
      addLog({ handle, result: r.result, followed: !!r.followed, liked: !!r.liked, likes: r.likes || 0, private: !!r.private, note: r.note || '', afterSend: true });
      await save();
      emit(snapshot());
      if (airtableId && at?.token) {
        try {
          if (r.followed) {
            await leads.markFollowedAirtable(at, airtableId, r.liked, new Date(now));
            onFollowed({ airtableId, followedAt: new Date(now).toISOString() });
          } else if (r.liked) await leads.markLikedAirtable(at, airtableId);
        } catch (e) {
          addLog({ handle, result: 'error', note: `Followed, but Airtable said: ${e.message}` });
        }
      }
      return r;
    },
    setEnabled(on) {
      state.enabled = on;
      state.stopNote = '';
      save();
      if (!busy) tick();
      else emit(snapshot());
    },
    // The finder works in this same tab between follows: waits for a visit to finish, runs `fn`, then carries on.
    async exclusive(fn) {
      while (busy) await new Promise((r) => setTimeout(r, 400));
      busy = true;
      try {
        return await fn();
      } finally {
        busy = false;
        if (state.enabled) tick();
      }
    },
    // Instagram's push-back pause is shared, so a block while searching also holds the follows for 48 hours.
    pausedUntil: () => state.pausedUntil,
    pushedBack(note) {
      state.pausedUntil = Date.now() + F.LIMITS.blockPauseMs;
      addLog({ result: 'blocked', note: `${note} (while searching hashtags)` });
      save();
      emit(snapshot());
    },
    snapshot,
  };
}
