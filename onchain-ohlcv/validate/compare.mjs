#!/usr/bin/env node
// Quality check: compares the on-chain composite with exchange candles (used ONLY as a yardstick, never shipped).
//   node validate/compare.mjs
// Output: validate/report.md, validate/report.json, validate/comparison.html (+ .png if a headless browser is available)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const TA = join(ROOT, '..', 'btc-ta', 'scripts'); // reuse the skill's indicator code
const { rsi, ema, macd, atr, bollinger } = await import(join(TA, 'lib', 'indicators.mjs'));

const readCsv = async f => (await readFile(join(ROOT, 'data', 'ohlcv', f), 'utf8')).trim().split('\n').slice(1).map(l => {
  const [time, o, h, lo, c, v, n, minutes, pools, basis] = l.split(',');
  return { time: Date.parse(time) / 1000, open: +o, high: +h, low: +lo, close: +c, volume: +v, swaps: +n, minutes: +minutes, pools: +pools, basis: +basis };
});
const ours1h = await readCsv('btc-usd-1h.csv'), ours1d = await readCsv('btc-usd-1d.csv');
const peg = (await readFile(join(ROOT, 'data', 'ohlcv', 'peg-1h.csv'), 'utf8')).trim().split('\n').slice(1).map(l => { const [t, , , s] = l.split(','); return { time: Date.parse(t) / 1000, bps: +s }; });

async function getJSON(url) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': 'onchain-ohlcv-validate' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

// Coinbase Exchange: max 300 candles per request, rows [time, low, high, open, close, volume], newest first.
async function coinbase(gran, from, to) {
  const out = [];
  for (let s = from; s < to; s += gran * 300) {
    const e = Math.min(to, s + gran * 300);
    const rows = await getJSON(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${gran}&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`);
    out.push(...rows.map(([time, low, high, open, close, volume]) => ({ time, open, high, low, close, volume })));
    await new Promise(r => setTimeout(r, 350));
  }
  return [...new Map(out.map(x => [x.time, x])).values()].sort((a, b) => a.time - b.time);
}
async function binance(interval, from, to) {
  const out = [];
  for (let s = from * 1000; s < to * 1000;) {
    const rows = await getJSON(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=1000&startTime=${s}`);
    if (!rows.length) break;
    out.push(...rows.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })));
    s = rows.at(-1)[0] + 1;
    if (rows.length < 1000) break;
  }
  return out.filter(x => x.time <= to);
}

const from = ours1h[0].time, to = ours1h.at(-1).time;
const refs = {
  'Coinbase BTC-USD': { h: await coinbase(3600, from, to + 3600), d: await coinbase(86400, ours1d[0].time, to + 86400) },
  'Binance BTCUSDT': { h: await binance('1h', from, to), d: await binance('1d', ours1d[0].time, to) },
};

const pct = (a, b) => (a / b - 1) * 100;
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); };

function compare(ours, ref) {
  const R = new Map(ref.map(x => [x.time, x]));
  const pairs = ours.filter(x => R.has(x.time)).map(x => [x, R.get(x.time)]);
  const absStats = xs => ({ medianAbs: q(xs.map(Math.abs), 0.5), p95Abs: q(xs.map(Math.abs), 0.95), p99Abs: q(xs.map(Math.abs), 0.99), maxAbs: Math.max(...xs.map(Math.abs)), medianSigned: q(xs, 0.5) });
  const rets = [];
  for (let i = 1; i < pairs.length; i++) if (pairs[i][0].time - pairs[i - 1][0].time === pairs[1][0].time - pairs[0][0].time)
    rets.push([Math.log(pairs[i][0].close / pairs[i - 1][0].close), Math.log(pairs[i][1].close / pairs[i - 1][1].close)]);
  const rangeRatio = pairs.map(([a, b]) => (a.high - a.low) / Math.max(1e-9, b.high - b.low));
  return {
    barsOurs: ours.length, barsRef: ref.length, matched: pairs.length,
    coveragePct: pairs.length / ref.filter(x => x.time >= ours[0].time && x.time <= ours.at(-1).time).length * 100,
    closeDiffPct: absStats(pairs.map(([a, b]) => pct(a.close, b.close))),
    highDiffPct: absStats(pairs.map(([a, b]) => pct(a.high, b.high))),
    lowDiffPct: absStats(pairs.map(([a, b]) => pct(a.low, b.low))),
    rangeRatioMedian: q(rangeRatio, 0.5),
    returnCorrelation: corr(rets.map(r => r[0]), rets.map(r => r[1])),
    volumeLogCorrelation: corr(pairs.map(([a]) => Math.log(a.volume + 1)), pairs.map(([, b]) => Math.log(b.volume * b.close + 1))),
    pairs,
  };
}

