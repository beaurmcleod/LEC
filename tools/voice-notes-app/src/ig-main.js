// Runs in Instagram's own page context. While a clip is armed, the next microphone
// request gets a stream that plays the clip instead of the real mic.
(() => {
  if (window.__ivnMain || !window.MediaDevices?.prototype?.getUserMedia) return;
  window.__ivnMain = true;

  const md = MediaDevices.prototype;
  const realGetUserMedia = md.getUserMedia;
  let armed = null;
  let ctx = null;

  const post = (state, extra = {}) => window.postMessage({ __ivn: 'status', state, ...extra }, location.origin);
  const getCtx = () => (ctx ??= new AudioContext({ sampleRate: 48000 }));

  window.addEventListener('message', async (e) => {
    const m = e.data;
    if (e.source !== window || !m || m.__ivn !== 'cmd') return;
    if (m.cmd === 'arm') {
      try {
        const buffer = await getCtx().decodeAudioData(m.wav);
        armed = { buffer, label: m.label, leadInMs: m.leadInMs, monitor: m.monitor };
        post('armed', { label: m.label, seconds: buffer.duration });
      } catch (err) {
        post('error', { message: `Could not load the clip: ${err.message}` });
      }
    } else if (m.cmd === 'disarm') {
      armed = null;
      post('idle');
    }
  });

  md.getUserMedia = function (constraints) {
    if (armed && constraints?.audio && !constraints.video) {
      const job = armed;
      armed = null;
      return playInto(job);
    }
    return realGetUserMedia.call(this, constraints);
  };

  async function playInto(job) {
    const c = getCtx();
    if (c.state !== 'running') await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 1000))]);
    if (c.state !== 'running') {
      armed = job;
      post('error', { message: 'Chrome blocked audio. Click anywhere on the page, then press the mic again.' });
      throw new DOMException('Audio playback blocked', 'NotAllowedError');
    }

    const dest = c.createMediaStreamDestination();
    const keepAlive = c.createConstantSource();
    keepAlive.offset.value = 0;
    keepAlive.connect(dest);
    keepAlive.start();
    const src = c.createBufferSource();
    src.buffer = job.buffer;
    src.connect(dest);
    let monitor = null;
    if (job.monitor) {
      monitor = c.createGain();
      monitor.gain.value = 0.8;
      src.connect(monitor).connect(c.destination);
    }
    src.start(c.currentTime + (job.leadInMs || 0) / 1000);
    post('playing', { label: job.label, seconds: job.buffer.duration, outLoud: !!job.monitor });

    let finished = false;
    let stopped = false;
    src.onended = () => {
      finished = true;
      monitor?.disconnect();
      if (!stopped) post('done', { label: job.label });
    };

    // Instagram stops the track when you send or delete; the track keeps sending silence until then.
    // A stop before the clip ends (cancel, or a quick mic probe) re-arms it so the real mic never slips in.
    const track = dest.stream.getAudioTracks()[0];
    const realStop = track.stop.bind(track);
    track.stop = () => {
      realStop();
      if (stopped) return;
      stopped = true;
      try {
        src.stop();
      } catch {}
      keepAlive.stop();
      keepAlive.disconnect();
      src.disconnect();
      monitor?.disconnect();
      if (finished) {
        post('stopped', { label: job.label });
      } else {
        armed = job;
        post('armed', { label: job.label, seconds: job.buffer.duration });
      }
    };
    return dest.stream;
  }
})();
