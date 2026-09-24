const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  arm: (wav, meta) => ipcRenderer.invoke('ig:arm', wav, meta),
  disarm: () => ipcRenderer.invoke('ig:disarm'),
  openProfile: (handle) => ipcRenderer.invoke('ig:open', handle),
  showInstagram: () => ipcRenderer.invoke('ig:show'),
  grab: () => ipcRenderer.invoke('ig:grab'),
  onStatus: (cb) => ipcRenderer.on('ig:status', (_e, m) => cb(m)),
  saveClip: (wav, name) => ipcRenderer.invoke('clip:save', wav, name),
  reveal: (file) => ipcRenderer.invoke('clip:reveal', file),
  pullAirtable: (at) => ipcRenderer.invoke('airtable:pull', at),
  markSent: (at, id) => ipcRenderer.invoke('airtable:sent', at, id),
  speak: (text, settings) => ipcRenderer.invoke('tts', text, settings),
});
