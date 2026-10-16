import fs from 'node:fs/promises';
import * as F from './src/follow.js';
import * as N from './src/find.js';
import * as leads from './src/leads.js';

const LOG_MAX = 60;
const FOUND_MAX = 200;
const SEEN_MAX = 4000;
const ERROR_RETRY_MS = 10 * 60 * 1000;
const KNOWN_TTL_MS = 30 * 60 * 1000;
const MAX_FAILS = 3;

// Instagram's own answers about a hashtag, parsed, for the accounts in them. Watches the tab while `fn` runs. Only
// requests that are about the hashtag count: the page also asks for other things (the stories tray, suggestions)
// that name people who have nothing to do with it.
async function capture(wc, tag, fn) {
  const got = { bodies: [], pending: [], note: '' };
  const dbg = wc.debugger;
  let mine = false;
  try {
    if (!dbg.isAttached()) {
      dbg.attach('1.3');
      mine = true;
    }
  } catch (e) {
    got.note = `couldn't watch Instagram's answers (${e.message})`;
  }
  const urls = new Set();
  const about = (request) => {
    const sent = `${request.url} ${request.postData || ''}`;
    if (/\/api\/v1\/tags\//.test(request.url)) return true;
    return /\/api\/graphql|\/graphql\/query/.test(request.url) && (/friendly_name=\w*(tag|hashtag)/i.test(sent) || sent.toLowerCase().includes(tag));
  };
  const onMessage = (_e, method, params) => {
    if (method === 'Network.requestWillBeSent') {
      if (about(params.request)) urls.add(params.requestId);
    } else if (method === 'Network.loadingFinished' && urls.has(params.requestId)) {
      got.pending.push(
        dbg
          .sendCommand('Network.getResponseBody', { requestId: params.requestId })
          .then((b) => {
            const text = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : String(b.body);
            if (text.length > 4e6) return;
            const clean = text.replace(/^\s*for \(;;\);/, '');
            try {
              got.bodies.push(JSON.parse(clean));
            } catch {
              for (const line of clean.split('\n')) {
                try {
                  got.bodies.push(JSON.parse(line));
                } catch {}
              }
            }
          })
          .catch(() => {}),
      );
    }
  };
  if (dbg.isAttached()) {
    dbg.on('message', onMessage);
    await dbg.sendCommand('Network.enable').catch(() => {});
  }
  got.authors = async () => {
    await Promise.allSettled(got.pending);
    return N.authorsFromJson(got.bodies);
  };
  try {
    return await fn(got);
  } finally {
    dbg.removeListener('message', onMessage);
    if (mine) {
      await dbg.sendCommand('Network.disable').catch(() => {});
      try {
        dbg.detach();
      } catch {}
    }
  }
}

// Searches hashtags and reads the accounts behind them, one page at a time, in the follow tab. Reads only:
// it never follows, likes or messages anyone. Each new account is saved to Airtable's IG Prospects table as New
// for the daily sort. It shares the tab and Instagram's push-back pause with the follower.
export function createFindRunner({ view, statePath, igBase, follower, snap, emit, fast = false }) {
  let state = { enabled: false, stopNote: '', days: {}, nextAt: 0, tags: {}, seen: {}, pending: [], found: [], log: [], fails: 0 };
  let at = null;
  let perDay = N.LIMITS.defaultPerDay;
  let tags = [];
  let timer = null;
  let busy = false;
  let phase = { kind: 'off', until: 0 };
  let current = null;
  let known = { at: 0, set: new Set() };

  const save = () => {
    const keys = Object.keys(state.seen);
    if (keys.length > SEEN_MAX) {
      const keep = keys.sort((a, b) => state.seen[b] - state.seen[a]).slice(0, SEEN_MAX);
      state.seen = Object.fromEntries(keep.map((k) => [k, state.seen[k]]));
    }
    return fs.writeFile(statePath, JSON.stringify(state)).catch(() => {});
  };
  const addLog = (entry) => {
    state.log = [{ at: Date.now(), ...entry }, ...state.log].slice(0, LOG_MAX);
  };

  function snapshot() {
    const now = Date.now();
    const total = Object.values(state.days || {}).reduce((a, d) => ({ read: a.read + (d.read || 0), saved: a.saved + (d.saved || 0) }), { read: 0, saved: 0 });
    return {
      enabled: state.enabled,
      stopNote: state.stopNote,
      phase,
      current,
      pending: state.pending.length,
      read: N.readToday(state, now),
      saved: N.savedToday(state, now),
      tagsDone: N.tagsToday(state, now),
      cap: perDay,
      total,
      tags: tags.map((t) => ({ tag: t, at: state.tags[t]?.at || 0, found: state.tags[t]?.found ?? null })),
      found: state.found.slice(0, 60),
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

  const run = (wc, step, arg) => wc.executeJavaScript(`(${N.findPage})(${JSON.stringify(step)}, ${JSON.stringify(arg ?? null)})`, true);
  const open = (wc, url) => wc.loadURL(url).catch(() => {});
  const pause = () => new Promise((r) => setTimeout(r, fast ? 100 : 2500 + Math.random() * 3000));

  async function knownHandles(force = false) {
    if (!force && Date.now() - known.at < KNOWN_TTL_MS) return known.set;
    const [a, b] = await Promise.all([leads.pullProspectHandles(at), leads.pullLeadHandles(at)]);
    known = { at: Date.now(), set: new Set([...a, ...b]) };
    return known.set;
  }

  const stopWith = (note) => {
    state.enabled = false;
    state.stopNote = note;
  };

  // A hashtag page: the accounts in Instagram's own answers, or, when those have none, the authors of the first
  // few posts. Returns { state, authors, tiles, via } or the page's problem (blocked, loggedout, notfound, empty).
  async function searchTag(wc, tag) {
    return capture(wc, tag, async (got) => {
      await open(wc, `${igBase}/explore/tags/${encodeURIComponent(tag)}/`);
      const p = await run(wc, 'tag', N.LIMITS.scrolls);
      if (p.state !== 'ok') return { ...p, tag };
      let authors = await got.authors();
      let via = 'data';
      if (!authors.length) {
        via = 'posts';
        for (const t of p.tiles.slice(0, N.LIMITS.probePosts)) {
          await pause();
          await open(wc, new URL(t.href, igBase).href);
          const q = await run(wc, 'post');
          if (q.state === 'blocked' || q.state === 'loggedout') return { state: q.state, note: q.note, tag };
          if (q.state === 'ok' && q.author) {
            authors.push({ username: q.author, fullName: '', caption: q.caption, location: q.location, takenAt: Math.round(Date.parse(q.date) / 1000) || 0 });
          }
        }
      }
      return { state: 'ok', tag, tiles: p.tiles.length, authors, via, note: got.note };
    });
  }

  // A profile and its newest posts. Returns { result: 'ok', info } or the page's problem.
  async function readProfile(wc, handle) {
    await open(wc, `${igBase}/${encodeURIComponent(handle)}/`);
    const p = await run(wc, 'profile');
    if (p.state === 'blocked') return { result: 'blocked', note: p.note };
    if (p.state === 'loggedout') return { result: 'loggedout' };
    if (p.state === 'notfound') return { result: 'notfound' };
    if (p.state !== 'ok') return { result: 'failed', note: "the profile page didn't load" };
    const info = {
      ...p.info,
      followers: N.parseCount(p.info.followers),
      postsCount: N.parseCount(p.info.postsCount),
      posts: [],
      tileDates: p.tiles.map((t) => N.dateFromAlt(t.alt)).filter(Boolean),
    };
    const want = info.private ? [] : p.tiles.filter((t) => !t.pinned).slice(0, N.LIMITS.postsPerProfile);
    for (const t of want) {
      await pause();
      await open(wc, new URL(t.href, igBase).href);
      const q = await run(wc, 'post');
      if (q.state === 'blocked') return { result: 'blocked', note: q.note };
      if (q.state === 'loggedout') return { result: 'loggedout' };
      if (q.state === 'ok') info.posts.push({ date: q.date, caption: q.caption, location: q.location });
    }
    return { result: 'ok', info };
  }

  const pushedBack = (note) => follower.pushedBack(note);

  async function searchOne(now, wc) {
    if (!tags.length) return { phase: ['notags'] };
    const t = N.nextTag(state, tags, now);
    if (!t.tag) return { phase: ['idle', t.until] };
    if (N.tagsToday(state, now) >= N.LIMITS.maxTagsPerDay) return { phase: ['idle', F.nextDay(now)] };
    setPhase('tag');
    current = { tag: t.tag };
    emit(snapshot());
    const skip = await knownHandles(true);
    const r = await searchTag(wc, t.tag).catch((e) => ({ state: 'failed', note: e.message, tag: t.tag }));
    current = null;
    state.tags[t.tag] = { at: now, found: r.state === 'ok' ? r.authors.length : 0 };
    N.record(state, now, 'tags');
    state.nextAt = now + (fast ? 1500 : N.LIMITS.tagGapMs + Math.random() * 30000);
    if (r.state === 'blocked') {
      pushedBack(r.note);
      addLog({ tag: t.tag, result: 'blocked', note: r.note });
    } else if (r.state === 'loggedout') {
      stopWith('loggedout');
      addLog({ tag: t.tag, result: 'loggedout' });
    } else if (r.state === 'notfound' || r.state === 'empty') {
      addLog({ tag: t.tag, result: 'empty', note: r.state === 'notfound' ? 'Instagram has no page for this hashtag' : 'no posts on the hashtag page' });
    } else if (r.state !== 'ok') {
      state.fails++;
      const file = await snap(`find-tag-${t.tag}`, `Hashtag #${t.tag} failed: ${r.note || r.state}`).catch(() => '');
      addLog({ tag: t.tag, result: 'failed', note: r.note || "the hashtag page didn't load", diag: file });
    } else {
      const pendingSet = new Set(state.pending.map((x) => x.handle));
      const fresh = [];
      for (const a of r.authors) {
        const handle = N.cleanUser(a.username);
        if (!N.validUser(handle) || skip.has(handle) || state.seen[handle] || pendingSet.has(handle)) continue;
        pendingSet.add(handle);
        fresh.push({ handle, tag: t.tag, caption: a.caption || '', location: a.location || '', name: a.fullName || '' });
        if (fresh.length >= N.LIMITS.perTag) break;
      }
      state.pending.push(...fresh);
      if (!r.authors.length) {
        state.fails++;
        const file = await snap(`find-tag-${t.tag}`, `Hashtag #${t.tag}: ${r.tiles} post tiles on the page but no accounts found in Instagram's answers or in the posts opened (${r.note || 'no note'})`).catch(() => '');
        addLog({ tag: t.tag, result: 'failed', note: `saw ${r.tiles} posts but couldn't tell who posted them`, diag: file });
      } else {
        state.fails = 0;
        addLog({ tag: t.tag, result: 'searched', found: fresh.length, of: r.authors.length, via: r.via });
      }
    }
    return {};
  }

  async function readOne(now, wc) {
    const item = state.pending[0];
    if (state.seen[item.handle] || (await knownHandles()).has(item.handle)) {
      state.pending.shift();
      state.nextAt = 0;
      return {};
    }
    setPhase('profile');
    current = { handle: item.handle };
    emit(snapshot());
    const r = await readProfile(wc, item.handle).catch((e) => ({ result: 'failed', note: e.message }));
    current = null;
    state.nextAt = now + (fast ? 1500 : N.randomGap());
    if (r.result === 'blocked') {
      pushedBack(r.note);
      addLog({ handle: item.handle, result: 'blocked', note: r.note });
    } else if (r.result === 'loggedout') {
      stopWith('loggedout');
      addLog({ handle: item.handle, result: 'loggedout' });
    } else if (r.result === 'notfound') {
      state.pending.shift();
      state.seen[item.handle] = now;
      N.record(state, now, 'read');
      addLog({ handle: item.handle, result: 'notfound' });
    } else if (r.result === 'failed') {
      state.fails++;
      item.tries = (item.tries || 0) + 1;
      state.pending.shift();
      if (item.tries < 2) state.pending.push(item);
      else state.seen[item.handle] = now;
      const file = await snap(`find-profile-${item.handle}`, `Profile @${item.handle} failed: ${r.note}`).catch(() => '');
      addLog({ handle: item.handle, result: 'failed', note: r.note, diag: file });
    } else {
      const info = r.info;
      const fields = N.prospectFields({ ...info, handle: info.handle || item.handle }, item);
      let id = '';
      try {
        id = await leads.createProspect(at, fields);
      } catch (e) {
        if (/Couldn't reach Airtable/.test(e.message)) throw e;
        stopWith(`Airtable wouldn't take the new account: ${e.message}`);
        addLog({ handle: item.handle, result: 'error', note: e.message });
        return {};
      }
      state.pending.shift();
      state.seen[item.handle] = now;
      known.set.add(item.handle);
      state.fails = 0;
      N.record(state, now, 'read');
      N.record(state, now, 'saved');
      state.found = [
        {
          at: now,
          handle: item.handle,
          name: info.fullName || '',
          category: info.category || '',
          followers: info.followers ?? null,
          bio: (info.bio || '').split('\n')[0].slice(0, 140),
          tag: item.tag,
          private: !!info.private,
          id,
        },
        ...state.found,
      ].slice(0, FOUND_MAX);
      addLog({ handle: item.handle, result: 'saved', note: [info.fullName, info.category].filter(Boolean).join(' · '), tag: item.tag });
    }
    return {};
  }

  async function tick() {
    clearTimeout(timer);
    if (busy) return;
    if (!state.enabled) return setPhase(state.stopNote ? 'stopped' : 'off');
    if (!at?.token) return setPhase('setup');
    const now = Date.now();
    const g = N.gate(state, now, perDay, follower.pausedUntil());
    if (!g.ok) {
      setPhase(g.reason, g.until);
      return schedule(g.until - now);
    }
    busy = true;
    let next = 0;
    try {
      const out = await follower.exclusive(() => {
        const wc = view().webContents;
        return state.pending.length ? readOne(now, wc) : searchOne(now, wc);
      });
      if (out?.phase) {
        // Nothing to do right now (no hashtags, or every hashtag was searched recently).
        const [kind, until] = out.phase;
        setPhase(kind, until || 0);
        next = until ? until - Date.now() : 0;
        busy = false;
        await save();
        if (next) schedule(next);
        return;
      }
      if (state.fails >= MAX_FAILS && state.enabled) {
        stopWith("Instagram's pages didn't read the way the app expects (see Recent, and the saved picture)");
        state.fails = 0;
      }
    } catch (e) {
      current = null;
      addLog({ result: 'error', note: e.message });
      setPhase('error', now + ERROR_RETRY_MS);
      next = ERROR_RETRY_MS;
    } finally {
      busy = false;
      await save();
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
    // Airtable details, the daily limit and the hashtags, from the app's settings.
    configure(cfg) {
      at = cfg;
      perDay = N.clampPerDay(cfg.perDay);
      tags = N.parseTags(cfg.tags);
      if (!busy && ['setup', 'cap', 'notags', 'idle'].includes(phase.kind)) tick();
      else emit(snapshot());
    },
    setEnabled(on) {
      state.enabled = on;
      state.stopNote = '';
      state.fails = 0;
      save();
      if (!busy) tick();
      else emit(snapshot());
    },
    // What the daily sort decided about accounts the finder saved.
    async verdicts(handles) {
      if (!at?.token) return {};
      return leads.pullProspectVerdicts(at, handles);
    },
    // One hashtag and one profile, read the way a run would, saving nothing. Says what it saw.
    async test(tag) {
      const t = N.cleanTag(tag) || tags[0];
      if (!t) return 'Add a hashtag first.';
      return follower.exclusive(async () => {
        const wc = view().webContents;
        const lines = [];
        const say = (s) => lines.push(s);
        const finish = async (failed) => {
          say('Nothing was saved.');
          if (failed) {
            const file = await snap('find-test', lines.join('\n')).catch(() => '');
            if (file) say(`A picture and the page's details were saved: ${file}`);
          }
          return lines.join('\n');
        };
        say(`Searching #${t}...`);
        const r = await searchTag(wc, t).catch((e) => ({ state: 'failed', note: e.message }));
        if (r.state === 'blocked') {
          pushedBack(r.note);
          say(`Instagram pushed back ("${r.note}"). Following and searching pause for 48 hours.`);
          return finish(false);
        }
        if (r.state === 'loggedout') {
          say('Instagram is logged out in the app. Log in on the right, then try again.');
          return finish(false);
        }
        if (r.state === 'notfound' || r.state === 'empty') {
          say(r.state === 'notfound' ? `Instagram has no page for #${t}.` : `#${t} showed no posts.`);
          return finish(true);
        }
        if (r.state !== 'ok') {
          say(`The hashtag page didn't load (${r.note || r.state}).`);
          return finish(true);
        }
        say(`The page showed ${r.tiles} posts. Accounts found ${r.via === 'data' ? "in Instagram's own answers" : 'by opening posts'}: ${r.authors.length}${r.note ? ` (${r.note})` : ''}.`);
        let skip = new Set();
        try {
          skip = await knownHandles(true);
        } catch (e) {
          say(`(Couldn't check Airtable for accounts already saved: ${e.message})`);
        }
        const fresh = r.authors.filter((a) => !skip.has(N.cleanUser(a.username)));
        say(`${fresh.length} of them are new (not in IG Prospects or Leads yet): ${fresh.slice(0, 8).map((a) => `@${a.username}`).join(', ') || 'none'}.`);
        if (!r.authors.length) return finish(true);
        const first = (fresh[0] || r.authors[0]).username;
        say(`Reading @${first}...`);
        const p = await readProfile(wc, first).catch((e) => ({ result: 'failed', note: e.message }));
        if (p.result !== 'ok') {
          say(`The profile didn't read: ${p.note || p.result}.`);
          return finish(p.result === 'failed');
        }
        const i = p.info;
        const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
        say(`Name "${i.fullName}" · category "${i.category}" · ${i.followers ?? '?'} followers · ${i.postsCount ?? '?'} posts${i.private ? ' · private' : ''}`);
        say(`Bio: ${clip((i.bio || '').replace(/\n/g, ' / '), 200) || '(empty)'}`);
        say(`Link: ${i.website || '(none)'} · business account: ${!!i.business}`);
        say(`Read ${i.posts.length} recent post${i.posts.length === 1 ? '' : 's'}: ${i.posts.map((x) => `${(x.date || '').slice(0, 10) || 'no date'}${x.location ? ` at ${x.location}` : ''}`).join('; ') || 'none'}`);
        return finish(!i.fullName && !i.bio);
      });
    },
    snapshot,
  };
}