// Indicators computed with the skill's own code on both series (1h: enough history for all of them).
function indicatorDiffs(pairs) {
  const A = pairs.map(p => p[0]), B = pairs.map(p => p[1]);
  const calc = c => { const cl = c.map(x => x.close); return { rsi: rsi(cl), ema20: ema(cl, 20), ema50: ema(cl, 50), ema200: ema(cl, 200), macdHist: macd(cl).hist, atr: atr(c), bbUpper: bollinger(cl).upper }; };
  const a = calc(A), b = calc(B), out = {};
  for (const k of Object.keys(a)) {
    const idx = a[k].map((v, i) => (v != null && b[k][i] != null ? i : -1)).filter(i => i >= 0);
    const scale = k === 'rsi' ? 1 : k === 'macdHist' ? null : 'pct';
    const diffs = idx.map(i => scale === 'pct' ? pct(a[k][i], b[k][i]) : a[k][i] - b[k][i]);
    out[k] = { last: { ours: a[k].at(-1), ref: b[k].at(-1) }, medianAbsDiff: q(diffs.map(Math.abs), 0.5), p95AbsDiff: q(diffs.map(Math.abs), 0.95), unit: scale === 'pct' ? '%' : 'punti' };
    if (k === 'macdHist') { const agree = idx.filter(i => Math.sign(a[k][i]) === Math.sign(b[k][i])).length / idx.length * 100; out[k].signAgreementPct = agree; }
  }
  // RSI zone agreement (>70, <30, between)
  const zone = v => (v >= 70 ? 1 : v <= 30 ? -1 : 0);
  const idx = a.rsi.map((v, i) => (v != null && b.rsi[i] != null ? i : -1)).filter(i => i >= 0);
  out.rsi.zoneAgreementPct = idx.filter(i => zone(a.rsi[i]) === zone(b.rsi[i])).length / idx.length * 100;
  return out;
}

const report = { generatedAt: new Date().toISOString(), period: { from: new Date(from * 1000).toISOString(), to: new Date(to * 1000).toISOString() }, results: {} };
for (const [name, r] of Object.entries(refs)) {
  const h = compare(ours1h, r.h), d = compare(ours1d, r.d);
  report.results[name] = { '1h': { ...h, pairs: undefined, indicators: indicatorDiffs(h.pairs) }, '1d': { ...d, pairs: undefined } };
}
const pegBps = peg.map(p => p.bps), basis = ours1h.map(x => x.basis);
report.peg = { wbtcVsCbbtcSpreadBps: { median: q(pegBps, 0.5), p95Abs: q(pegBps.map(Math.abs), 0.95), maxAbs: Math.max(...pegBps.map(Math.abs)) } };
report.usdtUsd = { min: Math.min(...basis), max: Math.max(...basis), median: q(basis, 0.5) };
report.gaps = { hoursWithoutTrades: (to - from) / 3600 + 1 - ours1h.length, hoursWithFewMinutes: ours1h.filter(x => x.minutes < 10).length };
await writeFile(join(HERE, 'report.json'), JSON.stringify(report, null, 2));

