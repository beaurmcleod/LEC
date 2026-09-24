// Isolated-world side: relays commands from the side panel to ig-main.js and shows a status pill on the page.
(() => {
  if (window.__ivnBridge) return;
  window.__ivnBridge = true;

  const send = (cmd, extra = {}, transfer) => window.postMessage({ __ivn: 'cmd', cmd, ...extra }, location.origin, transfer);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  let box, text, btn, tick, hideTimer;
  function show(msg, color, button, hideAfterMs) {
    if (!box?.isConnected) {
      box = document.createElement('div');
      box.style.cssText =
        'position:fixed;right:20px;bottom:96px;z-index:2147483647;max-width:320px;display:flex;gap:10px;align-items:center;' +
        'padding:12px 14px;border-radius:12px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.35);' +
        'font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
      text = document.createElement('div');
      btn = document.createElement('button');
      btn.style.cssText =
        'flex:none;border:0;border-radius:8px;padding:6px 10px;background:rgba(255,255,255,.18);color:#fff;font:inherit;cursor:pointer';
      box.append(text, btn);
      (document.body || document.documentElement).append(box);
    }
    clearInterval(tick);
    clearTimeout(hideTimer);
    box.style.background = color;
    box.style.display = 'flex';
    text.textContent = msg;
    btn.style.display = button ? '' : 'none';
    if (button) {
      btn.textContent = button.label;
      btn.onclick = button.onClick;
    }
    if (hideAfterMs) hideTimer = setTimeout(hide, hideAfterMs);
  }
  const hide = () => box && (box.style.display = 'none');
  const close = { label: 'Close', onClick: hide };

  function onStatus(m) {
    const who = m.label ? ` for ${m.label}` : '';
    if (m.state === 'armed') {
      show(`Voice note ready${who} (${fmt(m.seconds)}). Click the mic in the chat.`, '#1f2937', {
        label: 'Disarm',
        onClick: () => send('disarm'),
      });
    } else if (m.state === 'playing') {
      const started = Date.now();
      const update = () => (text.textContent = `Playing into Instagram... ${fmt((Date.now() - started) / 1000)} / ${fmt(m.seconds)}`);
      show('', '#1d4ed8');
      update();
      tick = setInterval(update, 250);
    } else if (m.state === 'done') {
      show('Clip finished. Hit send now.', '#15803d', close);
    } else if (m.state === 'stopped') {
      show('Recording stopped.', '#1f2937', close, 4000);
    } else if (m.state === 'error') {
      show(m.message, '#b91c1c', close);
    } else {
      hide();
    }
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.__ivn !== 'status') return;
    onStatus(e.data);
    chrome.runtime.sendMessage({ type: 'ivn:status', ...e.data }).catch(() => {});
  });

  const SKIP_LINE = /^(follow|following|message|edit profile|view archive|contact|email|call|options|more|\d[\d.,]*[km]?\s+(posts?|followers?|following))$/i;
  const NOT_PROFILES = new Set(['direct', 'explore', 'reels', 'reel', 'p', 'stories', 'accounts', 'about', 'legal', 'developer']);

  function grab() {
    const first = location.pathname.split('/').filter(Boolean)[0] || '';
    let handle = NOT_PROFILES.has(first) ? '' : first;
    let displayName = '';
    const t = document.title.match(/^(.*?)\s*\(@([^)]+)\)/);
    if (t) {
      displayName = t[1].trim();
      handle ||= t[2];
    }
    const header = document.querySelector('main header') || document.querySelector('header');
    const bio = (header?.innerText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== handle && !SKIP_LINE.test(l))
      .join('\n')
      .slice(0, 600);
    return { handle, displayName, bio };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'ivn:arm') {
      const bin = atob(msg.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      send('arm', { wav: bytes.buffer, label: msg.label, leadInMs: msg.leadInMs, monitor: msg.monitor }, [bytes.buffer]);
      reply({ ok: true });
    } else if (msg.type === 'ivn:disarm') {
      send('disarm');
      reply({ ok: true });
    } else if (msg.type === 'ivn:grab') {
      reply(grab());
    }
  });
})();
