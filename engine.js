/* HiveEar acoustic engine: hive sound synthesis (demo samples) + analysis.
   Pure functions, no DOM. Works in browser and Node. */
(function (root) {
  'use strict';

  // ---------- utilities ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function median(arr) { const a = Array.from(arr).sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

  // ---------- synthesis of demo hive recordings ----------
  // Models published hive acoustics: worker hum fundamental ~200-280 Hz with harmonics,
  // queenless "roar" (raised, spread pitch, irregular loudness), and pre-swarm queen
  // piping (tooting ~400-500 Hz pulses, quacking ~300-350 Hz pulses).
  const SR_SYN = 16000;

  function addBees(buf, sr, r, o) {
    const n = buf.length;
    for (let b = 0; b < o.count; b++) {
      const f = o.base * (1 + gauss(r) * o.spread);
      const wob = 0.004 + r() * o.wobble, wobF = 0.1 + r() * 0.5, wobP = r() * 6.28;
      const amp = (0.6 + r() * 0.8) / o.count;
      const ph = o.harm.map(() => r() * 6.28);
      for (let h = 0; h < o.harm.length; h++) {
        const a = amp * o.harm[h];
        let phase = ph[h];
        const k = (h + 1) * 2 * Math.PI / sr;
        for (let i = 0; i < n; i++) {
          const fi = f * (1 + wob * Math.sin(wobF * 6.283 * i / sr + wobP));
          phase += k * fi;
          buf[i] += a * Math.sin(phase);
        }
      }
    }
  }
  function addNoise(buf, r, level, smooth) {
    let y = 0;
    for (let i = 0; i < buf.length; i++) { y += smooth * ((r() * 2 - 1) - y); buf[i] += level * y * 3; }
  }
  function addPipe(buf, sr, r, start, dur, f0, harm, amp, rise) {
    const s = Math.floor(start * sr), e = Math.min(buf.length, Math.floor((start + dur) * sr));
    let phase = r() * 6.28;
    for (let i = s; i < e; i++) {
      const t = (i - s) / sr, env = Math.min(1, t / 0.03, (dur - t) / 0.04);
      const f = f0 * (1 + rise * t / dur);
      phase += 2 * Math.PI * f / sr;
      let v = 0; for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin((h + 1) * phase);
      buf[i] += amp * env * v;
    }
  }
  function normalize(buf, peak) {
    let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    const g = peak / (m || 1); for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf;
  }

  function synthesize(kind, seed, seconds) {
    const sr = SR_SYN, n = Math.floor((seconds || 8) * sr), r = mulberry32(seed || 7);
    const buf = new Float32Array(n);
    if (kind === 'queenless') {
      addBees(buf, sr, r, { count: 34, base: 330, spread: 0.13, wobble: 0.03, harm: [1, 0.75, 0.55, 0.35] });
      addNoise(buf, r, 0.32, 0.35);
      // irregular "roar": slow random loudness swings
      let env = 1, tgt = 1;
      for (let i = 0; i < n; i++) { if (i % 1600 === 0) tgt = 0.45 + r() * 1.3; env += 0.0008 * (tgt - env); buf[i] *= env; }
    } else {
      addBees(buf, sr, r, { count: 36, base: 245, spread: 0.035, wobble: 0.01, harm: [1, 0.45, 0.2] });
      addNoise(buf, r, 0.12, 0.12);
      if (kind === 'swarm') {
        let t = 0.6 + r() * 0.4;
        while (t < seconds - 1.2) {
          addPipe(buf, sr, r, t, 0.9, 455 + r() * 25, [1, 0.5, 0.3], 0.35, 0.03); // long toot
          let u = t + 1.05;
          for (let k = 0; k < 3; k++) { addPipe(buf, sr, r, u, 0.22, 470 + r() * 20, [1, 0.5, 0.3], 0.32, 0.02); u += 0.32; }
          // answering quacks from virgin queens in cells
          for (let k = 0; k < 4; k++) addPipe(buf, sr, r, u + 0.15 + k * 0.17, 0.09, 330 + r() * 15, [1, 0.8, 0.5], 0.28, 0);
          t = u + 2.6 + r() * 1.4;
        }
      }
    }
    return { sampleRate: sr, data: normalize(buf, 0.85) };
  }

  // ---------- FFT ----------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const a = i + j, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  // ---------- analysis ----------
  const MAX_F = 2000;
  function decimate(data, sr) {
    const factor = Math.max(1, Math.floor(sr / 8000));
    if (factor === 1) return { data, sr };
    const out = new Float32Array(Math.floor(data.length / factor));
    for (let i = 0; i < out.length; i++) { let s = 0; for (let k = 0; k < factor; k++) s += data[i * factor + k]; out[i] = s / factor; }
    return { data: out, sr: sr / factor };
  }

  function analyze(input, sampleRate) {
    let { data, sr } = decimate(input, sampleRate);
    const maxLen = Math.floor(sr * 30);
    if (data.length > maxLen) data = data.subarray(0, maxLen);
    const N = 2048, hop = 512;
    const binHz = sr / N, kMax = Math.min(N / 2, Math.floor(MAX_F / binHz));
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    const frames = [];
    let sumSq = 0; for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
    const rms = Math.sqrt(sumSq / Math.max(1, data.length));
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let s = 0; s + N <= data.length; s += hop) {
      for (let i = 0; i < N; i++) { re[i] = data[s + i] * win[i]; im[i] = 0; }
      fft(re, im);
      const p = new Float32Array(kMax);
      for (let k = 0; k < kMax; k++) p[k] = re[k] * re[k] + im[k] * im[k];
      frames.push(p);
    }
    const T = frames.length;
    if (T < 8) return { error: 'Recording is too short. Use at least 3 seconds of hive sound.' };
    const bin = (f) => Math.max(0, Math.min(kMax - 1, Math.round(f / binHz)));
    const avg = new Float64Array(kMax);
    for (const p of frames) for (let k = 0; k < kMax; k++) avg[k] += p[k] / T;
    // steady-state spectrum: per-bin median over time (ignores short piping bursts)
    const steady = new Float64Array(kMax), colT = new Float32Array(T);
    for (let k = 0; k <= Math.min(kMax - 1, Math.round(1500 / binHz)); k++) { for (let t = 0; t < T; t++) colT[t] = frames[t][k]; steady[k] = median(colT); }
    const bandE = (spec, a, b) => { let e = 0; for (let k = bin(a); k <= bin(b); k++) e += spec[k]; return e; };

    // dominant frequency
    let kPk = bin(100); for (let k = bin(100); k <= bin(600); k++) if (steady[k] > steady[kPk]) kPk = k;
    const f0 = kPk * binHz;
    // spectral centroid 100-1500
    let num = 0, den = 0; for (let k = bin(100); k <= bin(1500); k++) { num += k * binHz * steady[k]; den += steady[k]; }
    const centroid = num / (den || 1);
    // spectral flatness 150-700 (smoothed to bandwidth ~ 20 Hz to ignore bin jitter)
    let lg = 0, ar = 0, cnt = 0;
    for (let k = bin(150); k <= bin(700); k++) { const v = steady[k] + 1e-12; lg += Math.log(v); ar += v; cnt++; }
    const flatness = Math.exp(lg / cnt) / (ar / cnt);
    const bandRatio = bandE(steady, 300, 600) / (bandE(steady, 150, 300) || 1e-12);
    // loudness irregularity (coefficient of variation of 150-700 Hz frame energy, ~0.5 s blocks)
    const fe = frames.map((p) => bandE(p, 150, 700));
    const blk = Math.max(1, Math.round(0.5 * sr / hop)), be = [];
    for (let i = 0; i + blk <= T; i += blk) { let s = 0; for (let j = 0; j < blk; j++) s += fe[i + j]; be.push(Math.sqrt(s / blk)); }
    const mBE = be.reduce((a, b) => a + b, 0) / be.length;
    const cv = Math.sqrt(be.reduce((a, b) => a + (b - mBE) ** 2, 0) / be.length) / (mBE || 1);

    // piping / quacking events: narrow tonal bursts far above that bin's own typical level
    const medBin = new Float32Array(kMax);
    const col = new Float32Array(T);
    for (let k = bin(280); k <= bin(560); k++) { for (let t = 0; t < T; t++) col[t] = frames[t][k]; medBin[k] = median(col) + 1e-12; }
    const medFE = median(fe) + 1e-12;
    const tonal = new Uint8Array(T), tonalF = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      const g = fe[t] / medFE; let best = 0, bk = 0;
      for (let k = bin(300); k <= bin(540); k++) { const rr = frames[t][k] / medBin[k] / Math.max(1, g); if (rr > best) { best = rr; bk = k; } }
      if (best > 12) {
        const w = Math.round(40 / binHz); let side = 0, c = 0;
        for (let k = bk - 2 * w; k <= bk + 2 * w; k++) if (Math.abs(k - bk) >= w && k > 0 && k < kMax) { side += frames[t][k]; c++; }
        if (frames[t][bk] / (side / c + 1e-12) > 20) { tonal[t] = 1; tonalF[t] = bk * binHz; }
      }
    }
    const events = [];
    for (let t = 0; t < T;) {
      if (!tonal[t]) { t++; continue; }
      let u = t, fs = 0; while (u < T && tonal[u]) { fs += tonalF[u]; u++; }
      if (u - t >= 2) {
        const f = fs / (u - t), dur = (u - t) * hop / sr;
        events.push({ start: t * hop / sr, dur, freq: f, kind: f >= 400 ? 'toot' : 'quack' });
      }
      t = u;
    }
    const seconds = data.length / sr;
    const pipingPerMin = events.length / seconds * 60;

    // ---- scoring (rule model calibrated on published band ranges) ----
    const sQ = 2.4 * clamp01((f0 - 270) / 70) + 1.6 * clamp01((flatness - 0.12) / 0.25) +
               1.4 * clamp01((bandRatio - 0.5) / 0.9) + 1.4 * clamp01((cv - 0.12) / 0.25);
    const sS = 3.2 * clamp01(pipingPerMin / 12) + 1.2 * clamp01(events.filter((e) => e.kind === 'quack').length / 4);
    const logits = { healthy: 2.6 - 1.1 * sQ - 1.3 * sS, queenless: 1.25 * sQ - 2.0, swarm: 1.5 * sS - 1.4 };
    const mx = Math.max(...Object.values(logits));
    const ex = {}; let z = 0; for (const k in logits) { ex[k] = Math.exp(logits[k] - mx); z += ex[k]; }
    const probs = {}; for (const k in ex) probs[k] = 0.02 + 0.94 * ex[k] / z; // keep calibrated headroom: never claim 100%
    const top = Object.keys(probs).sort((a, b) => probs[b] - probs[a])[0];
    const dbfs = 20 * Math.log10(rms + 1e-9);
    const quality = dbfs < -50 ? 'too_quiet' : (seconds < 5 ? 'short' : 'ok');
    // a pre-swarm colony is strong but about to split; a queenless one is in real danger
    const healthScore = Math.round((100 * probs.healthy + 35 * probs.swarm + 4 * probs.queenless) * (quality === 'too_quiet' ? 0.5 : 1));

    // downsampled spectrogram for display (dB), time x freq up to 1000 Hz
    const dispK = Math.min(kMax, bin(1000) + 1);
    const step = Math.max(1, Math.floor(T / 400));
    const spec = [];
    for (let t = 0; t < T; t += step) { const row = new Float32Array(dispK); for (let k = 0; k < dispK; k++) row[k] = 10 * Math.log10(frames[t][k] + 1e-12); spec.push(row); }
    const avgDb = Array.from(avg.slice(0, dispK), (v) => 10 * Math.log10(v + 1e-12));

    return {
      verdict: top, probs, healthScore, quality, seconds, dbfs,
      features: { f0, centroid, flatness, bandRatio, cv, pipingPerMin, events: events.length },
      events, spectrogram: { rows: spec, binHz, frameSec: hop * step / sr }, spectrum: { db: avgDb, binHz }
    };
  }

  const api = { synthesize, analyze, SR_SYN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HiveEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
