#!/usr/bin/env node
// Build the composite BTC/USD series from per-pool minute bars.
//   node src/build.mjs
// Output (CC BY 4.0): data/ohlcv/btc-usd-1h.csv, btc-usd-1d.csv, peg-1h.csv, meta.json
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USDT_BASIS_PAIR } from './config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw'), OUT = join(ROOT, 'data', 'ohlcv');
const VERSION = '0.1.0';

// Thresholds (documented in METHODOLOGY.md).
const HAMPEL_WINDOW = 15;      // minutes on each side
const HAMPEL_MIN_DEV = 0.015;  // never flag moves smaller than 1.5% from the local median
const HAMPEL_K = 6;            // …or smaller than 6 × local MAD
const BASIS_WINDOW_H = 24;     // rolling window (hours) for the USDT/USD estimate

const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function weightedMedian(pairs) { // [[value, weight]]
  const s = pairs.filter(([, w]) => w > 0).sort((a, b) => a[0] - b[0]);
  if (!s.length) return median(pairs.map(p => p[0]));
  const half = s.reduce((a, [, w]) => a + w, 0) / 2;
  let acc = 0;
  for (const [v, w] of s) { acc += w; if (acc >= half) return v; }
  return s.at(-1)[0];
}

// ---- load ----
const pools = {}, bars = {};
for (const f of (await readdir(RAW)).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(await readFile(join(RAW, f), 'utf8'));
  for (const p of s.pools) { pools[p.id] = { ...p, chain: s.chain }; bars[p.id] = s.bars[p.id]; }
}
const poolIds = Object.keys(pools);
console.log(`pool caricate: ${poolIds.map(id => `${id} (${Object.keys(bars[id]).length} min)`).join(', ')}`);

// ---- USDT/USD estimate: USDC-pool close / USDT-pool close on matching minutes, hourly median, rolling 24h median ----
const hourOf = t => Math.floor(t / 3600) * 3600;
const basisHourly = new Map();
{
  const a = bars[USDT_BASIS_PAIR.usdc] ?? {}, b = bars[USDT_BASIS_PAIR.usdt] ?? {};
  const perHour = new Map();
  for (const m of Object.keys(b)) if (a[m]) {
    const h = hourOf(+m);
    (perHour.get(h) ?? perHour.set(h, []).get(h)).push(a[m].c / b[m].c);
  }
  const hours = [...perHour.keys()].sort((x, y) => x - y);
  for (const h of hours) {
    const win = hours.filter(x => x > h - BASIS_WINDOW_H * 3600 && x <= h).flatMap(x => perHour.get(x));
    basisHourly.set(h, median(win));
  }
}
const basisHours = [...basisHourly.keys()].sort((x, y) => x - y);
function usdtUsd(t) { // last known estimate at or before t, else 1
  const h = hourOf(t);
  let lo = 0, hi = basisHours.length - 1, best = null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (basisHours[mid] <= h) { best = basisHours[mid]; lo = mid + 1; } else hi = mid - 1; }
  return best == null ? 1 : basisHourly.get(best);
}

// ---- composite minute bars ----
const minutes = [...new Set(poolIds.flatMap(id => Object.keys(bars[id]).map(Number)))].sort((a, b) => a - b);
const comp = [];
for (const m of minutes) {
  const pts = [];
  for (const id of poolIds) {
    const b = bars[id][m];
    if (!b) continue;
    const k = pools[id].quote === 'USDT' ? usdtUsd(m) : 1;
    pts.push({ id, o: b.o * k, h: b.h * k, l: b.l * k, c: b.c * k, v: b.v, n: b.n, wrapped: pools[id].wrapped });
  }
  const w = p => Math.max(p.v, 1); // volume weight; tiny swaps still count a little
  comp.push({
    t: m,
    o: weightedMedian(pts.map(p => [p.o, w(p)])),
    h: weightedMedian(pts.map(p => [p.h, w(p)])),
    l: weightedMedian(pts.map(p => [p.l, w(p)])),
    c: weightedMedian(pts.map(p => [p.c, w(p)])),
    v: pts.reduce((a, p) => a + p.v, 0),
    n: pts.reduce((a, p) => a + p.n, 0),
    pools: pts.length,
    wbtc: pts.filter(p => p.wrapped === 'WBTC'),
    cbbtc: pts.filter(p => p.wrapped === 'cbBTC'),
  });
}

