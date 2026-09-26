// Price structure: swing pivots, support/resistance clusters, Fibonacci, trendlines, RSI divergences, candle patterns.

// A pivot high at i is the strict max of highs in [i-k, i+k]; only confirmed pivots (k bars to the right) are returned.
export function pivots(c, k = 5) {
  const highs = [], lows = [];
  for (let i = k; i < c.length - k; i++) {
    let isH = true, isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (c[j].high >= c[i].high) isH = false;
      if (c[j].low <= c[i].low) isL = false;
    }
    if (isH) highs.push({ i, price: c[i].high });
    if (isL) lows.push({ i, price: c[i].low });
  }
  return { highs, lows };
}

// Cluster pivot prices within `tol`; strength = touches weighted by recency.
export function supportResistance(c, piv, tol, max = 4) {
  const pts = [...piv.highs.map(p => ({ ...p, kind: 'H' })), ...piv.lows.map(p => ({ ...p, kind: 'L' }))]
    .sort((a, b) => a.price - b.price);
  const clusters = [];
  for (const p of pts) {
    const last = clusters.at(-1);
    if (last && p.price - last.prices.at(-1) <= tol) last.prices.push(p.price), last.members.push(p);
    else clusters.push({ prices: [p.price], members: [p] });
  }
  const n = c.length, price = c.at(-1).close;
  const levels = clusters.map(cl => {
    const recency = cl.members.reduce((a, m) => a + 0.5 + (m.i / n), 0);
    const lastTouch = Math.max(...cl.members.map(m => m.i));
    return {
      price: cl.prices.reduce((a, b) => a + b, 0) / cl.prices.length,
      touches: cl.members.length,
      strength: +recency.toFixed(2),
      lastTouchTime: c[lastTouch].time,
      barsSinceTouch: n - 1 - lastTouch,
    };
  }).filter(l => l.touches >= 2 || l.barsSinceTouch < n * 0.25);
  const pick = arr => arr.sort((a, b) => b.strength - a.strength).slice(0, max).sort((a, b) => a.price - b.price);
  return {
    supports: pick(levels.filter(l => l.price < price)).reverse(), // nearest first
    resistances: pick(levels.filter(l => l.price >= price)),
  };
}

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_EXT = [1.272, 1.618];

// Fibonacci on the dominant swing of the last `lookback` bars. Direction = which extreme came last.
export function fibonacci(c, lookback = 150) {
  const s = Math.max(0, c.length - lookback);
  let hi = s, lo = s;
  for (let i = s; i < c.length; i++) {
    if (c[i].high > c[hi].high) hi = i;
    if (c[i].low < c[lo].low) lo = i;
  }
  const up = lo < hi; // swing up: retracements measured down from the high
  const H = c[hi].high, L = c[lo].low, R = H - L;
  const lvl = r => up ? H - R * r : L + R * r;
  return {
    direction: up ? 'up' : 'down',
    from: { time: c[up ? lo : hi].time, price: up ? L : H },
    to: { time: c[up ? hi : lo].time, price: up ? H : L },
    levels: FIB.map(r => ({ ratio: r, price: lvl(r) })),
    extensions: FIB_EXT.map(r => ({ ratio: r, price: up ? L + R * r : H - R * r })),
  };
}

// Most recent valid trendline through two pivots: rising lows (support) / falling highs (resistance).
// Valid if no close crosses the line between the two anchors (tolerance `tol`).
function fitTrendline(c, pts, kind, tol) {
  const recent = pts.slice(-8);
  for (let b = recent.length - 1; b >= 1; b--) {
    for (let a = b - 1; a >= 0; a--) {
      const p1 = recent[a], p2 = recent[b];
      if (p2.i - p1.i < 8) continue;
      if (kind === 'support' ? p2.price <= p1.price : p2.price >= p1.price) continue;
      const slope = (p2.price - p1.price) / (p2.i - p1.i);
      const at = i => p1.price + slope * (i - p1.i);
      let ok = true;
      for (let i = p1.i + 1; i < p2.i && ok; i++) {
        if (kind === 'support' ? c[i].close < at(i) - tol : c[i].close > at(i) + tol) ok = false;
      }
      if (!ok) continue;
      const last = c.length - 1, now = at(last);
      const broken = kind === 'support' ? c[last].close < now - tol : c[last].close > now + tol;
      return {
        kind, broken,
        p1: { time: c[p1.i].time, price: p1.price },
        p2: { time: c[p2.i].time, price: p2.price },
        end: { time: c[last].time, price: now },
        slopePerBar: slope,
      };
    }
  }
  return null;
}

export function trendlines(c, piv, tol) {
  return [fitTrendline(c, piv.lows, 'support', tol), fitTrendline(c, piv.highs, 'resistance', tol)].filter(Boolean);
}

// Regular divergences between consecutive confirmed pivots within the last `window` bars.
export function rsiDivergences(c, rsi, piv, window = 150) {
  const out = [], start = c.length - window;
  const scan = (pts, type) => {
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1], b = pts[j];
      if (b.i < start || b.i - a.i < 5 || b.i - a.i > 60 || rsi[a.i] == null) continue;
      const bull = type === 'bullish' && b.price < a.price && rsi[b.i] > rsi[a.i];
      const bear = type === 'bearish' && b.price > a.price && rsi[b.i] < rsi[a.i];
      if (bull || bear) out.push({
        type,
        from: { time: c[a.i].time, price: a.price, rsi: +rsi[a.i].toFixed(1) },
        to: { time: c[b.i].time, price: b.price, rsi: +rsi[b.i].toFixed(1) },
        barsAgo: c.length - 1 - b.i,
      });
    }
  };
  scan(piv.lows, 'bullish');
  scan(piv.highs, 'bearish');
  return out.sort((x, y) => x.to.time - y.to.time);
}

// Single/double candle patterns on the last `n` bars. Context (prior 5-bar trend) filters hammer vs hanging man etc.
export function candlePatterns(c, atrArr, n = 20) {
  const out = [];
  for (let i = Math.max(6, c.length - n); i < c.length; i++) {
    const b = c[i], p = c[i - 1], a = atrArr[i] ?? (b.high - b.low);
    const body = Math.abs(b.close - b.open), range = b.high - b.low || 1e-9;
    const upper = b.high - Math.max(b.open, b.close), lower = Math.min(b.open, b.close) - b.low;
    const priorDown = c[i - 5].close > p.close, priorUp = c[i - 5].close < p.close;
    const push = (name, bias) => out.push({ time: b.time, name, bias, barsAgo: c.length - 1 - i });
    if (range < a * 0.5) continue; // ignore tiny bars
    if (b.close > b.open && p.close < p.open && b.close >= p.open && b.open <= p.close && body > Math.abs(p.close - p.open))
      push('Bullish engulfing', 'bullish');
    else if (b.close < b.open && p.close > p.open && b.open >= p.close && b.close <= p.open && body > Math.abs(p.close - p.open))
      push('Bearish engulfing', 'bearish');
    else if (lower >= 2 * body && upper <= body * 0.6 && priorDown) push('Hammer', 'bullish');
    else if (upper >= 2 * body && lower <= body * 0.6 && priorUp) push('Shooting star', 'bearish');
    else if (body <= range * 0.1) push('Doji', 'neutral');
  }
  return out;
}
