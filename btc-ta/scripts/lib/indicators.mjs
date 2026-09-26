// Classic indicators. Every function returns arrays aligned 1:1 with the input, `null` where undefined.
// Smoothing conventions follow TradingView defaults (Wilder RMA for RSI/ATR/ADX).

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) { sum = 0; count = 0; continue; }
    sum += v; count++;
    if (count > n) { sum -= values[i - n]; count = n; }
    if (count === n) out[i] = sum / n;
  }
  return out;
}

// EMA seeded with the SMA of the first n valid values.
export function ema(values, n, alpha = 2 / (n + 1)) {
  const out = new Array(values.length).fill(null);
  let prev = null, seed = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed.push(v);
      if (seed.length === n) { prev = seed.reduce((a, b) => a + b, 0) / n; out[i] = prev; }
      continue;
    }
    prev = alpha * v + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

export const rma = (values, n) => ema(values, n, 1 / n);

export function stdev(values, n) {
  const mean = sma(values, n);
  return values.map((_, i) => {
    if (mean[i] == null) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (values[j] - mean[i]) ** 2;
    return Math.sqrt(s / n);
  });
}

export function rsi(closes, n = 14) {
  const gains = [null], losses = [null];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(Math.max(d, 0)); losses.push(Math.max(-d, 0));
  }
  const ag = rma(gains, n), al = rma(losses, n);
  return closes.map((_, i) => ag[i] == null ? null : al[i] === 0 ? 100 : 100 - 100 / (1 + ag[i] / al[i]));
}

export function stochRsi(closes, rsiLen = 14, stochLen = 14, kLen = 3, dLen = 3) {
  const r = rsi(closes, rsiLen);
  const raw = r.map((v, i) => {
    if (v == null || i < stochLen - 1 || r[i - stochLen + 1] == null) return null;
    const win = r.slice(i - stochLen + 1, i + 1);
    const lo = Math.min(...win), hi = Math.max(...win);
    return hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
  });
  const k = sma(raw, kLen);
  return { k, d: sma(k, dLen) };
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const f = ema(closes, fast), s = ema(closes, slow);
  const line = closes.map((_, i) => f[i] == null || s[i] == null ? null : f[i] - s[i]);
  const sig = ema(line, signal);
  return { line, signal: sig, hist: line.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]) };
}

export function trueRange(c) {
  return c.map((b, i) => i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - c[i - 1].close), Math.abs(b.low - c[i - 1].close)));
}

export const atr = (c, n = 14) => rma(trueRange(c), n);