// ---- markdown ----
const f = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
let md = `# Validazione composito on-chain BTC/USD\n\nPeriodo: ${report.period.from.slice(0, 16)} → ${report.period.to.slice(0, 16)} UTC · ${ours1h.length} ore, ${ours1d.length} giorni.\nRiferimenti usati solo per il confronto: ${Object.keys(refs).join(', ')}.\n\n`;
for (const [name, r] of Object.entries(report.results)) {
  md += `## vs ${name}\n\n| Metrica | 1h | 1d |\n|---|---|---|\n`;
  const row = (label, fn) => (md += `| ${label} | ${fn(r['1h'])} | ${fn(r['1d'])} |\n`);
  row('Barre confrontate', x => `${x.matched} (copertura ${f(x.coveragePct, 1)}%)`);
  row('Scarto close: mediana / p95 / p99 / max (%)', x => `${f(x.closeDiffPct.medianAbs)} / ${f(x.closeDiffPct.p95Abs)} / ${f(x.closeDiffPct.p99Abs)} / ${f(x.closeDiffPct.maxAbs)}`);
  row('Scarto close medio con segno (%)', x => f(x.closeDiffPct.medianSigned));
  row('Scarto high: mediana / p95 (%)', x => `${f(x.highDiffPct.medianAbs)} / ${f(x.highDiffPct.p95Abs)}`);
  row('Scarto low: mediana / p95 (%)', x => `${f(x.lowDiffPct.medianAbs)} / ${f(x.lowDiffPct.p95Abs)}`);
  row('Ampiezza barra on-chain / riferimento (mediana)', x => f(x.rangeRatioMedian, 2));
  row('Correlazione rendimenti', x => f(x.returnCorrelation, 4));
  row('Correlazione volumi (log)', x => f(x.volumeLogCorrelation, 3));
  md += `\n**Indicatori su 1h calcolati con il codice della skill:**\n\n| Indicatore | Nostro (ultimo) | Riferimento (ultimo) | Scarto mediano | Scarto p95 | Note |\n|---|---|---|---|---|---|\n`;
  for (const [k, v] of Object.entries(r['1h'].indicators)) {
    const note = k === 'rsi' ? `zona (>70/<30/neutra) coincide nel ${f(v.zoneAgreementPct, 1)}% delle ore` : k === 'macdHist' ? `segno coincide nel ${f(v.signAgreementPct, 1)}% delle ore` : '';
    md += `| ${k} | ${f(v.last.ours, 2)} | ${f(v.last.ref, 2)} | ${f(v.medianAbsDiff)} ${v.unit} | ${f(v.p95AbsDiff)} ${v.unit} | ${note} |\n`;
  }
  md += '\n';
}
md += `## Controlli interni\n\n- Spread WBTC vs cbBTC (pool on-chain): mediana ${f(report.peg.wbtcVsCbbtcSpreadBps.median, 1)} bps, p95 ${f(report.peg.wbtcVsCbbtcSpreadBps.p95Abs, 1)} bps, max ${f(report.peg.wbtcVsCbbtcSpreadBps.maxAbs, 1)} bps.\n- USDT/USD stimato on-chain: min ${f(report.usdtUsd.min, 5)}, mediana ${f(report.usdtUsd.median, 5)}, max ${f(report.usdtUsd.max, 5)}.\n- Ore senza scambi: ${report.gaps.hoursWithoutTrades}; ore con meno di 10 minuti con scambi: ${report.gaps.hoursWithFewMinutes}.\n`;
await writeFile(join(HERE, 'report.md'), md);

