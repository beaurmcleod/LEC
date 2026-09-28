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

// ---------- Spectrum ----------
// In-place radix-2 FFT; the inverse swaps the real and imaginary parts around a forward pass.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}
function ifft(re, im) {
  fft(im, re);
  const n = re.length;
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] /= n;
  }
}
const hann = (n) => Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));

// Power spectrum of one windowed frame (n samples from `at`), bins 0..n/2.
function powerSpectrum(s, at, win, re, im) {
  const n = win.length;
  for (let i = 0; i < n; i++) {
    const k = at + i;
    re[i] = k >= 0 && k < s.length ? s[k] * win[i] : 0;
    im[i] = 0;
  }
  fft(re, im);
  const out = new Float32Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
  return out;
}

// Long-term spectrum of the speech in a take, in 24 bands of about a third of an octave from 80 Hz to 12 kHz,
// each in dB. Quiet frames (pauses) are left out so the pauses' room tone doesn't count as tone.
const BAND_N = 24;
const BAND_LO = 80;
const BAND_HI = 12000;
const bandEdge = (i) => BAND_LO * (BAND_HI / BAND_LO) ** (i / BAND_N);
export function toneBands(s) {
  const N = 2048;
  const win = hann(N);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const db = frameDb(s);
  const thr = maxOf(db) - 25;
  const acc = new Float64Array(N / 2 + 1);
  let frames = 0;
  for (let at = 0; at + N <= s.length; at += N / 2) {
    const f = Math.floor((at + N / 2) / FRAME);
    if (db[f] === undefined || db[f] < thr) continue;
    const P = powerSpectrum(s, at, win, re, im);
    for (let k = 0; k < P.length; k++) acc[k] += P[k];
    frames++;
  }
  const bands = new Float32Array(BAND_N);
  if (!frames) return bands.fill(-120);
  const hz = SR / N;
  for (let b = 0; b < BAND_N; b++) {
    const k0 = Math.max(1, Math.round(bandEdge(b) / hz));
    const k1 = Math.max(k0 + 1, Math.round(bandEdge(b + 1) / hz));
    let sum = 0;
    for (let k = k0; k < k1; k++) sum += acc[k];
    bands[b] = 10 * Math.log10(sum / ((k1 - k0) * frames) + 1e-20);
  }
  return bands;
}

// Bands with real content in both takes: within 45 dB of each take's loudest band. Empty bands are just noise
// floor, and comparing two noise floors says nothing about tone.
function heardBands(a, b) {
  const ma = maxOf(a) - 45;
  const mb = maxOf(b) - 45;
  return Array.from({ length: BAND_N }, (_, i) => a[i] > ma && b[i] > mb);
}

// How different two takes sound in tone: the spread of their band-by-band level differences (dB, RMS), and the
// tilt: how much brighter (+) or darker (-) `a` is than `b`, from the bands above 2 kHz against those below 500 Hz.
export function toneGap(a, b) {
  const use = heardBands(a, b);
  const d = Array.from({ length: BAND_N }, (_, i) => a[i] - b[i]);
  const mean = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
  const rel = d.map((v) => v - mean(d.filter((_, i) => use[i])));
  const idx = (lo, hi) => rel.filter((_, i) => use[i] && Math.sqrt(bandEdge(i) * bandEdge(i + 1)) >= lo && Math.sqrt(bandEdge(i) * bandEdge(i + 1)) < hi);
  const used = rel.filter((_, i) => use[i]);
  return { spread: used.length ? Math.sqrt(used.reduce((x, v) => x + v * v, 0) / used.length) : 0, tilt: mean(idx(2000, Infinity)) - mean(idx(0, 500)), bands: use.filter(Boolean).length };
}

