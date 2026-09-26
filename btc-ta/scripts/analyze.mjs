#!/usr/bin/env node
// BTC technical analysis: fetch → indicators → structure → scores → summary.json + chart.html/cycle.html (+ PNG).
// Usage: node analyze.mjs [--tf 1d] [--bars 500] [--out ./btc-ta-output] [--no-png] [--no-cycle]
//        [--candles id] [--history id|candles] [--derivatives id|none] [--sentiment id|none] [--list-sources]
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fetchAll, TIMEFRAMES, barEndMs } from './lib/data.mjs';
import { listSources } from './lib/providers/index.mjs';
import { computeAll, anchoredVwap, volumeProfile } from './lib/indicators.mjs';
import { pivots, supportResistance, fibonacci, trendlines, rsiDivergences, candlePatterns } from './lib/structure.mjs';
import { computeCycle } from './lib/cycle.mjs';
import { renderChart, renderCycle } from './lib/render.mjs';
import { screenshot } from './screenshot.mjs';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tf: { type: 'string' }, bars: { type: 'string' }, out: { type: 'string', default: './btc-ta-output' },
    'no-png': { type: 'boolean', default: false }, 'no-cycle': { type: 'boolean', default: false },
    'closed-only': { type: 'boolean', default: false },
    candles: { type: 'string' }, history: { type: 'string' }, derivatives: { type: 'string' }, sentiment: { type: 'string' },
    'list-sources': { type: 'boolean', default: false },
  },
});
if (args['list-sources']) { console.log(JSON.stringify(listSources(), null, 2)); process.exit(0); }
// Also accept positional form: analyze.mjs 4h 800
const rawTf = args.tf ?? positionals[0] ?? '1d';
const tf = rawTf === '1M' ? '1mo' : rawTf.toLowerCase();
const bars = Math.max(250, Math.min(3000, parseInt(args.bars ?? positionals[1] ?? '500', 10)));
if (!TIMEFRAMES.includes(tf)) { console.error(`Timeframe non valido "${tf}". Validi: ${TIMEFRAMES.join(', ')}`); process.exit(2); }

const PIVOT_K = { '15m': 4, '1h': 4, '4h': 5, '1d': 5, '1w': 3, '1mo': 2 }[tf];
const r = (v, d = 2) => v == null || !Number.isFinite(v) ? null : +v.toFixed(d);
const iso = t => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const outRoot = resolve(args.out);
const cacheDir = join(outRoot, 'cache');
const sourceChoice = { candles: args.candles, history: args.history, derivatives: args.derivatives, sentiment: args.sentiment };
let data;
try {
  data = await fetchAll({ tf, bars, cacheDir, sources: sourceChoice, needHistory: !args['no-cycle'] });
} catch (err) { console.error(`Errore nel caricamento dei dati: ${err.message}`); process.exit(1); }
const { candles: fetchedCandles, longDaily, derivatives, fearGreed, warnings, sources } = data;
const c = args['closed-only'] ? fetchedCandles.filter(bar => barEndMs(bar.time, tf) <= Date.now()) : fetchedCandles;
if (c.length < 60) { console.error(`Troppe poche barre chiuse (${c.length})`); process.exit(1); }

// ---- compute ----
const ind = computeAll(c);
const n = c.length, i = n - 1, last = c[i], price = last.close;
const atrNow = ind.atr[i];
const piv = pivots(c, PIVOT_K);
const sr = supportResistance(c, piv, atrNow * 0.6);
const fibLookback = Math.min(150, n);
const fib = { ...fibonacci(c, fibLookback), lookback: fibLookback };
const anchorIdx = c.findIndex(b => b.time === fib.from.time);
ind.vwap = anchoredVwap(c, anchorIdx);
const tls = trendlines(c, piv, atrNow * 0.3);
const divs = rsiDivergences(c, ind.rsi, piv);
const patterns = candlePatterns(c, ind.atr);
// Two volume profiles (USD volume, bins ≈ ¼ ATR): anchored to the dominant swing (same anchor as Fib/VWAP)
// and a fixed "recent" window per timeframe.
const VP_RECENT = { '15m': [192, '2 giorni'], '1h': [168, '7 giorni'], '4h': [180, '30 giorni'], '1d': [180, '180 giorni'], '1w': [52, '52 settimane'], '1mo': [24, '24 mesi'] }[tf];
const vpOpts = { binSize: atrNow * 0.25 };
const vp = {
  anchored: { ...volumeProfile(c.slice(anchorIdx), vpOpts), label: 'swing' },
  recent: { ...volumeProfile(c.slice(-Math.min(n, VP_RECENT[0])), vpOpts), label: VP_RECENT[1] },
};
const cycle = args['no-cycle'] ? null : computeCycle(longDaily, sources.history);
if (!cycle) sources.history = null;

