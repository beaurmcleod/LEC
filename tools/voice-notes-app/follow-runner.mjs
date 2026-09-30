import fs from 'node:fs/promises';
import * as F from './src/follow.js';
import * as leads from './src/leads.js';
import * as L from './src/limits.js';

const LOG_MAX = 60;
const EMPTY_RETRY_MS = 30 * 60 * 1000;
const ERROR_RETRY_MS = 10 * 60 * 1000;

// Follows and likes one lead at a time in its own Instagram tab, within the pacing in src/follow.js.
// Its counters, pause and log live in a small JSON file so they survive restarts.
export function createFollowRunner({ view, statePath, igBase, click, dblclick, key, snap, reveal, emit, onFollowed, fast = false, build = 'dev' }) {
  let state = { enabled: false, stopNote: '', days: {}, pausedUntil: 0, nextAt: 0, skipped: {}, log: [], times: { follow: [], like: [] } };
  // The safety limits from Setup, when the account started doing this, and when voice notes went out (the app
  // tells this process, since they count toward the combined daily limit).
  let limits = L.DEFAULT_LIMITS;
  let startedAt = Date.now();
  let dmTimes = [];
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

  // Timestamps of what was done (follows and likes here, voice notes from the app), for the hourly and combined limits.
  const timesNow = () => ({ dm: dmTimes, follow: state.times?.follow || [], like: state.times?.like || [] });
  function budget(now = Date.now()) {
    const c = L.caps(limits, now, startedAt, { fast });
    c.follow = Math.min(c.follow, perDay);
    const t = timesNow();
    return { c, t, follow: L.gate('follow', t, c, now), like: L.gate('like', t, c, now), total: L.gate('follow', t, { ...c, follow: 1e9, followHour: 1e9 }, now) };
  }
  const todayCount = (kind, now) => (state.times?.[kind] || []).filter((t) => F.dayKey(t) === F.dayKey(now)).length;
  const note = (kind, now, n = 1) => {
    const keep = now - 26 * 60 * 60 * 1000;
    state.times = state.times || { follow: [], like: [] };
    for (let i = 0; i < n; i++) state.times[kind].push(now);
    state.times[kind] = state.times[kind].filter((t) => t > keep);
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
      cap: Math.min(perDay, budget(now).c.follow),
      likesToday: todayCount('like', now),
      likeCap: budget(now).c.like,
      ramp: budget(now).c.ramp,
      times: { follow: state.times?.follow || [], like: state.times?.like || [] },
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
  // A chat window or a dialog left over the page (Instagram keeps a chat open across pages) swallows the clicks
  // under it. Close it first: its Close button with a real click, or Escape. Says what was there, for the log.
  async function clearCover(wc) {
    const seen = [];
    for (let i = 0; i < 3; i++) {
      const c = await run(wc, 'cover').catch(() => null);
      if (!c) break;
      seen.push(c.what);
      if (c.point) await click(wc, c.point);
      else if (key) await key(wc, 'Escape');
      await new Promise((r) => setTimeout(r, 600));
    }
    return seen.length ? `closed ${seen[0]}${seen.length > 1 ? ` (${seen.length} tries)` : ''}` : '';
  }
  // A picture and a description of the page when a follow or a like didn't take, for "See what Instagram showed".
  const picture = async (handle, why) => (snap ? snap(`follow-${handle}`, `@${handle}: ${why}`).catch(() => '') : '');
  const pause = () => new Promise((r) => setTimeout(r, fast ? 100 : 1500 + Math.random() * 2500));

  // Instagram's answers while a follow-and-like runs in the tab, read the way the send flow reads them: the proof a
  // click reached Instagram (and what it said), whatever the page shows. The tab is also told it has focus, as the
  // send tab is during a send.
  async function watching(wc, fn) {
    const dbg = wc.debugger;
    let mine = false;
    try {
      if (!dbg.isAttached()) {
        dbg.attach('1.3');
        mine = true;
      }
    } catch {}
    const reqs = new Map();
    const kindOf = (req) => {
      const u = String(req.url || '');
      if (/\/friendships\/create\//.test(u)) return 'follow';
      if (/\/likes\/\d+\/like\/|\/media\/[\d_]+\/like\//.test(u)) return 'like';
      if (/\/api\/graphql|\/graphql\/query/.test(u)) {
        const name = /fb_api_req_friendly_name=([\w.]+)/.exec(req.postData || '')?.[1] || '';
        if (/unfollow|unlike/i.test(name)) return '';
        if (/follow/i.test(name)) return 'follow';
        if (/like/i.test(name) && !/comment/i.test(name)) return 'like';
      }
      return '';
    };
    const onMessage = (_e, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        const kind = kindOf(params.request);
        if (kind) reqs.set(params.requestId, { at: Date.now(), kind, status: 0, body: '' });
      } else if (method === 'Network.responseReceived') {
        const r = reqs.get(params.requestId);
        if (r) r.status = params.response.status;
      } else if (method === 'Network.loadingFailed') {
        const r = reqs.get(params.requestId);
        if (r) r.body = `failed: ${params.errorText}`;
      } else if (method === 'Network.loadingFinished') {
        const r = reqs.get(params.requestId);
        if (r)
          r.pending = dbg
            .sendCommand('Network.getResponseBody', { requestId: params.requestId })
            .then((x) => (r.body = (x.base64Encoded ? Buffer.from(x.body, 'base64').toString('utf8') : String(x.body)).replace(/\s+/g, ' ').slice(0, 300)))
            .catch(() => {});
      }
    };
    if (dbg.isAttached()) {
      dbg.on('message', onMessage);
      await dbg.sendCommand('Network.enable').catch(() => {});
      await dbg.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    }
    // What was asked of Instagram (of `kind`) since `t`, with its answers.
    const since = async (t, kind) => {
      const list = [...reqs.values()].filter((r) => r.at >= t && r.kind === kind);
      await Promise.allSettled(list.map((r) => r.pending));
      return list;
    };
    try {
      return await fn({ since, watched: dbg.isAttached() });
    } finally {
      dbg.removeListener('message', onMessage);
      if (dbg.isAttached()) await dbg.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {});
      if (mine) {
        await dbg.sendCommand('Network.disable').catch(() => {});
        try {
          dbg.detach();
        } catch {}
      }
    }
  }
  const answered = (list) => list.some((r) => r.status === 200 && !F.pushedBack(r.body));
  const refused = (list) => list.find((r) => r.status >= 400 || F.pushedBack(r.body));
  // Waits a little for Instagram's answer to a click.
  async function netProof(net, t, kind) {
    for (let i = 0; i < 8; i++) {
      const list = await net.since(t, kind);
      if (answered(list) || refused(list)) return list;
      await new Promise((r) => setTimeout(r, 400));
    }
    return net.since(t, kind);
  }
  const heard = (list, watched) => (!watched ? '' : list.length ? `Instagram answered ${list.map((x) => `${x.status || 'nothing yet'} ${x.body.slice(0, 80)}`).join(', ')}` : 'the click sent nothing to Instagram');

  // Follows the account in `wc` if needed (unless `follow` is false), then likes the posts at `likeAt` (0 = newest;
  // pinned posts don't count). Posts already liked are left alone. When a like doesn't happen, `likeWhy` says why.
  // The tab is put on screen while it clicks (Instagram ignores clicks in a tab hidden behind another; the Follow
  // screen's button, where the tab is on screen, is what worked on the real account) and watched throughout.
  async function visit(wc, handle, likeAt = [0], { follow = true } = {}) {
    const shown = reveal ? await reveal().catch(() => null) : null;
    try {
      return await watching(wc, (net) => visitWatched(wc, handle, likeAt, follow, net, shown));
    } finally {
      await shown?.restore?.().catch?.(() => {});
    }
  }

  async function visitWatched(wc, handle, likeAt, follow, net, shown) {
    await open(wc, `${igBase}/${encodeURIComponent(handle)}/`);
    const cleared = [await clearCover(wc)];
    const p = await run(wc, 'profile');
    if (p.state === 'blocked') return { result: 'blocked', note: p.note };
    if (p.state === 'loggedout') return { result: 'loggedout' };
    if (p.state === 'notfound') return { result: 'notfound' };
    if (!['follow', 'following', 'requested'].includes(p.state)) return { result: 'failed', note: "couldn't find the Follow button" };

    let followed = false;
    let requested = p.state === 'requested';
    // A follow that went in but doesn't show on the page doesn't stop the likes: the page is still theirs.
    let unconfirmed = '';
    if (p.state === 'follow' && follow) {
      const t = Date.now();
      const pt = await run(wc, 'clickFollow');
      if (!(await click(wc, pt))) return { result: 'failed', note: "couldn't click Follow" };
      const a = await run(wc, 'afterFollow');
      if (a.state === 'blocked') return { result: 'blocked', note: a.note };
      const sent = await netProof(net, t, 'follow');
      if (refused(sent) && F.pushedBack(refused(sent).body)) return { result: 'blocked', note: `Instagram answered the follow: ${refused(sent).body.slice(0, 120)}` };
      if (a.state === 'following' || a.state === 'requested' || answered(sent)) {
        followed = true;
        requested = a.state === 'requested';
      } else unconfirmed = [pt?.covered ? `the click was covered by ${pt.covered}` : '', heard(sent, net.watched), a.seen || 'nothing on the page changed'].filter(Boolean).join('; ');
    }

    // Private accounts (or a pending request) have nothing to like.
    const isPrivate = p.private || requested;
    let likes = 0;
    let done = 0;
    const why = [];
    const hrefs = isPrivate ? [] : likeAt.map((i) => p.posts[i]).filter(Boolean);
    if (!isPrivate && likeAt.length && !hrefs.length) why.push(p.postCount === 0 ? 'no posts yet' : `couldn't find their posts on the profile${p.icons?.length ? ` (icons seen: ${p.icons.join(', ')})` : ''}`);
    for (const href of hrefs) {
      await pause();
      await open(wc, new URL(href, igBase).href);
      cleared.push(await clearCover(wc));
      const post = await run(wc, 'post');
      const fail = (l) => ({ result: 'blocked', followed, liked: likes > 0, likes, likesDone: done, note: l.note });
      if (post.state === 'blocked') return fail(post);
      if (post.state === 'liked') {
        likes++;
        continue;
      }
      let ok = false;
      let covered = '';
      const t = Date.now();
      // The heart first (twice, in case the first press only focused the page), then a double-click on the picture.
      for (let attempt = 0; attempt < 2 && !ok && post.state === 'like'; attempt++) {
        const pt = await run(wc, 'clickLike');
        if (!(await click(wc, pt))) break;
        if (pt?.covered) covered = pt.covered;
        const l = await run(wc, 'afterLike');
        if (l.state === 'blocked') return fail(l);
        ok = l.state === 'liked' || answered(await net.since(t, 'like'));
      }
      if (!ok && dblclick) {
        const pt = await run(wc, 'mediaPoint');
        if (pt && (await dblclick(wc, pt))) {
          const l = await run(wc, 'afterLike');
          if (l.state === 'blocked') return fail(l);
          ok = l.state === 'liked' || answered(await net.since(t, 'like'));
        }
      }
      const sent = await netProof(net, t, 'like');
      if (!ok && refused(sent) && F.pushedBack(refused(sent).body)) return fail({ note: `Instagram answered the like: ${refused(sent).body.slice(0, 120)}` });
      ok ||= answered(sent);
      if (ok) {
        likes++;
        done++;
      } else why.push([post.state ? `pressed Like but it didn't take${covered ? ` (the click was covered by ${covered})` : ''}` : `no Like button on the post (icons seen: ${(post.icons || []).join(', ') || 'none'})`, heard(sent, net.watched)].filter(Boolean).join(': '));
    }
    const closed = cleared.filter(Boolean);
    const hidden = shown && shown.shown === false && shown.why ? [`the follow tab stayed hidden: ${shown.why}`] : [];
    const out = { followed, liked: likes > 0, likes, likesDone: done, likeWhy: [...why, ...(closed.length ? [closed[0]] : []), ...(why.length ? hidden : [])].join('; '), private: isPrivate, tried: hrefs.length, onScreen: shown ? shown.shown !== false : null };
    // Something didn't take: keep a picture of the page, for "See what Instagram showed".
    if (unconfirmed || (hrefs.length && !done && !likes)) out.shot = await picture(handle, unconfirmed ? `couldn't confirm the follow (${unconfirmed})` : `no post liked (${why.join('; ')})`);
    if (unconfirmed) return { ...out, result: 'failed', clicked: true, note: `couldn't confirm the follow (${[unconfirmed, ...hidden].join('; ')})` };
    return { ...out, result: followed ? 'followed' : p.state === 'follow' ? 'notfollowed' : 'already' };
  }

  // One line for the lead's IG log in Airtable: when, what happened, and why a like didn't.
  const summary = (r, afterSend) => {
    const when = new Date().toLocaleString('en-US', { timeZone: F.LIMITS.timeZone, dateStyle: 'medium', timeStyle: 'short' });
    const fol = { followed: 'followed', already: 'already following', notfollowed: 'not followed (follow limit)', failed: r.note || 'failed', blocked: `Instagram pushed back ("${r.note}")`, notfound: 'account not found', loggedout: 'Instagram logged out', limit: r.note, paused: r.note }[r.result] || r.result;
    const likes = r.private ? 'private, nothing to like' : r.tried != null ? `liked ${r.likes || 0} of ${r.tried} post${r.tried === 1 ? '' : 's'}${r.likeWhy ? ` (${r.likeWhy})` : ''}` : '';
    return `${when}${afterSend ? ', after the voice note' : ''} (build ${build}): ${[fol, likes].filter(Boolean).join('; ')}`;
  };
  const logAirtable = (id, r, afterSend) => (at?.token && id ? leads.logFollowAirtable(at, id, summary(r, afterSend)).catch(() => {}) : null);

  async function settle(lead, r) {
    const now = Date.now();
    // A click that couldn't be confirmed still counts toward today's limit, to stay on the safe side.
    if (r.followed || r.clicked) (F.recordFollow(state, now), note('follow', now));
    if (r.likesDone) note('like', now, r.likesDone);
    if (r.result === 'blocked') state.pausedUntil = now + F.LIMITS.blockPauseMs;
    if (r.result === 'notfound') state.skipped[lead.id] = 'not found';
    if (r.result === 'loggedout' || r.result === 'failed') {
      state.enabled = false;
      state.stopNote = r.result === 'loggedout' ? 'loggedout' : `${r.note} on @${lead.handle}`;
    }
    state.nextAt = now + (fast ? 1500 : F.randomGap());
    addLog({ handle: lead.handle, result: r.result, followed: !!r.followed, liked: !!r.liked, likes: r.likes || 0, likeWhy: r.likeWhy || '', private: !!r.private, note: r.note || '', shot: r.shot || '' });
    await save();
    logAirtable(lead.id, r, false);
    if (r.followed || r.result === 'already') {
      try {
        await leads.markFollowedAirtable(at, lead.id, r.liked, new Date(now));
        onFollowed({ airtableId: lead.id, followedAt: new Date(now).toISOString() });
      } catch (e) {
        addLog({ handle: lead.handle, result: 'error', note: `Followed, but Airtable said: ${e.message}` });
      }
    } else if (r.liked) await leads.markLikedAirtable(at, lead.id).catch(() => {});
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
    // Each follow comes with a like, so both budgets (and the combined one) need room, in the day and the hour.
    const b = budget(now);
    const hold = [b.follow, b.like, b.total].find((x) => !x.ok);
    if (hold) {
      const kind = hold === b.follow ? (hold.reason === 'day' ? 'cap' : 'hour') : hold === b.like ? (hold.reason === 'day' ? 'likecap' : 'hour') : 'totalcap';
      setPhase(kind, hold.until);
      return schedule(hold.until - now);
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
      // Follows counted before the hourly and combined limits existed only have a day's total.
      const now = Date.now();
      const missing = F.followedToday(state, now) - todayCount('follow', now);
      if (missing > 0) note('follow', F.nextDay(now) - 24 * 60 * 60 * 1000 + 60 * 1000, missing);
      tick();
    },
    // Airtable details and the daily limit, from the app's settings.
    configure(cfg) {
      at = cfg;
      perDay = F.clampPerDay(cfg.perDay);
      if (cfg.limits) limits = cfg.limits;
      if (cfg.startedAt) startedAt = cfg.startedAt;
      if (!busy && ['setup', 'cap'].includes(phase.kind)) tick();
      else emit(snapshot());
    },
    // After a voice note sends: follow them and like their 1st and 4th posts, in the tab that sent it. Skipped
    // while Instagram's push-back pause is on; a new push-back starts one. Follows count toward today's total.
    async engage(wc, { handle, airtableId }, afterSend = true) {
      const now = Date.now();
      if (state.pausedUntil > now) {
        // Never silent: the skip goes in the Follow log and the lead's IG log, like every other outcome.
        const until = new Date(state.pausedUntil).toLocaleString('en-US', { timeZone: F.LIMITS.timeZone, dateStyle: 'medium', timeStyle: 'short' });
        const r = { result: 'paused', until: state.pausedUntil, note: `skipped the follow and likes: Instagram pushed back earlier, so following is paused until ${until}` };
        addLog({ handle, result: 'paused', note: r.note, afterSend });
        logAirtable(airtableId, r, afterSend);
        return r;
      }
      // Inside the limits: follow only while follows have room, and like only as many posts as likes have room for.
      const b = budget(now);
      const canFollow = b.follow.ok && b.total.ok;
      const likeRoom = b.total.ok ? Math.min(2, L.left('like', b.t, b.c, now)) : 0;
      if (!canFollow && !likeRoom) {
        const why = L.reasonText(!b.follow.ok ? b.follow : !b.like.ok ? b.like : b.total, !b.follow.ok ? 'follow' : !b.like.ok ? 'like' : 'follow');
        addLog({ handle, result: 'limit', note: `Skipped the follow and likes: ${why}`, afterSend });
        logAirtable(airtableId, { result: 'limit', note: `skipped the follow and likes: ${why}` }, afterSend);
        await save();
        emit(snapshot());
        return { result: 'limit', note: why };
      }
      const r = await visit(wc, handle, [0, 3].slice(0, likeRoom), { follow: canFollow }).catch((e) => ({ result: 'failed', note: `the follow step crashed: ${e.message}` }));
      if (r.followed || r.clicked) (F.recordFollow(state, now), note('follow', now));
      if (r.likesDone) note('like', now, r.likesDone);
      if (r.result === 'blocked') state.pausedUntil = now + F.LIMITS.blockPauseMs;
      addLog({ handle, result: r.result, followed: !!r.followed, liked: !!r.liked, likes: r.likes || 0, likeWhy: r.likeWhy || '', private: !!r.private, note: r.note || '', afterSend, shot: r.shot || '' });
      logAirtable(airtableId, r, afterSend);
      r.line = summary(r, afterSend);
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
    // When voice notes went out, from the app, for the combined daily limit.
    setVoiceTimes(times) {
      dmTimes = Array.isArray(times) ? times.filter((t) => Number.isFinite(t)) : [];
      emit(snapshot());
    },
    setEnabled(on) {
      state.enabled = on;
      state.stopNote = '';
      save();
      if (!busy) tick();
      else emit(snapshot());
    },
    // The Follow screen's "Follow + like now": the same step a voice note triggers, on one account, in the follow
    // tab, right away (within the safety limits). Returns what happened, in the words the IG log gets.
    // After a voice note the same step runs here too (afterSend = true), in the follow tab rather than the tab
    // that sent: Instagram keeps the chat open over the pages in that tab, and the clicks under it don't take.
    async engageNow(handle, airtableId, afterSend = false) {
      while (busy) await new Promise((r) => setTimeout(r, 400));
      busy = true;
      try {
        const r = await this.engage(view().webContents, { handle, airtableId }, afterSend);
        return { ...r, line: r.line || summary(r, afterSend) };
      } finally {
        busy = false;
        if (state.enabled) tick();
      }
    },
    // Says what the like step sees on one profile and its first post, without following or liking anything: is
    // the grid of posts there, is the Like button, and what else the page shows if not.
    async probe(handle) {
      while (busy) await new Promise((r) => setTimeout(r, 400));
      busy = true;
      const lines = [];
      try {
        const wc = view().webContents;
        await open(wc, `${igBase}/${encodeURIComponent(handle)}/`);
        const p = await run(wc, 'profile');
        lines.push(`@${handle}'s profile: ${p.state || 'unknown'}${p.private ? ' (private: nothing to like)' : ''}`);
        if (p.state === 'blocked') lines.push(`Instagram pushed back: "${p.note}"`);
        else if (p.state && !p.private) {
          lines.push(`Posts found on the profile: ${p.posts?.length || 0}${p.postCount === 0 ? ' (the account has none)' : ''}${p.posts?.length ? '' : p.icons?.length ? `. Icons on the page: ${p.icons.join(', ')}` : ''}`);
          if (p.posts?.length) {
            await pause();
            await open(wc, new URL(p.posts[0], igBase).href);
            const post = await run(wc, 'post');
            const media = await run(wc, 'mediaPoint');
            lines.push(`First post (${p.posts[0]}): ${post.state === 'like' ? 'the Like button is there' : post.state === 'liked' ? 'already liked' : post.state === 'blocked' ? `Instagram pushed back ("${post.note}")` : `no Like button found. Icons on the page: ${(post.icons || []).join(', ') || 'none'}`}`);
            lines.push(`The picture to double-click: ${media ? 'found' : 'not found'}`);
          }
        }
      } catch (e) {
        lines.push(`The test failed: ${e.message}`);
      } finally {
        busy = false;
        if (state.enabled) tick();
      }
      return lines;
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