// EQs a take so its tone matches `ref` (a toneBands result): each band is turned up or down by the difference,
// at most maxDb, smoothed across bands. Applied as a zero-phase filter through an overlap-add STFT, so
// nothing else about the take changes.
export function toneMatch(s, ref, maxDb = 8) {
  const own = toneBands(s);
  const before = toneGap(own, ref);
  const use = heardBands(own, ref);
  // Level is handled elsewhere, so only the shape of the spectrum is matched, and only where both takes have
  // something to compare.
  const diffs = Array.from(ref, (r, i) => r - own[i]).filter((_, i) => use[i]);
  const offset = diffs.length ? diffs.reduce((x, y) => x + y, 0) / diffs.length : 0;
  let g = Array.from(ref, (r, i) => (use[i] ? Math.max(-maxDb, Math.min(maxDb, r - own[i] - offset)) : 0));
  for (let pass = 0; pass < 2; pass++) g = g.map((v, i) => 0.25 * (g[i - 1] ?? v) + 0.5 * v + 0.25 * (g[i + 1] ?? v));
  const N = 2048;
  const hop = N / 4;
  const win = hann(N);
  const hz = SR / N;
  // Per-bin gain, interpolated between band centres on a log-frequency axis and tapering to unity outside.
  const centres = Array.from({ length: BAND_N }, (_, i) => Math.log(Math.sqrt(bandEdge(i) * bandEdge(i + 1))));
  const gain = new Float32Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) {
    const f = Math.log(Math.max(1, k * hz));
    let db;
    if (f <= centres[0]) db = g[0] * Math.max(0, 1 - (centres[0] - f) / Math.log(2));
    else if (f >= centres[BAND_N - 1]) db = g[BAND_N - 1] * Math.max(0, 1 - (f - centres[BAND_N - 1]) / Math.log(2));
    else {
      let i = 0;
      while (centres[i + 1] < f) i++;
      const t = (f - centres[i]) / (centres[i + 1] - centres[i]);
      db = g[i] * (1 - t) + g[i + 1] * t;
    }
    gain[k] = 10 ** (db / 20);
  }
  const out = new Float32Array(s.length);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let at = -N + hop; at < s.length; at += hop) {
    for (let i = 0; i < N; i++) {
      const k = at + i;
      re[i] = k >= 0 && k < s.length ? s[k] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k <= N / 2; k++) {
      re[k] *= gain[k];
      im[k] *= gain[k];
      if (k && k < N / 2) {
        re[N - k] *= gain[k];
        im[N - k] *= gain[k];
      }
    }
    ifft(re, im);
    // A Hann window at 75% overlap sums to 2.
    for (let i = 0; i < N; i++) {
      const k = at + i;
      if (k >= 0 && k < s.length) out[k] += re[i] / 2;
    }
  }
  // Changing the tone changes how loud it reads; put the level back so this composes with level matching.
  const back = loudness(s) - loudness(out);
  const level = Number.isFinite(back) ? softLimit(out, 10 ** (back / 20)) : out;
  return { samples: level, before, after: toneGap(toneBands(level), ref), maxChange: Math.max(...g.map(Math.abs)) };
}

// A level change in dB, with the soft limiter so a boost never clips.
export const gainDb = (s, db) => (db ? softLimit(s, 10 ** (db / 20)) : s);

// The quietest 100 ms of a take (the pause at either end, or between words): where it starts and its level in dB.
export function quietest(s) {
  const db = frameDb(s);
  const w = 10;
  if (db.length < w) return { at: 0, db: db.length ? Math.min(...db) : -Infinity };
  let best = { at: 0, db: Infinity };
  for (let i = 0; i + w <= db.length; i++) {
    let p = 0;
    for (let k = i; k < i + w; k++) p += 10 ** (db[k] / 10);
    const level = 10 * Math.log10(p / w);
    if (level < best.db) best = { at: i * FRAME, db: level };
  }
  return best;
}
export const roomTone = (s) => quietest(s).db;

// A stretch of room air of the given length, made from a take's quietest 100 ms tiled back and forth with
// short crossfades, so a pause added at a join breathes like the room rather than going dead silent.
export function roomAir(s, lengthMs) {
  const q = quietest(s);
  const slice = s.slice(q.at, Math.min(s.length, q.at + ms(100)));
  if (!slice.length) return new Float32Array(ms(lengthMs));
  const back = slice.slice().reverse();
  const parts = [];
  for (let have = 0, i = 0; have < ms(lengthMs); i++) {
    parts.push(i % 2 ? back : slice);
    have += slice.length - ms(10);
  }
  return join(parts, 0, 10).samples.slice(0, ms(lengthMs));
}

// How much quiet a take has at its start and end (ms), by the same rule trimSilence uses.
export function quietEdges(s, { floorDb = -55, rangeDb = 32 } = {}) {
  const db = frameDb(s);
  const peak = maxOf(db);
  if (!db.length || peak < floorDb) return { headMs: (s.length / SR) * 1000, tailMs: 0 };
  const thr = Math.max(floorDb, peak - rangeDb);
  let head = 0;
  while (head < db.length && db[head] < thr) head++;
  let tail = 0;
  while (tail < db.length - head && db[db.length - 1 - tail] < thr) tail++;
  return { headMs: head * 10, tailMs: tail * 10 };
}

// Eases the last `tailMs` of a take down by `db` (a ramp in dB), so a take whose room noise is louder than what
// follows steps down to it before the join instead of at it.
export function easeTail(s, tailMs, db) {
  const n = Math.min(ms(tailMs), s.length);
  const out = s.slice();
  for (let i = 0; i < n; i++) out[s.length - n + i] *= 10 ** ((db * (i + 1)) / n / 20);
  return out;
}

// ---------- Breaths ----------
// Finds the breaths in a take: quiet, noisy, unpitched stretches inside the pauses between phrases. Each frame is
// 10 ms. Voiced speech repeats at its pitch (80-400 Hz), which shows up as a strong autocorrelation peak; a
// breath is noise, so it doesn't, and its spectrum is flat rather than a comb of harmonics. A breath's energy
// is spread from a few hundred Hz to a few kHz; an "s" is nearly all above 3.5 kHz and room hum nearly all
// below 400 Hz, so neither is mistaken for one.
const DS = 6; // voicing is checked at 8 kHz

