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
    for (const b of chat.querySelectorAll('[aria-label="Play"], [aria-label="Pause"]')) {
      const who = senderOf(b);
      if (!who) unknown++;
      else if (lead && who === lead) theirs++;
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