// BB width percentile over the loaded history → squeeze detection.
const widths = ind.bb.width.filter(v => v != null);
const bbWidthPct = widths.filter(v => v <= ind.bb.width[i]).length / widths.length * 100;

// ---- markers on the price chart ----
const markers = [];
const recent = t => t >= c[Math.max(0, n - 260)].time;
for (const x of ind.crosses.golden) if (recent(c[x.i].time)) markers.push({ time: c[x.i].time, position: x.kind === 'golden' ? 'belowBar' : 'aboveBar', shape: x.kind === 'golden' ? 'arrowUp' : 'arrowDown', color: x.kind === 'golden' ? 'gold' : 'down', text: x.kind === 'golden' ? 'Golden cross' : 'Death cross' });
for (const x of ind.crosses.fast.slice(-4)) markers.push({ time: c[x.i].time, position: x.dir === 'up' ? 'belowBar' : 'aboveBar', shape: 'circle', color: x.dir === 'up' ? 'up' : 'down', text: `EMA20${x.dir === 'up' ? '↑' : '↓'}50` });
for (const d of divs) markers.push({ time: d.to.time, position: d.type === 'bullish' ? 'belowBar' : 'aboveBar', shape: d.type === 'bullish' ? 'arrowUp' : 'arrowDown', color: 'violet', text: `Div ${d.type === 'bullish' ? 'bull' : 'bear'}` });
for (const p of patterns.filter(p => p.bias !== 'neutral')) markers.push({ time: p.time, position: p.bias === 'bullish' ? 'belowBar' : 'aboveBar', shape: 'square', color: p.bias === 'bullish' ? 'up' : 'down', text: p.name });
markers.sort((a, b) => a.time - b.time);

// ---- scoring: each block is a sum of ±1 votes with reasons ----
function block(votes) {
  const v = votes.filter(Boolean);
  const score = v.reduce((a, x) => a + x[0], 0), max = v.length || 1;
  const ratio = score / max;
  return { score, max, bias: ratio > 0.33 ? 'bullish' : ratio < -0.33 ? 'bearish' : 'neutral', reasons: v.map(x => x[1]) };
}
const vote = (cond, yes, no, txtYes, txtNo) => cond == null ? null : cond ? [yes, txtYes] : [no, txtNo];
const e20 = ind.ema20[i], e50 = ind.ema50[i], e200 = ind.ema200[i];
const h = ind.macd.hist[i], hPrev = ind.macd.hist[i - 1];

