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
  return softLimit(s, g);
}

// Applies a gain, rounding off anything above 0.8 so peaks never clip.
function softLimit(s, g) {
  const out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const x = s[i] * g;
    const a = Math.abs(x);
    out[i] = a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
  }
  return out;
}

// K-weighting from ITU-R BS.1770 (48 kHz): a gentle high shelf plus a low cut, so the measurement follows how
// loud speech sounds rather than how much low rumble it has.
const K_STAGES = [
  { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
  { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] },
];

function kWeighted(s) {
  let x = s;
  for (const { b, a } of K_STAGES) {
    const y = new Float32Array(x.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      x2 = x1;
      x1 = x[i];
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
    x = y;
  }
  return x;
}

// How loud a recording sounds, in LUFS (the broadcast loudness measure, BS.1770). Measured over 400 ms windows,
// leaving out silence and quiet stretches, so pauses between sentences don't drag a long pitch's number down.
export function loudness(s) {
  const k = kWeighted(s);
  const block = Math.min(ms(400), k.length);
  const hop = ms(100);
  if (!block) return -Infinity;
  // Running sum of squares, so each window is two lookups.
  const cum = new Float64Array(k.length + 1);
  for (let i = 0; i < k.length; i++) cum[i + 1] = cum[i] + k[i] * k[i];
  const powers = [];
  for (let at = 0; at + block <= k.length; at += hop) powers.push((cum[at + block] - cum[at]) / block);
  const lufs = (p) => -0.691 + 10 * Math.log10(p + 1e-15);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const heard = powers.filter((p) => lufs(p) > -70);
  if (!heard.length) return -Infinity;
  const gate = lufs(mean(heard)) - 10;
  const speech = heard.filter((p) => lufs(p) > gate);
  return lufs(mean(speech.length ? speech : heard));
}

// Turns a part up or down to sound as loud as targetLufs (at most maxDb either way), keeping peaks from clipping.
// Returns the new samples and the change in dB.
export function matchLoudness(s, targetLufs, maxDb = 18) {
  const start = loudness(s);
  if (!Number.isFinite(start) || !Number.isFinite(targetLufs)) return { samples: s, db: 0 };
  let db = Math.max(-maxDb, Math.min(maxDb, targetLufs - start));
  if (Math.abs(db) < 0.2) return { samples: s, db: 0 };
  let out = softLimit(s, 10 ** (db / 20));
  // The limiter takes a little off loud takes that get turned up, so correct for it.
  for (let i = 0; i < 2; i++) {
    const miss = targetLufs - loudness(out);
    if (Math.abs(miss) < 0.2) break;
    db = Math.max(-maxDb, Math.min(maxDb, db + miss));
    out = softLimit(s, 10 ** (db / 20));
  }
  return { samples: out, db };
}

// ---------- Breaths ----------
// Finds the breaths in a take: quiet, noisy (unpitched) stretches inside the pauses between phrases. Each frame
// is 10 ms. Voiced speech repeats at its pitch (80-400 Hz), which shows up as a strong autocorrelation peak;
// a breath is noise, so it doesn't. A breath's sound sits around 600-4500 Hz; an "s" is brighter than that,
// so a word-final or word-initial "s" next to a pause isn't mistaken for one.
const DS = 6; // analyse at 8 kHz

function frameStats(s) {
  const n = Math.floor(s.length / FRAME);
  const low = new Float32Array(Math.floor(s.length / DS));
  for (let i = 0; i < low.length; i++) {
    let sum = 0;
    for (let k = 0; k < DS; k++) sum += s[i * DS + k];
    low[i] = sum / DS;
  }
  const win = 240; // 30 ms at 8 kHz
  const out = [];
  for (let f = 0; f < n; f++) {
    let e = 0;
    let d = 0;
    for (let i = f * FRAME + 1, end = i + FRAME - 1; i < end; i++) {
      e += s[i] * s[i];
      d += (s[i] - s[i - 1]) ** 2;
    }
    // Rough spectral centroid from how much the signal changes sample to sample.
    const centroid = e > 0 ? (SR / (2 * Math.PI)) * Math.sqrt(d / e) : 0;
    const c = Math.floor((f * FRAME) / DS);
    let voiced = 0;
    if (c + win + 100 < low.length) {
      let e0 = 0;
      for (let i = 0; i < win; i++) e0 += low[c + i] * low[c + i];
      for (let lag = 20; lag <= 100 && e0 > 0; lag++) {
        let r = 0;
        let el = 0;
        for (let i = 0; i < win; i++) {
          r += low[c + i] * low[c + i + lag];
          el += low[c + i + lag] * low[c + i + lag];
        }
        voiced = Math.max(voiced, r / Math.sqrt(e0 * el + 1e-20));
      }
    }
    out.push({ db: 10 * Math.log10(e / FRAME + 1e-12), centroid, voiced });
  }
  return out;
}

// Returns [{ start, end, seconds, at }] in samples, best candidates first.
export function findBreaths(s) {
  const st = frameStats(s);
  if (st.length < 50) return [];
  const sorted = st.map((x) => x.db).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const peak = sorted[sorted.length - 1];
  const loud = sorted.filter((d) => d > peak - 25);
  const ref = 10 * Math.log10(loud.reduce((a, d) => a + 10 ** (d / 10), 0) / loud.length);
  const speech = (x) => (x.voiced > 0.5 && x.db > floor + 10) || x.db > ref - 6;
  const breathy = (x) => !speech(x) && x.db > floor + 6 && x.centroid > 600 && x.centroid < 4500;

  const found = [];
  let f = 0;
  while (f < st.length) {
    if (speech(st[f])) {
      f++;
      continue;
    }
    // A pause: the frames up to the next speech.
    const p0 = f;
    while (f < st.length && !speech(st[f])) f++;
    const p1 = f;
    if (p0 === 0 || p1 >= st.length || p1 - p0 < 25) continue;
    // The breathy stretch inside it, allowing short dips, at least 30 ms clear of the words on either side.
    let best = null;
    for (let i = p0 + 3; i < p1 - 3; i++) {
      if (!breathy(st[i])) continue;
      let j = i;
      for (let k = i + 1, miss = 0; k < p1 - 3; k++) {
        if (breathy(st[k])) (j = k), (miss = 0);
        else if (++miss > 3) break;
      }
      const frames = j - i + 1;
      let top = -Infinity;
      for (let k = i; k <= j; k++) top = Math.max(top, st[k].db);
      if (frames >= 15 && frames <= 100 && top > floor + 12 && (!best || frames > best.frames)) best = { i, j, frames };
      i = j;
    }
    if (best) found.push({ start: best.i * FRAME, end: (best.j + 1) * FRAME, seconds: best.frames / 100, at: (best.i * FRAME) / SR });
  }
  // The most typical breaths first: close to half a second.
  return found.sort((a, b) => Math.abs(a.seconds - 0.45) - Math.abs(b.seconds - 0.45));
}

// The breath with a little of the pause around it, faded at both ends, ready to go between two parts.
export function breathClip(s, b, padMs = 60) {
  return fade(s.slice(Math.max(0, b.start - ms(padMs)), Math.min(s.length, b.end + ms(padMs))), 20);
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
