export const SR = 48000;
const FRAME = 480; // 10ms at 48k
const ms = (n) => Math.round((n / 1000) * SR);

export async function decodeToMono(arrayBuffer) {
  const buf = await new OfflineAudioContext(1, 1, SR).decodeAudioData(arrayBuffer);
  const ch = buf.numberOfChannels;
  if (ch === 1) return new Float32Array(buf.getChannelData(0));
  const out = new Float32Array(buf.length);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / ch;
  }
  return out;
}

function frameDb(s) {
  const n = Math.floor(s.length / FRAME);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * FRAME, e = i + FRAME; i < e; i++) sum += s[i] * s[i];
    out[f] = 10 * Math.log10(sum / FRAME + 1e-12);
  }
  return out;
}

function maxOf(arr) {
  let m = -Infinity;
  for (const v of arr) if (v > m) m = v;
  return m;
}

export function trimSilence(s, { floorDb = -55, rangeDb = 32, padStartMs = 90, padEndMs = 160 } = {}) {
  const db = frameDb(s);
  const peak = maxOf(db);
  if (!db.length || peak < floorDb) return new Float32Array(0);
  const thr = Math.max(floorDb, peak - rangeDb);
  let first = 0;
  while (db[first] < thr) first++;
  let last = db.length - 1;
  while (db[last] < thr) last--;
  const start = Math.max(0, first * FRAME - ms(padStartMs));
  const end = Math.min(s.length, (last + 1) * FRAME + ms(padEndMs));
  return s.slice(start, end);
}

// Gain to a common speech level so recorded lines match the pitch, then soft-limit peaks.
export function normalize(s, targetDb = -20) {
  const db = frameDb(s);
  const peakDb = maxOf(db);
  let sum = 0;
  let n = 0;
  for (const d of db) {
    if (d > peakDb - 25) {
      sum += 10 ** (d / 10);
      n++;
    }
  }
  if (!n) return s.slice();
  let g = 10 ** ((targetDb - 10 * Math.log10(sum / n)) / 20);
  let peak = 0;
  for (const x of s) peak = Math.max(peak, Math.abs(x));
  if (peak > 0) g = Math.min(g, 2 / peak);
  g = Math.min(g, 16);
  const out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const x = s[i] * g;
    const a = Math.abs(x);
    out[i] = a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
  }
  return out;
}

export function fade(s, fadeMs = 12) {
  const n = Math.min(ms(fadeMs), Math.floor(s.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    s[i] *= g;
    s[s.length - 1 - i] *= g;
  }
  return s;
}

// chopStart/End drop the click of the record/stop button before trimming.
export function processTake(samples, { chopStartMs = 0, chopEndMs = 0 } = {}) {
  const a = ms(chopStartMs);
  const b = samples.length - ms(chopEndMs);
  const trimmed = trimSilence(b > a ? samples.subarray(a, b) : new Float32Array(0));
  return trimmed.length ? fade(normalize(trimmed)) : trimmed;
}

// With no extra gap, parts overlap by an equal-power crossfade so the trimmed room tone flows across the joins.
export function concat(parts, gapMs = 0, xfadeMs = 30) {
  const gap = ms(gapMs);
  const xf = gap > 0 ? 0 : ms(xfadeMs);
  const overlap = (i) => (i ? Math.min(xf, parts[i].length, parts[i - 1].length) : 0);
  let total = 0;
  parts.forEach((p, i) => (total = (i ? total + gap - overlap(i) : 0) + p.length));
  const out = new Float32Array(total);
  let end = 0;
  parts.forEach((p, i) => {
    const ov = overlap(i);
    const start = i ? end + gap - ov : 0;
    for (let k = 0; k < ov; k++) {
      const t = ((k + 0.5) / ov) * (Math.PI / 2);
      out[start + k] = out[start + k] * Math.cos(t) + p[k] * Math.sin(t);
    }
    out.set(ov ? p.subarray(ov) : p, start + ov);
    end = start + p.length;
  });
  return out;
}

export function encodeWav(samples, sr = SR) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return buf;
}

export function toBase64(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(new Blob([arrayBuffer]));
  });
}

export class MicRecorder {
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
  }

  level() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (const v of this.buf) sum += v * v;
    return Math.sqrt(sum / this.buf.length);
  }

  async stop() {
    const stopped = new Promise((r) => (this.rec.onstop = r));
    this.rec.stop();
    await stopped;
    this.stream.getTracks().forEach((t) => t.stop());
    this.ctx.close();
    const blob = new Blob(this.chunks, { type: this.rec.mimeType });
    return decodeToMono(await blob.arrayBuffer());
  }
}