const scores = {
  trend: block([
    e200 != null && vote(price > e200, 1, -1, 'prezzo sopra EMA200', 'prezzo sotto EMA200'),
    e200 != null && vote(e50 > e200, 1, -1, 'EMA50 > EMA200', 'EMA50 < EMA200'),
    vote(e20 > e50, 1, -1, 'EMA20 > EMA50', 'EMA20 < EMA50'),
    vote(ind.adx.plusDI[i] > ind.adx.minusDI[i], 1, -1, '+DI > −DI', '−DI > +DI'),
  ]),
  momentum: block([
    ind.rsi[i] > 55 ? [1, `RSI ${r(ind.rsi[i], 1)} > 55`] : ind.rsi[i] < 45 ? [-1, `RSI ${r(ind.rsi[i], 1)} < 45`] : [0, `RSI ${r(ind.rsi[i], 1)} neutro`],
    vote(h > 0, 1, -1, 'istogramma MACD positivo', 'istogramma MACD negativo'),
    vote(ind.macd.line[i] > 0, 1, -1, 'MACD sopra zero', 'MACD sotto zero'),
    vote(ind.stoch.k[i] > ind.stoch.d[i], 1, -1, 'StochRSI K > D', 'StochRSI K < D'),
  ]),
  volume: block([
    vote(ind.obv[i] > ind.obvEma[i], 1, -1, 'OBV sopra la sua EMA20', 'OBV sotto la sua EMA20'),
    vote(price > ind.vwap[i], 1, -1, 'prezzo sopra VWAP ancorato', 'prezzo sotto VWAP ancorato'),
    vote(price > vp.anchored.poc, 1, -1, 'prezzo sopra POC dello swing', 'prezzo sotto POC dello swing'),
  ]),
};
if (derivatives) {
  const f = derivatives.funding7dAvg;
  scores.derivatives = block([
    f > 0.0003 ? [-1, 'funding medio 7g elevato: long affollati (contrarian)'] : f < 0 ? [1, 'funding medio 7g negativo: short affollati (contrarian)'] : [0, 'funding neutro'],
    derivatives.oiChange7dPct != null && (derivatives.oiChange7dPct > 10 && price < c[Math.max(0, n - 8)].close ? [-1, 'OI in forte aumento con prezzo in calo'] : [0, `OI 7g ${r(derivatives.oiChange7dPct, 1)}%`]),
  ]);
}
if (fearGreed) {
  const v = fearGreed.now.value;
  scores.sentiment = block([v >= 75 ? [-1, `Extreme greed ${v} (contrarian)`] : v <= 25 ? [1, `Extreme fear ${v} (contrarian)`] : [0, `Fear & Greed ${v}`]]);
}
if (cycle) {
  const cs = cycle.summary;
  scores.cycle = block([
    cs.mayerMultiple < 0.8 ? [1, `Mayer ${cs.mayerMultiple} < 0.8`] : cs.mayerMultiple > 2.4 ? [-1, `Mayer ${cs.mayerMultiple} > 2.4`] : [0, `Mayer ${cs.mayerMultiple}`],
    cs.powerLaw.residualPercentile < 20 ? [1, `power law percentile ${cs.powerLaw.residualPercentile}`] : cs.powerLaw.residualPercentile > 80 ? [-1, `power law percentile ${cs.powerLaw.residualPercentile}`] : [0, `power law percentile ${cs.powerLaw.residualPercentile}`],
    cs.piCycle.ratio >= 0.95 ? [-1, `Pi Cycle ratio ${cs.piCycle.ratio} vicino al cross`] : [0, `Pi Cycle ratio ${cs.piCycle.ratio}`],
    vote(cs.priceTo200wMA > 1, 0, 1, 'sopra la 200W MA', 'sotto la 200W MA (storicamente zona di accumulo)'),
  ]);
}
// Directional blocks weigh more than contrarian/context ones.
const W = { trend: 2, momentum: 1.5, volume: 1, derivatives: 0.5, sentiment: 0.5, cycle: 1 };
const overallRaw = Object.entries(scores).reduce((a, [k, b]) => a + W[k] * (b.score / b.max), 0) / Object.keys(scores).reduce((a, k) => a + W[k], 0);
const overall = { score: r(overallRaw * 100, 0), bias: overallRaw > 0.2 ? 'bullish' : overallRaw < -0.2 ? 'bearish' : 'neutral', note: 'score −100…+100, media pesata dei blocchi' };

