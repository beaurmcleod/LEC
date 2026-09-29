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

  // A running note of what Instagram does with the recording (mic requests, its recorder, focus changes), read
  // back by the app when it checks a send. Prototype hooks only, so nothing Instagram does is changed.
  const trace = (window.__ivnTrace ??= []);
  const note = (s) => {
    trace.push(`${new Date().toISOString().slice(11, 23)} ${s}`);
    if (trace.length > 120) trace.shift();
  };
  window.__ivnNote = note;
  for (const ev of ['blur', 'focus']) window.addEventListener(ev, () => note(`window ${ev}`), true);
  document.addEventListener('visibilitychange', () => note(`page ${document.visibilityState}`), true);
  const MR = window.MediaRecorder;
  if (MR?.prototype) {
    const { start, stop, pause, resume } = MR.prototype;
    MR.prototype.start = function (timeslice) {
      let bytes = 0;
      let chunks = 0;
      const t0 = Date.now();
      this.addEventListener('dataavailable', (e) => ((bytes += e.data?.size || 0), chunks++));
      this.addEventListener('stop', () => note(`Instagram's recorder stopped after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${chunks} chunks, ${bytes} bytes`));
      this.addEventListener('error', (e) => note(`Instagram's recorder error: ${e.error?.name || ''} ${e.error?.message || ''}`));
      const track = this.stream?.getAudioTracks?.()[0];
      note(`Instagram's recorder started: ${this.mimeType || '(default type)'}, timeslice ${timeslice ?? 'none'}, audio track ${track ? `${track.readyState}${track.__ivn ? ' (the clip)' : ' (the real mic)'}` : 'none'}`);
      return start.call(this, timeslice);
    };
    MR.prototype.stop = function () {
      note(`Instagram's recorder stop() (was ${this.state})`);
      return stop.call(this);
    };
    MR.prototype.pause = function () {
      note(`Instagram's recorder pause() (was ${this.state})`);
      return pause.call(this);
    };
    MR.prototype.resume = function () {
      note(`Instagram's recorder resume() (was ${this.state})`);
      return resume.call(this);
    };
  }
  const AC = window.AudioContext;
  if (AC?.prototype?.createMediaStreamSource) {
    const source = AC.prototype.createMediaStreamSource;
    AC.prototype.createMediaStreamSource = function (stream) {
      if (this !== ctx) note(`Instagram reads the stream into its own audio graph at ${this.sampleRate} Hz`);
      return source.call(this, stream);
    };
  }
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
    const kind = JSON.stringify(constraints || {}).slice(0, 160);
    if (armed && constraints?.audio && !constraints.video) {
      const job = armed;
      armed = null;
      note(`mic requested ${kind}: gets the clip`);
      return playInto(job);
    }
    note(`mic requested ${kind}: ${armed ? 'not audio-only, gets the real device' : 'no clip loaded, gets the real device'}`);
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
      note('the clip finished playing into the recording');
      finished = true;
      monitor?.disconnect();
      if (!stopped) post('done', { label: job.label });
    };

    // Instagram stops the track when you send or delete; the track keeps sending silence until then.
    // A stop before the clip ends (cancel, or a quick mic probe) re-arms it so the real mic never slips in.
    const track = dest.stream.getAudioTracks()[0];
    track.__ivn = true;
    const realStop = track.stop.bind(track);
    track.stop = () => {
      realStop();
      if (stopped) return;
      note(`the clip's track was stopped by Instagram ${finished ? 'after the clip ended' : 'before the clip ended'}`);
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
