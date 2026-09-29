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

  // The voice notes on screen in this thread, ours and theirs, and any send error Instagram shows. A send is
  // only real when the count on our side goes up by one afterwards.
  if (action === 'voiceCount') {
    const mid = window.innerWidth / 2;
    const marks = [...document.querySelectorAll('audio, [aria-label*="audio" i], [aria-label*="voice" i]')].filter(shown);
    const rows = new Map();
    for (const m of marks) {
      const row = m.closest('[role=row], [role=listitem]') || m;
      if (!rows.has(row)) rows.set(row, m);
    }
    let mine = 0;
    let theirs = 0;
    for (const m of rows.values()) {
      const r = m.getBoundingClientRect();
      if (r.left + r.width / 2 > mid) mine++;
      else theirs++;
    }
    const err = /[^.\n]*(can'?t receive your message|couldn'?t send|failed to send|not delivered|wasn'?t sent|try again later)[^.\n]*/i.exec(document.body.innerText || '');
    return { mine, theirs, error: err ? err[0].trim().slice(0, 200) : '' };
  }

  // What the tab shows right now: the address, the visible text and every labeled control. Saved when a send
  // doesn't go through, so what Instagram did can be looked at afterwards.
  if (action === 'describe') {
    const labels = [...document.querySelectorAll('[aria-label]')]
      .filter(shown)
      .map((el) => `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label')}"${text(el) ? ` text="${text(el).slice(0, 40)}"` : ''}`);
    return { url: location.href, text: (document.body.innerText || '').slice(0, 4000), labels: labels.slice(0, 200) };
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
    const el = [...document.querySelectorAll('button, [role=button]')].find((b) => shown(b) && /^send$/i.test(text(b)));
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