// ---- summary ----
const pctFrom = p => r((p / price - 1) * 100, 2);
const lvl = l => ({ price: r(l.price, 0), distancePct: pctFrom(l.price), touches: l.touches, strength: l.strength, lastTouch: iso(l.lastTouchTime) });
const summary = {
  meta: {
    pair: sources.candles.pair, timeframe: tf, bars: n,
    sources,
    asOf: last.time, asOfIso: iso(last.time),
    lastBarClosed: barEndMs(last.time, tf) <= Date.now(),
    generatedAt: new Date().toISOString(),
    warnings,
  },
  price: {
    last: price, open: last.open, high: last.high, low: last.low,
    changePct: r((price / c[i - 1].close - 1) * 100, 2),
    change20BarsPct: r((price / c[Math.max(0, i - 20)].close - 1) * 100, 2),
    rangeHigh: Math.max(...c.map(b => b.high)), rangeLow: Math.min(...c.map(b => b.low)),
  },
  trend: {
    ema20: r(e20, 0), ema50: r(e50, 0), ema200: r(e200, 0), sma200: r(ind.sma200[i], 0),
    priceVsEma200Pct: e200 ? r((price / e200 - 1) * 100, 2) : null,
    adx: r(ind.adx.adx[i], 1), plusDI: r(ind.adx.plusDI[i], 1), minusDI: r(ind.adx.minusDI[i], 1),
    adxRegime: ind.adx.adx[i] > 25 ? 'trend forte' : ind.adx.adx[i] < 20 ? 'range / trend debole' : 'trend in formazione',
    lastGoldenDeath: ind.crosses.golden.length ? { kind: ind.crosses.golden.at(-1).kind, time: iso(c[ind.crosses.golden.at(-1).i].time), barsAgo: i - ind.crosses.golden.at(-1).i } : null,
    lastEma20_50Cross: ind.crosses.fast.length ? { dir: ind.crosses.fast.at(-1).dir, barsAgo: i - ind.crosses.fast.at(-1).i } : null,
  },
  momentum: {
    rsi: r(ind.rsi[i], 1), rsiPrev: r(ind.rsi[i - 1], 1),
    rsiZone: ind.rsi[i] >= 70 ? 'ipercomprato' : ind.rsi[i] <= 30 ? 'ipervenduto' : 'neutro',
    macd: r(ind.macd.line[i], 0), macdSignal: r(ind.macd.signal[i], 0), macdHist: r(h, 0),
    macdHistSlope: h > hPrev ? 'in aumento' : 'in calo',
    stochK: r(ind.stoch.k[i], 1), stochD: r(ind.stoch.d[i], 1),
    divergences: divs.slice(-4).map(d => ({ type: d.type, from: { ...d.from, time: iso(d.from.time) }, to: { ...d.to, time: iso(d.to.time) }, barsAgo: d.barsAgo })),
  },
  volatility: {
    atr: r(atrNow, 0), atrPct: r(atrNow / price * 100, 2),
    bbUpper: r(ind.bb.upper[i], 0), bbMid: r(ind.bb.mid[i], 0), bbLower: r(ind.bb.lower[i], 0),
    bbPctB: r(ind.bb.pctB[i], 2), bbWidth: r(ind.bb.width[i], 4), bbWidthPercentile: r(bbWidthPct, 0),
    squeeze: bbWidthPct < 15,
  },
  volume: {
    last: r(last.volume, 1), vsSma20: r(last.volume / ind.volSma[i], 2),
    obvAboveEma: ind.obv[i] > ind.obvEma[i],
    anchoredVwap: r(ind.vwap[i], 0), vwapAnchor: iso(fib.from.time),
  },
  volumeProfile: Object.fromEntries(Object.entries(vp).map(([k, p]) => [k, {
    window: k === 'anchored' ? `dallo swing ${iso(p.fromTime)}` : VP_RECENT[1], bars: p.bars, volumeUnit: 'USDT', binSizeUsd: r(p.step, 0),
    poc: r(p.poc, 0), vah: r(p.vah, 0), val: r(p.val, 0), pocDistancePct: pctFrom(p.poc),
    position: price > p.vah ? 'sopra la value area' : price < p.val ? 'sotto la value area' : price > p.poc ? 'nella value area, sopra il POC' : 'nella value area, sotto il POC',
  }])),
  structure: {
    supports: sr.supports.map(lvl),
    resistances: sr.resistances.map(lvl),
    fibonacci: {
      direction: fib.direction, lookbackBars: fibLookback,
      swingFrom: { price: r(fib.from.price, 0), time: iso(fib.from.time) },
      swingTo: { price: r(fib.to.price, 0), time: iso(fib.to.time) },
      levels: fib.levels.map(l => ({ ratio: l.ratio, price: r(l.price, 0), distancePct: pctFrom(l.price) })),
      extensions: fib.extensions.map(l => ({ ratio: l.ratio, price: r(l.price, 0) })),
    },
    trendlines: tls.map(t => ({ kind: t.kind, broken: t.broken, from: { price: r(t.p1.price, 0), time: iso(t.p1.time) }, to: { price: r(t.p2.price, 0), time: iso(t.p2.time) }, valueNow: r(t.end.price, 0), distancePct: pctFrom(t.end.price) })),
    candlePatterns: patterns.map(p => ({ ...p, time: iso(p.time) })),
    lastSwingHigh: piv.highs.length ? { price: piv.highs.at(-1).price, time: iso(c[piv.highs.at(-1).i].time) } : null,
    lastSwingLow: piv.lows.length ? { price: piv.lows.at(-1).price, time: iso(c[piv.lows.at(-1).i].time) } : null,
  },
  derivatives: derivatives && {
    fundingRate: derivatives.fundingRate, fundingAnnualizedPct: r(derivatives.fundingAnnualizedPct, 1),
    funding7dAvg: derivatives.funding7dAvg, basisPct: r(derivatives.basisPct, 3),
    openInterestBtc: r(derivatives.openInterestBtc, 0), openInterestUsd: r(derivatives.openInterestUsd, 0),
    oiChange7dPct: r(derivatives.oiChange7dPct, 2), oiChange30dPct: r(derivatives.oiChange30dPct, 2),
  },
  sentiment: fearGreed && { value: fearGreed.now.value, label: fearGreed.now.label, weekAgo: fearGreed.weekAgo?.value ?? null, monthAgo: fearGreed.monthAgo?.value ?? null },
  cycle: cycle && { ...cycle.summary, asOf: iso(cycle.summary.asOf), sma200d: r(cycle.summary.sma200d, 0), wma200: r(cycle.summary.wma200, 0),
    piCycle: { ...cycle.summary.piCycle, sma111: r(cycle.summary.piCycle.sma111, 0), sma350x2: r(cycle.summary.piCycle.sma350x2, 0), lastCross: cycle.summary.piCycle.lastCross && { ...cycle.summary.piCycle.lastCross, time: iso(cycle.summary.piCycle.lastCross.time) } },
    powerLaw: { ...cycle.summary.powerLaw, fairValue: r(cycle.summary.powerLaw.fairValue, 0), bands: cycle.summary.powerLaw.bands.map(b => ({ name: b.name, price: r(b.price, 0) })) } },
  scores,
  overall,
};