export function adx(c, n = 14) {
  const plusDM = [0], minusDM = [0];
  for (let i = 1; i < c.length; i++) {
    const up = c[i].high - c[i - 1].high, down = c[i - 1].low - c[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = rma(trueRange(c), n), p = rma(plusDM, n), m = rma(minusDM, n);
  const plusDI = tr.map((t, i) => t ? (100 * p[i]) / t : null);
  const minusDI = tr.map((t, i) => t ? (100 * m[i]) / t : null);
  const dx = plusDI.map((pv, i) => pv == null ? null : (pv + minusDI[i] === 0 ? 0 : (100 * Math.abs(pv - minusDI[i])) / (pv + minusDI[i])));
  return { adx: rma(dx, n), plusDI, minusDI };
}

export function bollinger(closes, n = 20, mult = 2) {
  const mid = sma(closes, n), sd = stdev(closes, n);
  const upper = mid.map((m, i) => m == null ? null : m + mult * sd[i]);
  const lower = mid.map((m, i) => m == null ? null : m - mult * sd[i]);
  const width = mid.map((m, i) => m == null ? null : (upper[i] - lower[i]) / m);
  const pctB = closes.map((cl, i) => mid[i] == null ? null : (cl - lower[i]) / (upper[i] - lower[i]));
  return { mid, upper, lower, width, pctB };
}

export function obv(c) {
  const out = [0];
  for (let i = 1; i < c.length; i++) {
    const d = Math.sign(c[i].close - c[i - 1].close);
    out.push(out[i - 1] + d * c[i].volume);
  }
  return out;
}

// VWAP anchored at bar `from` (typical price weighted by volume).
export function anchoredVwap(c, from) {
  const out = new Array(c.length).fill(null);
  let pv = 0, v = 0;
  for (let i = from; i < c.length; i++) {
    const tp = (c[i].high + c[i].low + c[i].close) / 3;
    pv += tp * c[i].volume; v += c[i].volume;
    out[i] = v ? pv / v : null;
  }
  return out;
}

// Volume profile: each bar's USD (quote) volume spread uniformly across its high-low range.
// Quote volume keeps eras with very different prices comparable (BTC volume over-weights cheap periods).
// Bin size: `binSize` in price units (e.g. a fraction of ATR) clamped to 24–150 bins, or a fixed `bins` count.
export function volumeProfile(c, { bins, binSize } = {}) {
  const lo = Math.min(...c.map(b => b.low)), hi = Math.max(...c.map(b => b.high));
  bins ??= binSize ? Math.min(150, Math.max(24, Math.round((hi - lo) / binSize))) : 48;
  const step = (hi - lo) / bins;
  const vol = new Array(bins).fill(0);
  for (const b of c) {
    const a = Math.max(0, Math.floor((b.low - lo) / step)), z = Math.min(bins - 1, Math.floor((b.high - lo) / step));
    const usd = b.quoteVolume ?? b.volume * (b.high + b.low + b.close) / 3;
    const share = usd / (z - a + 1);
    for (let k = a; k <= z; k++) vol[k] += share;
  }
  const rows = vol.map((v, k) => ({ low: lo + k * step, high: lo + (k + 1) * step, volume: v }));
  const pocIdx = vol.indexOf(Math.max(...vol));
  // Value area: expand from POC until 70% of total volume is covered.
  const total = vol.reduce((a, b) => a + b, 0);
  let lowI = pocIdx, highI = pocIdx, acc = vol[pocIdx];
  while (acc < total * 0.7 && (lowI > 0 || highI < bins - 1)) {
    const below = lowI > 0 ? vol[lowI - 1] : -1, above = highI < bins - 1 ? vol[highI + 1] : -1;
    if (above >= below) acc += vol[++highI]; else acc += vol[--lowI];
  }
  const mid = r => (r.low + r.high) / 2;
  return { rows, bins, step, bars: c.length, fromTime: c[0].time, poc: mid(rows[pocIdx]), vah: rows[highI].high, val: rows[lowI].low };
}

export function crossovers(a, b) {
  const out = [];
  for (let i = 1; i < a.length; i++) {
    if ([a[i], b[i], a[i - 1], b[i - 1]].some(v => v == null)) continue;
    if (a[i - 1] <= b[i - 1] && a[i] > b[i]) out.push({ i, dir: 'up' });
    if (a[i - 1] >= b[i - 1] && a[i] < b[i]) out.push({ i, dir: 'down' });
  }
  return out;
}

export function computeAll(c) {
  const closes = c.map(b => b.close);
  const ema20 = ema(closes, 20), ema50 = ema(closes, 50), ema200 = ema(closes, 200);
  const sma200 = sma(closes, 200);
  const obvLine = obv(c);
  return {
    ema20, ema50, ema200, sma200,
    rsi: rsi(closes),
    stoch: stochRsi(closes),
    macd: macd(closes),
    atr: atr(c),
    adx: adx(c),
    bb: bollinger(closes),
    obv: obvLine,
    obvEma: ema(obvLine, 20),
    volSma: sma(c.map(b => b.volume), 20),
    crosses: {
      golden: crossovers(ema50, ema200).map(x => ({ ...x, kind: x.dir === 'up' ? 'golden' : 'death' })),
      fast: crossovers(ema20, ema50),
    },
  };
}