// ---- Hampel filter on composite closes; clamp outlier highs/lows ----
let dropped = 0, clamped = 0;
const closes = comp.map(x => x.c);
for (let i = 0; i < comp.length; i++) {
  const win = closes.slice(Math.max(0, i - HAMPEL_WINDOW), i + HAMPEL_WINDOW + 1);
  const med = median(win), mad = median(win.map(x => Math.abs(x - med)));
  const lim = Math.max(med * HAMPEL_MIN_DEV, HAMPEL_K * 1.4826 * mad);
  const x = comp[i];
  if (Math.abs(x.c - med) > lim) { x.drop = true; dropped++; continue; }
  if (x.h - med > lim) { x.h = Math.max(x.o, x.c); clamped++; }
  if (med - x.l > lim) { x.l = Math.min(x.o, x.c); clamped++; }
  x.h = Math.max(x.h, x.o, x.c); x.l = Math.min(x.l, x.o, x.c);
}
const clean = comp.filter(x => !x.drop);

// ---- resample ----
function resample(src, sec) {
  const out = [];
  for (const x of src) {
    const t = Math.floor(x.t / sec) * sec, b = out.at(-1);
    if (!b || b.t !== t) out.push({ t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v, n: x.n, minutes: 1, poolsMax: x.pools, basis: usdtUsd(t) });
    else { b.h = Math.max(b.h, x.h); b.l = Math.min(b.l, x.l); b.c = x.c; b.v += x.v; b.n += x.n; b.minutes++; b.poolsMax = Math.max(b.poolsMax, x.pools); }
  }
  // Open = previous bar close when available (continuous series, like exchange candles).
  for (let i = 1; i < out.length; i++) { out[i].o = out[i - 1].c; out[i].h = Math.max(out[i].h, out[i].o); out[i].l = Math.min(out[i].l, out[i].o); }
  return out;
}
const h1 = resample(clean, 3600), d1 = resample(clean, 86400);

// ---- peg monitor: WBTC-pool vs cbBTC-pool hourly median close ----
const peg = [];
{
  const acc = new Map();
  for (const x of clean) {
    const h = hourOf(x.t), e = acc.get(h) ?? acc.set(h, { w: [], c: [] }).get(h);
    for (const p of x.wbtc) e.w.push(p.c);
    for (const p of x.cbbtc) e.c.push(p.c);
  }
  for (const [h, e] of [...acc].sort((a, b) => a[0] - b[0])) if (e.w.length && e.c.length) peg.push({ t: h, wbtc: median(e.w), cbbtc: median(e.c), spreadBps: (median(e.w) / median(e.c) - 1) * 1e4 });
}

// ---- write ----
await mkdir(OUT, { recursive: true });
const iso = t => new Date(t * 1000).toISOString().replace('.000Z', 'Z');
const csv = rows => ['time,open,high,low,close,volume_usd,swaps,minutes_with_trades,max_pools,usdt_usd',
  ...rows.map(b => [iso(b.t), b.o.toFixed(2), b.h.toFixed(2), b.l.toFixed(2), b.c.toFixed(2), b.v.toFixed(0), b.n, b.minutes, b.poolsMax, b.basis.toFixed(5)].join(','))].join('\n') + '\n';
await writeFile(join(OUT, 'btc-usd-1h.csv'), csv(h1));
await writeFile(join(OUT, 'btc-usd-1d.csv'), csv(d1));
await writeFile(join(OUT, 'peg-1h.csv'), ['time,wbtc_usd,cbbtc_usd,spread_bps', ...peg.map(p => [iso(p.t), p.wbtc.toFixed(2), p.cbbtc.toFixed(2), p.spreadBps.toFixed(1)].join(','))].join('\n') + '\n');
const meta = {
  name: 'Open on-chain BTC/USD OHLCV', version: VERSION, license: 'CC-BY-4.0',
  attribution: 'Open on-chain BTC/USD OHLCV (onchain-ohlcv), CC BY 4.0',
  generatedAt: new Date().toISOString(),
  from: iso(clean[0].t), to: iso(clean.at(-1).t),
  pools: poolIds.map(id => ({ id, chain: pools[id].chain, address: pools[id].address, wrapped: pools[id].wrapped, quote: pools[id].quote, feeTier: pools[id].fee })),
  stats: { compositeMinutes: comp.length, droppedMinutes: dropped, clampedExtremes: clamped, hours: h1.length, days: d1.length },
  method: { priceSource: 'end-of-block pool price (Uniswap v3 sqrtPriceX96)', composite: 'volume-weighted median across pools per minute', filter: { hampelWindowMin: HAMPEL_WINDOW, minDeviation: HAMPEL_MIN_DEV, k: HAMPEL_K }, usdtUsd: `rolling ${BASIS_WINDOW_H}h median of ${USDT_BASIS_PAIR.usdc} / ${USDT_BASIS_PAIR.usdt}`, usdc: 'treated as 1 USD' },
};
await writeFile(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`composito: ${comp.length} minuti (${dropped} scartati, ${clamped} estremi corretti) → ${h1.length} ore, ${d1.length} giorni`);
console.log(`USDT/USD stimato: ultimo ${usdtUsd(minutes.at(-1)).toFixed(5)} · spread WBTC/cbBTC mediano ${median(peg.map(p => p.spreadBps)).toFixed(1)} bps`);
