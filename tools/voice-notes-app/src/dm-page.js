// Runs inside an Instagram tab, on the DM inbox or a thread. Self-contained so it can be sent as source.
// Instagram's class names change often, so everything is read by role, link, aria-label and visible text.
export async function dmPage(action, arg) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = (el) => (el?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const waitFor = async (fn, ms) => {
    for (const end = Date.now() + ms; ; await sleep(250)) {
      const found = fn();
      if (found || Date.now() > end) return found;
    }
  };
  const loggedOut = () => /^\/accounts\/login/.test(location.pathname);

  // The inbox: every thread link, with the handle, the preview line and whether Instagram shows it unread.
  if (action === 'inbox') {
    await waitFor(() => loggedOut() || document.querySelector('a[href^="/direct/t/"]'), 8000);
    if (loggedOut()) return { state: 'loggedout', threads: [] };
    // No thread links at all: a layout this reader doesn't know (rows that aren't links), not an empty inbox.
    if (!document.querySelector('a[href^="/direct/t/"]')) return { state: 'unreadable', threads: [] };
    await sleep(600);
    const threads = [];
    for (const a of [...document.querySelectorAll('a[href^="/direct/t/"]')].filter(shown)) {
      const lines = (a.innerText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!lines.length) continue;
      // Instagram marks unread rows with a dot whose label says so, or with bold text.
      const unread =
        !!a.querySelector('[aria-label*="unread" i], [aria-label*="Unread" i]') ||
        [...a.querySelectorAll('span, div')].some((el) => shown(el) && /^(600|700|bold)$/.test(getComputedStyle(el).fontWeight) && text(el) === lines[0]);
      threads.push({ href: a.getAttribute('href'), name: lines[0], preview: lines.slice(1).join(' · '), unread });
    }
    return { state: 'ok', threads };
  }

  // The inbox list as it is on screen right now, for the unread watcher: each row's name, preview, whether it
  // looks unread, and whether the last message in it is ours or theirs. Rows are thread links when Instagram
  // makes them links, and otherwise found by layout: a round profile picture with a name and a preview beside it.
  // Nothing is clicked or loaded, so it can run every minute. `arg.report` returns plain text for troubleshooting.
  if (action === 'inboxScan' || action === 'inboxReport') {
    await waitFor(() => loggedOut() || document.querySelector('a[href^="/direct/t/"], img'), 8000);
    if (loggedOut()) return action === 'inboxReport' ? 'Instagram is logged out.' : { state: 'loggedout', rows: [] };
    // "Turn on notifications?" covers the list the first time.
    [...document.querySelectorAll('button, [role=button]')].find((b) => shown(b) && /^not now$/i.test(text(b)))?.click();
    await sleep(400);
    const when = /^(now|just now|\d+\s*(s|m|h|d|w|min|mins|hr|hrs|sec|secs)|\d{1,2}:\d{2}\s*[ap]m|mon|tue|wed|thu|fri|sat|sun|yesterday|active.*)$/i;
    const linesOf = (el) =>
      (el.innerText || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    const found = [];
    let via = 'links';
    for (const a of document.querySelectorAll('a[href^="/direct/t/"]')) if (shown(a)) found.push({ el: a, href: a.getAttribute('href') });
    if (!found.length) {
      via = 'layout';
      const seen = new Set();
      for (const img of document.querySelectorAll('img, [role=img]')) {
        if (!shown(img)) continue;
        const b = img.getBoundingClientRect();
        if (b.width < 28 || b.width > 90 || Math.abs(b.width - b.height) > 6 || b.left > innerWidth * 0.5) continue;
        for (let a = img.parentElement; a && a !== document.body; a = a.parentElement) {
          const r = a.getBoundingClientRect();
          if (r.height > 130) break;
          if (r.width >= 200 && linesOf(a).length >= 2) {
            if (!seen.has(a)) {
              seen.add(a);
              found.push({ el: a, href: a.closest('a')?.getAttribute('href') || '' });
            }
            break;
          }
        }
      }
    }
    const weight = (el, words) => {
      const leaf = [...el.querySelectorAll('*')].find((x) => shown(x) && x.children.length === 0 && (x.textContent || '').trim() && words.startsWith((x.textContent || '').trim().slice(0, 12)));
      return leaf ? parseInt(getComputedStyle(leaf).fontWeight, 10) || 400 : 0;
    };
    const unreadHow = (el, preview) => {
      if (el.querySelector('[aria-label*="unread" i]')) return 'label';
      for (const d of el.querySelectorAll('div, span')) {
        if (!shown(d)) continue;
        const b = d.getBoundingClientRect();
        if (b.width < 6 || b.width > 14 || Math.abs(b.width - b.height) > 2) continue;
        const cs = getComputedStyle(d);
        const round = cs.borderRadius.includes('%') ? parseFloat(cs.borderRadius) >= 40 : parseFloat(cs.borderRadius) >= b.width / 2 - 1;
        const m = /rgba?\((\d+), ?(\d+), ?(\d+)/.exec(cs.backgroundColor);
        if (round && m && +m[3] > +m[1] + 60 && +m[3] > 150) return 'dot';
      }
      return preview && weight(el, preview) >= 600 ? 'bold' : '';
    };
    const rows = found
      .map(({ el, href }) => {
        const lines = linesOf(el);
        const name = lines[0] || '';
        const rest = lines.slice(1).filter((l) => !when.test(l));
        // The preview often carries the time after a dot: "Hey send the details! · 2h".
        const preview = rest.join(' ').replace(/\s*[·•]\s*(now|\d+\s*(s|m|h|d|w|min|mins|hr|hrs)|\d{1,2}:\d{2}\s*[ap]m|mon|tue|wed|thu|fri|sat|sun|yesterday)\s*$/i, '').trim();
        return { name, preview, href: href || '', unread: unreadHow(el, preview), last: !preview ? '' : /^you\b/i.test(preview) ? 'ours' : 'theirs', top: Math.round(el.getBoundingClientRect().top), raw: lines.slice(0, 5) };
      })
      .filter((r) => r.name);
    if (action === 'inboxReport') {
      const out = [`address ${location.pathname}`, `window ${innerWidth}x${innerHeight}`, `rows found by ${via}: ${rows.length}`, ''];
      for (const r of rows.slice(0, 25)) out.push(`  ${r.unread ? `UNREAD(${r.unread})` : 'read'} ${r.last || '?'} ${JSON.stringify(r.raw)}${r.href ? ` ${r.href}` : ''}`);
      if (!rows.length) out.push('text on the page:', (document.body.innerText || '').slice(0, 1500));
      return out.join('\n');
    }
    return { state: rows.length ? 'ok' : 'unreadable', via, rows: rows.slice(0, 60).map(({ raw, ...r }) => r) };
  }

  // A thread: the messages on screen, oldest first, each marked as ours (right side) or theirs (left side).
  if (action === 'thread') {
    await waitFor(() => loggedOut() || document.querySelector('[role=textbox]'), 15000);
    if (loggedOut()) return { state: 'loggedout', messages: [] };
    await sleep(800);
    const box = document.querySelector('[role=textbox]');
    const mid = window.innerWidth / 2;
    const rows = [...document.querySelectorAll('[role=row], [role=listitem]')].filter((el) => shown(el) && !el.contains(box) && !el.querySelector('[role=row], [role=listitem]'));
    const messages = [];
    for (const row of rows) {
      const t = text(row);
      if (!t || /^(you sent|sent|seen|delivered|active now|today|yesterday|\d{1,2}:\d{2}( ?[ap]m)?)$/i.test(t)) continue;
      if (/^(Voice message|You sent a voice message|Audio)$/i.test(t)) {
        messages.push({ mine: /^you/i.test(t) || row.getBoundingClientRect().left > mid, text: '[voice note]', voice: true });
        continue;
      }
      // The row spans the whole width; the bubble inside it sits left (theirs) or right (ours).
      let bubble = row;
      for (;;) {
        const inner = [...bubble.children].find((c) => shown(c) && text(c) === t);
        if (!inner) break;
        bubble = inner;
      }
      const r = bubble.getBoundingClientRect();
      messages.push({ mine: r.left + r.width / 2 > mid, text: t.slice(0, 2000) });
    }
    const who = text(document.querySelector('header')) || '';
    return { state: 'ok', who, messages: messages.slice(-30) };
  }

  // What the tab shows right now: the address, the visible text and every labeled control. Saved when a send
  // doesn't go through, so what Instagram did can be looked at afterwards.
  if (action === 'describe') {
    const at = (el) => {
      const r = el.getBoundingClientRect();
      return `@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    };
    const one = (el) => {
      const role = el.getAttribute('role');
      const label = el.getAttribute('aria-label');
      const words = text(el).slice(0, 40);
      return `${el.tagName.toLowerCase()}${role ? ` role=${role}` : ''}${label ? ` "${label}"` : ''}${words ? ` text="${words}"` : ''}${el.disabled || el.getAttribute('aria-disabled') === 'true' ? ' DISABLED' : ''} ${at(el)}`;
    };
    // Every button and input on screen, with where it is: the controls a click could land on.
    const buttons = [...document.querySelectorAll('button, [role=button], [role=textbox], [contenteditable=true], input, audio, video')].filter(shown).map(one);
    const labels = [...document.querySelectorAll('[aria-label]')].filter((el) => shown(el) && !/^(Carousel|Clip)$/.test(el.getAttribute('aria-label'))).map(one);
    return {
      url: location.href,
      text: (document.body.innerText || '').replace(/\nMeta\nAbout\n[\s\S]*?© \d{4} Instagram from Meta/, '\n(page footer)').slice(0, 4000),
      buttons: buttons.slice(0, 120),
      labels: labels.slice(0, 200),
      // Only what's new since the last look; each look is kept in the send's record.
      trace: (window.__ivnTrace || []).splice(0).slice(-60),
      focused: document.hasFocus(),
    };
  }

  // The open chat (a chat window over a profile, or a thread page): the voice messages it shows, whose each one
  // is (`arg` is the lead's handle: theirs; anyone else: ours), whether one still says "Sending", and any notice
  // that a message failed. A voice message has a Play (or Pause) button in its bubble; Instagram labels each
  // message's actions "React to message from <username>", which says who sent it.
  if (action === 'chatVoice') {
    const lead = String(arg || '').toLowerCase().replace(/^@/, '');
    const box = [...document.querySelectorAll('[role=textbox]')].filter(shown).pop();
    // The chat is the first container around the message box tall enough to hold the messages too.
    let chat = document.body;
    for (let el = box?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.getBoundingClientRect().height >= 250) {
        chat = el;
        break;
      }
    }
    const REACT = 'React to message from ';
    // The sender of the message a Play button sits in: the nearest container around it with message labels, as
    // long as they all name one sender.
    const senderOf = (el) => {
      for (let a = el.parentElement; a && a !== chat.parentElement; a = a.parentElement) {
        const names = new Set([...a.querySelectorAll(`[aria-label^="${REACT}"]`)].map((x) => x.getAttribute('aria-label').slice(REACT.length).trim().toLowerCase()));
        if (names.size === 1) return [...names][0];
        if (names.size > 1) return '';
      }
      return '';
    };
    let ours = 0;
    let theirs = 0;
    let unknown = 0;
    const cr = chat.getBoundingClientRect();
    for (const b of chat.querySelectorAll('[aria-label="Play"], [aria-label="Pause"]')) {
      const who = senderOf(b);
      const r = b.getBoundingClientRect();
      // Theirs when the label is their handle; otherwise by the side of the chat it sits on (ours are on the right).
      if (lead && who === lead) theirs++;
      else if (r.width > 0 && cr.width > 0) (cr.right - r.right < r.left - cr.left ? ours++ : theirs++);
      else if (!who) unknown++;
      else ours++;
    }
    const words = chat.innerText || '';
    const bad = /[^\n]*(failed to send|couldn'?t send|could not send|not delivered|tap to retry|click to retry|message failed|wasn'?t sent|unable to send|can'?t receive your message|try again later)[^\n]*/i.exec(words);
    return {
      voices: ours + theirs + unknown,
      ours,
      theirs,
      unknown,
      sending: /(^|\n)\s*Sending\.*\s*(\n|$)/.test(words),
      failure: bad ? bad[0].trim().slice(0, 200) : '',
      chat: chat === document.body ? 'whole page' : 'chat window',
    };
  }

  // The open chat as a conversation, oldest first: who sent each message, its text, and whether it's a voice
  // message. The app sends exactly one voice note to a lead, so the first voice message in the chat is ours, and
  // every other message is placed against it: on the same side as our note is ours, the far side is theirs. That
  // holds whatever the page's layout or labels are. Anything above our note (the conversation's intro with their
  // name) isn't part of the conversation and is left out. `anchored` says whether our note was found; without it
  // nothing can be placed and the app treats the chat as unreadable rather than guess. `arg` is the lead's handle,
  // or { handle, names } with the names the lead goes by.
  if (action === 'chatMessages') {
    const opts = arg && typeof arg === 'object' ? arg : { handle: arg };
    const lead = String(opts.handle || '').toLowerCase().replace(/^@/, '');
    const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const known = new Set([lead, ...(opts.names || [])].map(norm).filter((n) => n.length >= 4));
    const box = [...document.querySelectorAll('[role=textbox]')].filter(shown).pop();
    let chat = document.body;
    for (let el = box?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.getBoundingClientRect().height >= 250) {
        chat = el;
        break;
      }
    }
    const cr = chat.getBoundingClientRect();
    const REACT = 'React to message from ';
    const count = (el) => el.querySelectorAll(`[aria-label^="${REACT}"]`).length;
    const noise = /^((seen|sent|delivered)( (just now|yesterday|today|\d+ ?(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks)\.?( ago)?|(mon|tue|wed|thu|fri|sat|sun)[a-z]*( at \d{1,2}:\d{2} ?[ap]m)?|at \d{1,2}:\d{2} ?[ap]m))?|sending\.*|view transcription|reply|react|more|edited|\d{1,2}:\d{2}( ?[ap]m)?|\d+:\d{2}|(mon|tue|wed|thu|fri|sat|sun)[a-z]*,? (at )?\d{1,2}:\d{2} ?[ap]m|[a-z]{3} \d{1,2}, \d{4},? \d{1,2}:\d{2} ?[ap]m|(mon|tue|wed|thu|fri|sat|sun)[a-z]* \d{1,2}:\d{2} ?[ap]m|today|yesterday)$/i;
    const hover = '[aria-label^="React to message"], [aria-label="More"], [aria-label="Reply"], [aria-label="Copy"], [aria-label="Forward"], [role=textbox]';
    const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(' ');
    // A voice message has a Play (or Pause) button, and a "View transcription" link under it.
    const isPlay = (el) => el.matches('[aria-label="Play"], [aria-label="Pause"]') || /^view transcription$/i.test(ownText(el));
    const sideOf = (b) => (cr.right - b.right < b.left - cr.left ? 'right' : 'left');
    // Where a message's own content (its text and Play button) sits: the row also holds hover controls off to one side.
    const contentBox = (row) => {
      let l = Infinity;
      let r = -Infinity;
      for (const el of row.querySelectorAll('*')) {
        if (el.closest(hover) || !shown(el)) continue;
        const t = ownText(el);
        if (!isPlay(el) && (!t || noise.test(t))) continue;
        const b = el.getBoundingClientRect();
        l = Math.min(l, b.left);
        r = Math.max(r, b.right);
      }
      return l < r ? { left: l, right: r } : row.getBoundingClientRect();
    };
    const seen = new Set();
    const names = new Set();
    const messages = [];
    for (const label of [...chat.querySelectorAll(`[aria-label^="${REACT}"]`)]) {
      let row = null;
      for (let a = label.parentElement; a && a !== chat.parentElement && count(a) === 1; a = a.parentElement) {
        if (text(a).length > 0 || a.querySelector('[aria-label="Play"], [aria-label="Pause"], img, video')) {
          row = a;
          break;
        }
      }
      if (!row || seen.has(row)) continue;
      seen.add(row);
      const who = label.getAttribute('aria-label').slice(REACT.length).trim();
      names.add(who);
      const lines = (row.innerText || '').split('\n').map((l) => l.trim()).filter((l) => l && !noise.test(l) && l.toLowerCase() !== who.toLowerCase());
      const voice = !!row.querySelector('[aria-label="Play"], [aria-label="Pause"]') || /(^|\n)view transcription(\n|$)/i.test(row.innerText || '');
      const cb = contentBox(row);
      const theirsByName = !!lead && who.toLowerCase() === lead;
      messages.push({ who, mine: theirsByName ? false : sideOf(cb) === 'right', text: lines.join('\n').slice(0, 2000), voice, top: row.getBoundingClientRect().top, cx: (cb.left + cb.right) / 2 });
    }
    // Text and Play buttons the labels didn't cover (Instagram may label only some messages, or none), read by
    // where they sit: below the conversation header, above the message box, and off to one side.
    const rowEls = [...seen];
    const items = [];
    for (const el of chat.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const play = isPlay(el);
      const t = ownText(el);
      if (!play && (!t || noise.test(t))) continue;
      if (el.closest('header, [role=banner], [role=textbox]')) continue;
      if (!play && el.closest('button, [role=button]')) continue;
      if (rowEls.some((r) => r.contains(el))) continue;
      const b = el.getBoundingClientRect();
      const floor = box ? box.getBoundingClientRect().top - 8 : cr.bottom - 40;
      if (b.top < cr.top + 90 || b.top >= floor) continue;
      items.push({ top: b.top, bottom: b.bottom, cx: (b.left + b.right) / 2, mine: sideOf(b) === 'right', text: play ? '' : t, voice: play });
    }
    items.sort((a, b) => a.top - b.top);
    const extras = [];
    for (const it of items) {
      const prev = extras[extras.length - 1];
      const near = prev && Math.abs(prev.cx - it.cx) < cr.width * 0.3;
      if (near && prev.voice && it.voice && it.top - prev.bottom < 90) {
        prev.bottom = Math.max(prev.bottom, it.bottom); // the Play button and its "View transcription" are one message
      } else if (near && !prev.voice && !it.voice && it.top - prev.bottom < 24) {
        prev.text = `${prev.text}\n${it.text}`.slice(0, 2000);
        prev.bottom = it.bottom;
      } else extras.push({ who: '', mine: it.mine, text: it.text, voice: it.voice, top: it.top, bottom: it.bottom, cx: it.cx });
    }
    const all = messages.concat(extras).sort((a, b) => a.top - b.top);
    const via = extras.length ? (messages.length ? 'labels+layout' : 'layout') : 'labels';
    const first = all.findIndex((m) => m.voice);
    let out = all;
    let skipped = 0;
    if (first >= 0) {
      const ours = all[first];
      const far = cr.width * 0.3;
      out = [];
      all.forEach((m, i) => {
        if (i < first) return skipped++;
        if (i > first && !m.voice && known.has(norm(m.text))) return skipped++;
        out.push({ ...m, mine: i === first ? true : Math.abs(m.cx - ours.cx) <= far });
      });
    }
    return {
      messages: out.slice(-30).map(({ who, mine, text: t, voice }) => ({ who, mine, text: t, voice })),
      anchored: first >= 0,
      skipped,
      chat: chat === document.body ? 'whole page' : 'chat window',
      via,
      names: [...names].slice(0, 6),
      loggedOut: loggedOut(),
    };
  }

  // A plain-text report of the open chat for troubleshooting: where the chat and the message box are, the
  // labeled controls, and every piece of text and Play button with where it sits.
  if (action === 'chatReport') {
    const box = [...document.querySelectorAll('[role=textbox]')].filter(shown).pop();
    let chat = document.body;
    for (let el = box?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.getBoundingClientRect().height >= 250) {
        chat = el;
        break;
      }
    }
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return `@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    };
    const cr = chat.getBoundingClientRect();
    const out = [
      `address ${location.pathname}`,
      `window ${innerWidth}x${innerHeight}`,
      `message box ${box ? rect(box) : 'NOT FOUND'}`,
      `chat container ${chat === document.body ? 'NOT FOUND (using the whole page)' : `<${chat.tagName.toLowerCase()}> ${rect(chat)}`}`,
      '',
      'labeled controls:',
    ];
    const labeled = [...chat.querySelectorAll('[aria-label]')].filter(shown);
    for (const el of labeled.slice(0, 45)) out.push(`  <${el.tagName.toLowerCase()}${el.getAttribute('role') ? ` role=${el.getAttribute('role')}` : ''}> "${el.getAttribute('aria-label')}" ${rect(el)}`);
    if (labeled.length > 45) out.push(`  ...and ${labeled.length - 45} more`);
    out.push('', 'text and Play buttons, top to bottom:');
    const rows = [];
    for (const el of chat.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const play = el.matches('[aria-label="Play"], [aria-label="Pause"]');
      const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(' ');
      if (!play && !t) continue;
      const r = el.getBoundingClientRect();
      const side = cr.right - r.right < r.left - cr.left ? 'RIGHT' : 'left';
      rows.push({ top: r.top, line: `  ${side.padEnd(5)} ${play ? '[Play button]' : JSON.stringify(t.slice(0, 70))} <${el.tagName.toLowerCase()}${el.closest('button, [role=button]') ? ' in-button' : ''}${el.closest('header, [role=banner]') ? ' in-header' : ''}> ${rect(el)}` });
    }
    rows.sort((a, b) => a.top - b.top);
    for (const r of rows.slice(-70)) out.push(r.line);
    return out.join('\n');
  }

  // Where to click to put the caret in the message box.
  if (action === 'box') {
    const box = await waitFor(() => document.querySelector('[role=textbox][contenteditable]'), 8000);
    if (!box) return null;
    box.scrollIntoView({ block: 'center' });
    const r = box.getBoundingClientRect();
    return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 };
  }

  // Is the caret in the message box? A click that lands before the page is ready leaves it elsewhere.
  if (action === 'boxFocused') {
    const box = document.querySelector('[role=textbox][contenteditable]');
    return !!box && (document.activeElement === box || box.contains(document.activeElement));
  }
  if (action === 'focusBox') {
    const box = document.querySelector('[role=textbox][contenteditable]');
    if (!box) return false;
    box.focus();
    await sleep(100);
    return document.activeElement === box || box.contains(document.activeElement);
  }
  // Did the typed text land in the box?
  if (action === 'boxHas') {
    await sleep(100);
    return text(document.querySelector('[role=textbox][contenteditable]')).includes(String(arg || '').replace(/\s+/g, ' ').trim());
  }

  // After typing: the Send button, if Instagram shows one (Enter usually sends too).
  if (action === 'sendButton') {
    await sleep(300);
    const el = [...document.querySelectorAll('button, [role=button]')].find((b) => shown(b) && (/^send$/i.test(text(b)) || /^send$/i.test(b.getAttribute('aria-label') || '')));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Did our message land? The box should be empty again and the last message on our side should carry the
  // text. 'stuck' means the text is still sitting in the box, so nothing went out.
  if (action === 'confirm') {
    const want = String(arg || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const typed = () => text(document.querySelector('[role=textbox]'));
    const ok = await waitFor(() => {
      const rows = [...document.querySelectorAll('[role=row], [role=listitem]')].filter(shown);
      const last = rows.map(text).filter(Boolean).slice(-6);
      return !typed() && last.some((t) => t.includes(want));
    }, 8000);
    return { state: ok ? 'sent' : typed().includes(want.slice(0, 40)) ? 'stuck' : 'unsure' };
  }
  throw new Error(`Unknown DM step: ${action}`);
}
