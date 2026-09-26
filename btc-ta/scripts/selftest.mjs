// Sanity checks against textbook values (StockCharts RSI example) and brute-force references.
import assert from 'node:assert/strict';
import { sma, ema, rsi, macd, bollinger, volumeProfile } from './lib/indicators.mjs';
import { barEndMs } from './lib/data.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// Wilder RSI(14), StockCharts ChartSchool example (their sheet rounds intermediate averages, hence tol 0.1).
const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
  46.00, 46.03, 46.41, 46.22, 45.64];
const r = rsi(closes, 14);
assert.equal(r[13], null);
[70.53, 66.32, 66.55, 69.41, 66.36, 57.97].forEach((v, k) => near(r[14 + k], v, 0.1, `RSI[${14 + k}]`));

// EMA seeded by SMA, then recursive.
const xs = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10 + i * 0.5);
const e = ema(xs, 10);
let ref = xs.slice(0, 10).reduce((a, b) => a + b) / 10;
for (let i = 10; i < xs.length; i++) ref = (2 / 11) * xs[i] + (9 / 11) * ref;
near(e.at(-1), ref, 1e-9, 'EMA10');

// SMA vs brute force.
near(sma(xs, 20).at(-1), xs.slice(-20).reduce((a, b) => a + b) / 20, 1e-9, 'SMA20');

// MACD = EMA12 − EMA26; hist = line − signal.
const m = macd(xs);
near(m.line.at(-1), ema(xs, 12).at(-1) - ema(xs, 26).at(-1), 1e-9, 'MACD line');
near(m.hist.at(-1), m.line.at(-1) - m.signal.at(-1), 1e-9, 'MACD hist');

// Bollinger: population stdev.
const bb = bollinger(xs);
const w = xs.slice(-20), mu = w.reduce((a, b) => a + b) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mu) ** 2, 0) / 20);
near(bb.upper.at(-1), mu + 2 * sd, 1e-9, 'BB upper');

// Volume profile conserves total volume.
const bars = xs.map((x, i) => ({ high: x + 1, low: x - 1, close: x, open: x, volume: 10 + (i % 5) }));
const vp = volumeProfile(bars, { bins: 24 });
near(vp.rows.reduce((a, b) => a + b.volume, 0), bars.reduce((a, b) => a + b.volume * (b.high + b.low + b.close) / 3, 0), 1e-6, 'VP total (USD)');
const withQuote = volumeProfile(bars.map(b => ({ ...b, quoteVolume: 1 })), { binSize: 0.5 });
near(withQuote.rows.reduce((a, b) => a + b.volume, 0), bars.length, 1e-9, 'VP uses quoteVolume');
assert.ok(withQuote.bins >= 24 && withQuote.bins <= 150, 'VP bins clamped');
assert.ok(vp.val <= vp.poc && vp.poc <= vp.vah, 'POC inside value area');

assert.equal(barEndMs(Date.UTC(2024, 0, 1) / 1000, '1mo'), Date.UTC(2024, 1, 1), 'January monthly close');
assert.equal(barEndMs(Date.UTC(2024, 1, 1) / 1000, '1mo'), Date.UTC(2024, 2, 1), 'February leap-year monthly close');
assert.equal(barEndMs(Date.UTC(2026, 11, 1) / 1000, '1mo'), Date.UTC(2027, 0, 1), 'December monthly close');
console.log('selftest OK');