function frameStats(s) {
  const n = Math.floor(s.length / FRAME);
  const low = new Float32Array(Math.floor(s.length / DS));
  for (let i = 0; i < low.length; i++) {
    let sum = 0;
    for (let k = 0; k < DS; k++) sum += s[i * DS + k];
    low[i] = sum / DS;
  }
  const N = 1024;
  const win = hann(N);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const hz = SR / N;
  const bin = (f) => Math.round(f / hz);
  const [b60, b400, b3500, b6000, b10k] = [60, 400, 3500, 6000, 10000].map(bin);
  const acWin = 240; // 30 ms at 8 kHz
  const out = [];
  for (let f = 0; f < n; f++) {
    let e = 0;
    for (let i = f * FRAME, end = i + FRAME; i < end; i++) e += s[i] * s[i];
    const P = powerSpectrum(s, f * FRAME + FRAME / 2 - N / 2, win, re, im);
    let lo = 0;
    let mid = 0;
    let hi = 0;
    for (let k = b60; k < b400; k++) lo += P[k];
    for (let k = b400; k < b3500; k++) mid += P[k];
    for (let k = b3500; k < b10k; k++) hi += P[k];
    const total = lo + mid + hi + 1e-20;
    let logSum = 0;
    let linSum = 0;
    for (let k = b400; k < b6000; k++) {
      logSum += Math.log(P[k] + 1e-20);
      linSum += P[k];
    }
    const flat = Math.exp(logSum / (b6000 - b400)) / (linSum / (b6000 - b400) + 1e-20);
    const c = Math.floor((f * FRAME) / DS);
    let voiced = 0;
    if (c + acWin + 100 < low.length) {
      let e0 = 0;
      for (let i = 0; i < acWin; i++) e0 += low[c + i] * low[c + i];
      for (let lag = 20; lag <= 100 && e0 > 0; lag++) {
        let r = 0;
        let el = 0;
        for (let i = 0; i < acWin; i++) {
          r += low[c + i] * low[c + i + lag];
          el += low[c + i + lag] * low[c + i + lag];
        }
        voiced = Math.max(voiced, r / Math.sqrt(e0 * el + 1e-20));
      }
    }
    out.push({ db: 10 * Math.log10(e / FRAME + 1e-12), lo: lo / total, mid: mid / total, hi: hi / total, flat, voiced });
  }
  return out;
}

// Returns [{ start, end, seconds, at, db }] in samples, best candidates first.
export function findBreaths(s) {
  const st = frameStats(s);
  if (st.length < 50) return [];
  const sorted = st.map((x) => x.db).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const peak = sorted[sorted.length - 1];
  const loud = sorted.filter((d) => d > peak - 25);
  const ref = 10 * Math.log10(loud.reduce((a, d) => a + 10 ** (d / 10), 0) / loud.length);
  const speech = (x) => (x.voiced > 0.5 && x.db > floor + 10) || x.db > ref - 6;
  const breathy = (x) => !speech(x) && x.db > floor + 6 && x.db > ref - 50 && x.lo <= 0.7 && x.hi <= 0.7 && x.flat >= 0.12;

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
    if (p0 === 0 || p1 >= st.length || p1 - p0 < 15) continue;
    // The breathy stretch inside it, allowing short dips, at least 20 ms clear of the words on either side.
    let best = null;
    for (let i = p0 + 2; i < p1 - 2; i++) {
      if (!breathy(st[i])) continue;
      let j = i;
      for (let k = i + 1, miss = 0; k < p1 - 2; k++) {
        if (breathy(st[k])) (j = k), (miss = 0);
        else if (++miss > 3) break;
      }
      const frames = j - i + 1;
      let top = -Infinity;
      for (let k = i; k <= j; k++) top = Math.max(top, st[k].db);
      if (frames >= 12 && frames <= 100 && top > floor + 9 && top > ref - 46 && (!best || frames > best.frames)) best = { i, j, frames, top };
      i = j;
    }
    if (best) found.push({ start: best.i * FRAME, end: (best.j + 1) * FRAME, seconds: best.frames / 100, at: (best.i * FRAME) / SR, db: Math.round(best.top - ref) });
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
// Also returns where each part starts in the result.
export function join(parts, gapMs = 0, xfadeMs = 30) {
  const gap = ms(gapMs);
  const xf = gap > 0 ? 0 : ms(xfadeMs);
  const overlap = (i) => (i ? Math.min(xf, parts[i].length, parts[i - 1].length) : 0);
  let total = 0;
  parts.forEach((p, i) => (total = (i ? total + gap - overlap(i) : 0) + p.length));
  const out = new Float32Array(total);
  const starts = [];
  let end = 0;
  parts.forEach((p, i) => {
    const ov = overlap(i);
    const start = i ? end + gap - ov : 0;
    starts.push(start);
    for (let k = 0; k < ov; k++) {
      const t = ((k + 0.5) / ov) * (Math.PI / 2);
      out[start + k] = out[start + k] * Math.cos(t) + p[k] * Math.sin(t);
    }
    out.set(ov ? p.subarray(ov) : p, start + ov);
    end = start + p.length;
  });
  return { samples: out, starts };
}
export const concat = (parts, gapMs = 0, xfadeMs = 30) => join(parts, gapMs, xfadeMs).samples;

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
