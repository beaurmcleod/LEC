navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    stream.getTracks().forEach((t) => t.stop());
    document.getElementById('msg').textContent = 'Mic allowed. You can close this tab and go back to the side panel.';
  })
  .catch((e) => {
    document.getElementById('msg').textContent =
      `Mic blocked (${e.name}). Click the icon at the right of the address bar to allow it, then reload this tab.`;
  });