// ---- write ----
const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
const outDir = join(outRoot, `${stamp}_${tf}`);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(join(outDir, 'candles.json'), JSON.stringify(c));
const chartHtml = join(outDir, 'chart.html');
await writeFile(chartHtml, await renderChart({ candles: c, ind, st: { sr, fib, trendlines: tls, divergences: divs, markers }, vp, summary, tf }));
let cycleHtml = null;
if (cycle) { cycleHtml = join(outDir, 'cycle.html'); await writeFile(cycleHtml, await renderCycle({ daily: longDaily, cycle, sources })); }

const files = { summary: join(outDir, 'summary.json'), candles: join(outDir, 'candles.json'), chartHtml, cycleHtml };
if (!args['no-png']) {
  files.chartPng = await screenshot(chartHtml, join(outDir, 'chart.png'), { width: 1600, height: 1560 }).catch(e => (warnings.push(`PNG chart: ${e.message}`), null));
  if (cycleHtml) files.cyclePng = await screenshot(cycleHtml, join(outDir, 'cycle.png'), { width: 1600, height: 1120 }).catch(e => (warnings.push(`PNG cycle: ${e.message}`), null));
  if (warnings.length) await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
}

console.log(JSON.stringify({
  outDir, files,
  headline: `BTC ${tf} $${Math.round(price)} · overall ${overall.bias} (${overall.score}) · ` + Object.entries(scores).map(([k, b]) => `${k}:${b.bias}`).join(' '),
  warnings,
}, null, 2));
