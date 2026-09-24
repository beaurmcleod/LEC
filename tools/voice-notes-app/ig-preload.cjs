// Relays between the app and src/ig-main.js, which runs in Instagram's page context.
const { ipcRenderer } = require('electron');

const post = (msg, transfer) => window.postMessage({ __ivn: 'cmd', ...msg }, location.origin, transfer);

ipcRenderer.on('ivn:arm', (_e, { wav, label, leadInMs, monitor }) => {
  const bytes = new Uint8Array(wav);
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  post({ cmd: 'arm', wav: buf, label, leadInMs, monitor }, [buf]);
});
ipcRenderer.on('ivn:disarm', () => post({ cmd: 'disarm' }));

window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.__ivn === 'status') ipcRenderer.send('ig:status', e.data);
});