// ---- comparison chart ----
const lib = await readFile(join(ROOT, '..', 'btc-ta', 'assets', 'lightweight-charts-5.2.1.js'), 'utf8');
const cb = refs['Coinbase BTC-USD'].h, CB = new Map(cb.map(x => [x.time, x]));
const data = {
  ours: ours1h.map(x => ({ time: x.time, open: x.open, high: x.high, low: x.low, close: x.close })),
  ref: cb.map(x => ({ time: x.time, value: x.close })),
  diff: ours1h.filter(x => CB.has(x.time)).map(x => ({ time: x.time, value: +((x.close / CB.get(x.time).close - 1) * 1e4).toFixed(1) })),
  peg: peg.map(p => ({ time: p.time, value: p.bps })),
  vol: ours1h.map(x => ({ time: x.time, value: x.volume })),
};
const c1 = report.results['Coinbase BTC-USD']['1h'];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Validazione on-chain</title><style>
body{margin:0;background:#0d1117;color:#e6edf3;font:13px system-ui,sans-serif}.w{padding:14px 16px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 10px;color:#8b949e}
#c{height:1000px;border:1px solid #30363d;border-radius:8px}.k{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.k div{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:6px 10px}.k b{display:block;font-size:16px}</style></head>
<body><div class="w"><h1>BTC/USD on-chain (DEX) vs Coinbase · 1h</h1><p>${report.period.from.slice(0, 10)} → ${report.period.to.slice(0, 10)} · candele = composito on-chain · linea arancione = Coinbase close</p>
<div class="k"><div>Scarto close mediano<b>${f(c1.closeDiffPct.medianAbs)}%</b></div><div>p95<b>${f(c1.closeDiffPct.p95Abs)}%</b></div><div>max<b>${f(c1.closeDiffPct.maxAbs)}%</b></div><div>Correlazione rendimenti<b>${f(c1.returnCorrelation, 4)}</b></div><div>RSI: zona coincidente<b>${f(c1.indicators.rsi.zoneAgreementPct, 1)}%</b></div><div>Copertura<b>${f(c1.coveragePct, 1)}%</b></div></div>
<div id="c"></div></div><script>${lib}</script><script>
const D=${JSON.stringify(data)};const L=LightweightCharts;
const ch=L.createChart(document.getElementById('c'),{autoSize:true,layout:{background:{color:'#0d1117'},textColor:'#8b949e',panes:{separatorColor:'#30363d'}},grid:{vertLines:{color:'#161b22'},horzLines:{color:'#161b22'}},timeScale:{timeVisible:true,borderColor:'#30363d'},rightPriceScale:{borderColor:'#30363d'}});
const k=ch.addSeries(L.CandlestickSeries,{upColor:'#26a69a',downColor:'#ef5350',borderVisible:false,wickUpColor:'#26a69a',wickDownColor:'#ef5350'});k.setData(D.ours);
ch.addSeries(L.LineSeries,{color:'#f0883e',lineWidth:1,priceLineVisible:false,lastValueVisible:false}).setData(D.ref);
const v=ch.addSeries(L.HistogramSeries,{priceScaleId:'v',color:'rgba(88,166,255,.35)',priceLineVisible:false,lastValueVisible:false});v.setData(D.vol);ch.priceScale('v').applyOptions({scaleMargins:{top:.85,bottom:0}});
const d=ch.addSeries(L.HistogramSeries,{color:'#bc8cff',priceLineVisible:false},1);d.setData(D.diff);
const p=ch.addSeries(L.LineSeries,{color:'#e3b341',lineWidth:1,priceLineVisible:false},2);p.setData(D.peg);
ch.panes()[0].setStretchFactor(600);ch.panes()[1].setStretchFactor(200);ch.panes()[2].setStretchFactor(150);
[['Composito on-chain (candele) vs Coinbase (arancione) · volume DEX',0],['Scarto close on-chain − Coinbase (bps)',1],['Spread WBTC − cbBTC (bps)',2]].forEach(([t,i])=>L.createTextWatermark(ch.panes()[i],{horzAlign:'left',vertAlign:'top',lines:[{text:t,color:'rgba(139,148,158,.8)',fontSize:11}]}));
ch.timeScale().fitContent();
</script></body></html>`;
await writeFile(join(HERE, 'comparison.html'), html);
try {
  const { screenshot } = await import(join(TA, 'screenshot.mjs'));
  await screenshot(join(HERE, 'comparison.html'), join(HERE, 'comparison.png'), { width: 1600, height: 1160 });
} catch (e) { console.warn('PNG non generato:', e.message); }
console.log(md);
