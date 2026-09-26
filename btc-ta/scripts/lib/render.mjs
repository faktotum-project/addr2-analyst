// Builds standalone HTML pages (Lightweight Charts inlined) for the TF chart and the cycle chart.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LIB = fileURLToPath(new URL('../../assets/lightweight-charts-5.2.1.js', import.meta.url));

const pts = (c, arr, digits) => c.flatMap((b, i) => arr[i] == null || !Number.isFinite(arr[i]) ? [] : [{ time: b.time, value: digits == null ? arr[i] : +arr[i].toFixed(digits) }]);
const embed = obj => JSON.stringify(obj).replace(/</g, '\\u003c');
const fmt = (v, d = 0) => v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

const CSS = `
:root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--text:#e6edf3;--muted:#8b949e;--up:#26a69a;--down:#ef5350;--gold:#e3b341;--blue:#58a6ff;--violet:#bc8cff;--orange:#f0883e}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font:13px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1600px;margin:0 auto;padding:14px 16px 24px}
header{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;margin-bottom:10px}
h1{font-size:18px;margin:0;font-weight:600}h1 small{color:var(--muted);font-weight:400;font-size:13px;margin-left:6px}
.price{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}.chg{font-size:14px;margin-left:8px}
.tiles{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-width:110px}
.tile b{display:block;font-size:15px;font-variant-numeric:tabular-nums}.tile span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line)}
.bullish{color:var(--up);border-color:color-mix(in srgb,var(--up) 50%,transparent)}.bearish{color:var(--down);border-color:color-mix(in srgb,var(--down) 50%,transparent)}.neutral{color:var(--muted)}
.toggles{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0 8px;color:var(--muted);font-size:12px}
.toggles label{cursor:pointer;user-select:none;display:flex;align-items:center;gap:5px}.sw{width:12px;height:3px;border-radius:2px;display:inline-block}
.chartbox{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden}
#vp{position:absolute;inset:0;pointer-events:none;z-index:3}
#legend{position:absolute;left:10px;top:22px;z-index:4;font-size:12px;font-variant-numeric:tabular-nums;color:var(--muted);pointer-events:none}
footer{color:var(--muted);font-size:11px;margin-top:10px;line-height:1.6}
@media (max-width:700px){.price{font-size:22px}.tile{min-width:90px}}
`;

function shell({ title, head, body, script, lib }) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${CSS}</style></head><body><div class="wrap">${head}${body}</div>
<script>${lib}</script><script>${script}</script></body></html>`;
}

// Human-readable list of the data sources actually used (attribution is also a licence condition for some).
function sourcesLine(src, candleInfo) {
  const roles = [['candles', `candele ${candleInfo}`], ['derivatives', 'funding, OI'], ['sentiment', 'Fear & Greed'], ['history', 'storico giornaliero per le metriche di ciclo']];
  return roles.filter(([k]) => src[k]).map(([k, what]) => `${src[k].name} (${what})`).join(', ');
}

const tile = (label, value, cls = '') => `<div class="tile"><span>${label}</span><b class="${cls}">${value}</b></div>`;

// Shared client-side helpers (string injected into both pages).
const CLIENT_COMMON = `
const L = LightweightCharts;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { up: css('--up'), down: css('--down'), gold: css('--gold'), blue: css('--blue'), violet: css('--violet'), orange: css('--orange'), muted: css('--muted'), text: css('--text'), line: css('--line'), bg: css('--bg') };
function mkChart(el, opts = {}) {
  return L.createChart(el, {
    autoSize: true,
    layout: { background: { color: C.bg }, textColor: C.muted, fontSize: 11, panes: { separatorColor: C.line, separatorHoverColor: C.line } },
    grid: { vertLines: { color: 'rgba(48,54,61,.35)' }, horzLines: { color: 'rgba(48,54,61,.35)' } },
    crosshair: { mode: L.CrosshairMode.Normal },
    rightPriceScale: { borderColor: C.line },
    timeScale: { borderColor: C.line, rightOffset: 8, ...(opts.timeScale || {}) },
    ...opts.chart,
  });
}
const layers = {};
function reg(key, s) { (layers[key] ||= []).push(s); return s; }
function line(chart, data, o = {}, pane = 0) {
  const s = chart.addSeries(L.LineSeries, { lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...o }, pane);
  s.setData(data); return s;
}
function label(chart, pane, text) {
  try { L.createTextWatermark(chart.panes()[pane], { horzAlign: 'left', vertAlign: 'top', lines: [{ text, color: 'rgba(139,148,158,.7)', fontSize: 11 }] }); } catch {}
}
function wireToggles() {
  document.querySelectorAll('[data-layer]').forEach(cb => cb.addEventListener('change', () => {
    (layers[cb.dataset.layer] || []).forEach(s => s.show ? (cb.checked ? s.show() : s.hide()) : s.applyOptions({ visible: cb.checked }));
    window.redrawOverlay && window.redrawOverlay();
  }));
}
`;

export async function renderChart({ candles: c, ind, st, vp, summary, tf }) {
  const lib = await readFile(LIB, 'utf8');
  const s = summary;
  const tfLabel = tf === '1mo' ? '1M' : tf.toUpperCase();
  const data = {
    tf,
    intraday: !['1d', '1w', '1mo'].includes(tf),
    candles: c.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
    volume: c.map((b, i) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(38,166,154,.45)' : 'rgba(239,83,80,.45)' })),
    ema20: pts(c, ind.ema20, 2), ema50: pts(c, ind.ema50, 2), ema200: pts(c, ind.ema200, 2),
    bbU: pts(c, ind.bb.upper, 2), bbM: pts(c, ind.bb.mid, 2), bbL: pts(c, ind.bb.lower, 2),
    vwap: pts(c, ind.vwap, 2),
    obv: pts(c, ind.obv, 2), obvEma: pts(c, ind.obvEma, 2),
    rsi: pts(c, ind.rsi, 2),
    macd: pts(c, ind.macd.line, 2), macdSig: pts(c, ind.macd.signal, 2),
    macdHist: c.flatMap((b, i) => ind.macd.hist[i] == null ? [] : [{ time: b.time, value: +ind.macd.hist[i].toFixed(2),
      color: ind.macd.hist[i] >= 0 ? (ind.macd.hist[i] >= (ind.macd.hist[i - 1] ?? 0) ? '#26a69a' : 'rgba(38,166,154,.45)') : (ind.macd.hist[i] <= (ind.macd.hist[i - 1] ?? 0) ? '#ef5350' : 'rgba(239,83,80,.45)') }]),
    stochK: pts(c, ind.stoch.k, 2), stochD: pts(c, ind.stoch.d, 2),
    adx: pts(c, ind.adx.adx, 2), pdi: pts(c, ind.adx.plusDI, 2), mdi: pts(c, ind.adx.minusDI, 2),
    sr: st.sr, fib: st.fib, trendlines: st.trendlines, divergences: st.divergences,
    rsiAt: Object.fromEntries(c.map((b, i) => [b.time, ind.rsi[i]])),
    markers: st.markers,
    vp,
  };

  const chg = s.price.changePct;
  const head = `<header>
  <div><h1>${s.meta.pair} · ${tfLabel}<small>${s.meta.sources.candles.name} · dati al ${s.meta.asOfIso}${s.meta.lastBarClosed ? '' : ' (barra in corso)'}</small></h1>
  <div><span class="price">$${fmt(s.price.last, 0)}</span><span class="chg ${chg >= 0 ? 'bullish' : 'bearish'}">${chg >= 0 ? '+' : ''}${fmt(chg, 2)}% (1 barra)</span></div></div>
  <div>${Object.entries(s.scores).map(([k, v]) => `<span class="chip ${v.bias}" title="${v.reasons.join(' · ').replace(/"/g, '&quot;')}">${k}: ${v.bias}</span>`).join(' ')}
  <span class="chip ${s.overall.bias}" style="margin-left:6px">Complessivo: ${s.overall.bias} (${s.overall.score > 0 ? '+' : ''}${s.overall.score})</span></div>
</header>
<div class="tiles">
  ${tile('RSI 14', fmt(s.momentum.rsi, 1))}
  ${tile('MACD hist', fmt(s.momentum.macdHist, 0), s.momentum.macdHist >= 0 ? 'bullish' : 'bearish')}
  ${tile('ADX', fmt(s.trend.adx, 1))}
  ${tile('ATR %', fmt(s.volatility.atrPct, 2) + '%')}
  ${tile('BB width pct', fmt(s.volatility.bbWidthPercentile, 0))}
  ${tile('POC swing', '$' + fmt(s.volumeProfile.anchored.poc, 0))}
  ${tile('POC ' + s.volumeProfile.recent.window, '$' + fmt(s.volumeProfile.recent.poc, 0))}
  ${s.sentiment ? tile('Fear & Greed · ' + s.meta.sources.sentiment.attribution, `${s.sentiment.value} · ${s.sentiment.label}`) : ''}
  ${s.derivatives ? tile('Funding 8h', fmt(s.derivatives.fundingRate * 100, 4) + '%', s.derivatives.fundingRate >= 0 ? 'bullish' : 'bearish') : ''}
  ${s.derivatives ? tile('Open interest', fmt(s.derivatives.openInterestBtc, 0) + ' BTC') : ''}
  ${s.cycle ? tile('Mayer multiple', fmt(s.cycle.mayerMultiple, 2)) : ''}
</div>`;

  const T = (k, color, text, on = true) => `<label><input type="checkbox" data-layer="${k}" ${on ? 'checked' : ''}><i class="sw" style="background:${color}"></i>${text}</label>`;
  const body = `<div class="toggles">
  ${T('ema', 'linear-gradient(90deg,#58a6ff,#e3b341,#bc8cff)', 'EMA 20/50/200')}${T('bb', '#8b949e', 'Bollinger 20,2')}${T('vwap', '#f0883e', 'VWAP ancorato')}
  ${T('sr', '#26a69a', 'Supporti/Resistenze')}${T('fib', '#e3b341', 'Fibonacci')}${T('tl', '#e6edf3', 'Trendline')}${T('div', '#bc8cff', 'Divergenze RSI')}${T('vp', 'linear-gradient(90deg,#58a6ff,#bc8cff)', 'Volume profile (swing · recente)')}
</div>
<div class="chartbox" style="height:1220px"><div id="chart" style="position:absolute;inset:0"></div><canvas id="vp"></canvas><div id="legend"></div></div>
<footer>Fonti: ${sourcesLine(s.meta.sources, `${tf}, ${c.length} barre`)}.
Volume profile in USDT: blu = dallo swing (stessa ancora di Fib/VWAP), viola = finestra recente. Supporti/resistenze = cluster di swing pivot; Fibonacci sullo swing dominante delle ultime ${st.fib.lookback} barre; VWAP ancorato al minimo/massimo di quello swing.
Generato automaticamente — non è consulenza finanziaria.</footer>`;

  const script = `const D = ${embed(data)};
${CLIENT_COMMON}
const chart = mkChart(document.getElementById('chart'), { timeScale: { timeVisible: D.intraday } });
const candles = chart.addSeries(L.CandlestickSeries, { upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down, priceFormat: { type: 'price', precision: 0, minMove: 1 } });
candles.setData(D.candles);
const vol = chart.addSeries(L.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
vol.setData(D.volume);
chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

reg('ema', line(chart, D.ema20, { color: C.blue, lineWidth: 1 }));
reg('ema', line(chart, D.ema50, { color: C.gold, lineWidth: 1.5 }));
reg('ema', line(chart, D.ema200, { color: C.violet, lineWidth: 2 }));
const bbO = { color: 'rgba(139,148,158,.55)', lineWidth: 1 };
reg('bb', line(chart, D.bbU, bbO)); reg('bb', line(chart, D.bbL, bbO)); reg('bb', line(chart, D.bbM, { ...bbO, lineStyle: L.LineStyle.Dotted }));
reg('vwap', line(chart, D.vwap, { color: C.orange, lineWidth: 1.5, lineStyle: L.LineStyle.Dashed }));

// Support / resistance as price lines (toggle = remove / recreate).
const srDefs = [
  ...D.sr.supports.map((l, k) => ({ price: l.price, color: C.up, title: 'S' + (k + 1) + ' ×' + l.touches })),
  ...D.sr.resistances.map((l, k) => ({ price: l.price, color: C.down, title: 'R' + (k + 1) + ' ×' + l.touches })),
];
let srLines = [];
const srLayer = { show() { srLines = srDefs.map(d => candles.createPriceLine({ ...d, lineWidth: 1, lineStyle: L.LineStyle.Solid, axisLabelVisible: true })); },
                  hide() { srLines.forEach(p => candles.removePriceLine(p)); srLines = []; } };
srLayer.show(); reg('sr', srLayer);

// Fibonacci: horizontal segments from swing start to last bar.
const lastT = D.candles.at(-1).time;
const fibColor = r => r === 0.618 || r === 0.5 ? C.gold : 'rgba(227,179,65,.55)';
D.fib.levels.forEach(l => reg('fib', line(chart, [{ time: D.fib.from.time, value: l.price }, { time: lastT, value: l.price }],
  { color: fibColor(l.ratio), lineWidth: 1, lineStyle: L.LineStyle.Dashed, lastValueVisible: true, title: 'Fib ' + (l.ratio * 100).toFixed(1) + '%', autoscaleInfoProvider: () => null })));
reg('fib', line(chart, [D.fib.from, D.fib.to].map(p => ({ time: p.time, value: p.price })), { color: 'rgba(227,179,65,.35)', lineWidth: 1, lineStyle: L.LineStyle.SparseDotted }));

// Trendlines through two pivots, extended to the last bar.
D.trendlines.forEach(t => {
  const ptsTL = [t.p1, t.p2, t.end].filter((p, i, a) => i === 0 || p.time > a[i - 1].time).map(p => ({ time: p.time, value: p.price }));
  reg('tl', line(chart, ptsTL, { color: t.kind === 'support' ? C.up : C.down, lineWidth: 2, lineStyle: t.broken ? L.LineStyle.Dashed : L.LineStyle.Solid, autoscaleInfoProvider: () => null }));
});

// Sub-panes: 1 OBV, 2 RSI, 3 MACD, 4 StochRSI, 5 ADX.
reg('obv', line(chart, D.obv, { color: C.blue, lineWidth: 1.2 }, 1)); line(chart, D.obvEma, { color: C.gold, lineWidth: 1 }, 1);
const rsiS = line(chart, D.rsi, { color: C.violet, lineWidth: 1.5, lastValueVisible: true }, 2);
[70, 50, 30].forEach(v => rsiS.createPriceLine({ price: v, color: v === 50 ? 'rgba(139,148,158,.35)' : 'rgba(139,148,158,.7)', lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false }));
chart.addSeries(L.HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 3).setData(D.macdHist);
line(chart, D.macd, { color: C.blue, lineWidth: 1.2, lastValueVisible: true }, 3); line(chart, D.macdSig, { color: C.orange, lineWidth: 1.2 }, 3);
const stK = line(chart, D.stochK, { color: C.blue, lineWidth: 1.2 }, 4); line(chart, D.stochD, { color: C.orange, lineWidth: 1.2 }, 4);
[80, 20].forEach(v => stK.createPriceLine({ price: v, color: 'rgba(139,148,158,.6)', lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false }));
const adxS = line(chart, D.adx, { color: C.text, lineWidth: 1.5, lastValueVisible: true }, 5);
line(chart, D.pdi, { color: C.up, lineWidth: 1 }, 5); line(chart, D.mdi, { color: C.down, lineWidth: 1 }, 5);
adxS.createPriceLine({ price: 25, color: 'rgba(139,148,158,.6)', lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false });

// Divergences: segment on price and on RSI.
D.divergences.forEach(d => {
  const col = d.type === 'bullish' ? C.up : C.down;
  reg('div', line(chart, [d.from, d.to].map(p => ({ time: p.time, value: p.price })), { color: col, lineWidth: 2, lineStyle: L.LineStyle.Dotted, autoscaleInfoProvider: () => null }));
  reg('div', line(chart, [d.from, d.to].map(p => ({ time: p.time, value: p.rsi })), { color: col, lineWidth: 2, lineStyle: L.LineStyle.Dotted }, 2));
});

L.createSeriesMarkers(candles, D.markers.map(m => ({ time: m.time, position: m.position, shape: m.shape, color: C[m.color] || m.color, text: m.text })));

// Stretch factors are relative weights; main pane ≈ 55% of the chart.
const stretch = [620, 95, 125, 125, 100, 100];
chart.panes().forEach((p, i) => p.setStretchFactor(stretch[i]));
['Prezzo · EMA · BB · VWAP · S/R · Fib', 'OBV + EMA20', 'RSI 14', 'MACD 12/26/9', 'Stoch RSI 14/14/3/3', 'ADX 14 · +DI · −DI'].forEach((t, i) => label(chart, i, t));
chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, D.candles.length - 260), to: D.candles.length + 8 });

// Two volume profiles on a canvas overlay aligned with pane 0's price scale:
// "swing" grows rightwards from its anchor bar (fixed-range style), "recent" grows leftwards from the price axis.
const cv = document.getElementById('vp'), ctx = cv.getContext('2d');
let vpOn = true; reg('vp', { show() { vpOn = true; }, hide() { vpOn = false; } });
const VP_STYLE = {
  anchored: { bar: 'rgba(88,166,255,', poc: 'rgba(240,136,62,.9)', pocFill: 'rgba(240,136,62,.6)', name: 'POC swing' },
  recent: { bar: 'rgba(188,140,255,', poc: 'rgba(227,179,65,.95)', pocFill: 'rgba(227,179,65,.6)', name: 'POC ' + D.vp.recent.label },
};
function drawProfile(p, st, x0, dir, maxW, right, labelDy = -4) {
  const maxV = Math.max(...p.rows.map(r => r.volume));
  p.rows.forEach(r => {
    const y1 = candles.priceToCoordinate(r.high), y2 = candles.priceToCoordinate(r.low);
    if (y1 == null || y2 == null) return;
    const inVA = r.high > p.val && r.low < p.vah, isPoc = p.poc >= r.low && p.poc < r.high;
    ctx.fillStyle = isPoc ? st.pocFill : st.bar + (inVA ? '.30)' : '.12)');
    const w = (r.volume / maxV) * maxW;
    ctx.fillRect(dir > 0 ? x0 : x0 - w, y1, w, Math.max(1, y2 - y1 - 1));
  });
  // POC line from the profile to the price axis, labelled.
  const yp = candles.priceToCoordinate(p.poc);
  if (yp == null) return;
  ctx.strokeStyle = st.poc; ctx.lineWidth = 1.2; ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(dir > 0 ? x0 : x0 - maxW, yp); ctx.lineTo(right, yp); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = st.poc; ctx.font = '600 11px system-ui'; ctx.textAlign = dir > 0 ? 'left' : 'right';
  const txt = st.name + ' ' + Math.round(p.poc).toLocaleString('en-US');
  ctx.fillText(txt, dir > 0 ? x0 + 4 : x0 - maxW - 6, yp + labelDy);
}
window.redrawOverlay = () => {
  const box = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = box.width * dpr; cv.height = box.height * dpr; cv.style.width = box.width + 'px'; cv.style.height = box.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, box.width, box.height);
  if (!vpOn) return;
  const paneH = chart.panes()[0].getHeight(), right = box.width - chart.priceScale('right').width();
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, right, paneH); ctx.clip();
  const xa = chart.timeScale().timeToCoordinate(D.vp.anchored.fromTime);
  drawProfile(D.vp.anchored, VP_STYLE.anchored, Math.max(0, xa ?? 0), 1, right * 0.14, right);
  // When both POCs sit on (almost) the same price, put the second label under the line.
  const samePoc = Math.abs(D.vp.anchored.poc - D.vp.recent.poc) < D.vp.anchored.step * 2;
  drawProfile(D.vp.recent, VP_STYLE.recent, right, -1, right * 0.12, right, samePoc ? 13 : -4);
  ctx.restore();
};
const schedule = () => requestAnimationFrame(window.redrawOverlay);
chart.timeScale().subscribeVisibleLogicalRangeChange(schedule);
new ResizeObserver(schedule).observe(cv.parentElement);
setTimeout(schedule, 50);

// Crosshair OHLC legend.
const lg = document.getElementById('legend'), f0 = v => v == null ? '—' : Math.round(v).toLocaleString('en-US');
const showLegend = b => { if (!b) return; lg.innerHTML = 'O ' + f0(b.open) + ' · H ' + f0(b.high) + ' · L ' + f0(b.low) + ' · C <b style="color:' + (b.close >= b.open ? C.up : C.down) + '">' + f0(b.close) + '</b>'; };
showLegend(D.candles.at(-1));
chart.subscribeCrosshairMove(p => showLegend(p.seriesData && p.seriesData.get(candles) || D.candles.at(-1)));
wireToggles();
document.body.dataset.ready = '1';
`;
  return shell({ title: `BTC ${tfLabel} Analisi`, head, body, script, lib });
}

export async function renderCycle({ daily: d, cycle, sources }) {
  const lib = await readFile(LIB, 'utf8');
  const s = cycle.summary, ser = cycle.series;
  // Heatmap colour of price by 200W MA month-over-month growth (blue = cool, red = hot).
  const heat = g => g == null ? '#8b949e' : g < 0 ? '#3b6fd8' : g < 2 ? '#2aa3c9' : g < 4 ? '#3fb950' : g < 6 ? '#d4c227' : g < 8 ? '#f0883e' : '#f85149';
  const weekly = d.filter((_, i) => i % 7 === 0 || i === d.length - 1);
  const GEN = Date.UTC(2009, 0, 3) / 1000;
  const bandColors = ['#1f6feb', '#2aa3c9', '#3fb950', '#a3c93f', '#d4c227', '#f0883e', '#f85149'];
  const data = {
    price: d.map((b, i) => ({ time: b.time, value: b.close, color: heat(ser.wmaGrowth[i]) })),
    wma: pts(d, ser.sma1400, 2), sma111: pts(d, ser.sma111, 2), pi2: pts(d, ser.pi2x350, 2),
    mayer: d.flatMap((b, i) => ser.sma200d[i] ? [{ time: b.time, value: +(b.close / ser.sma200d[i]).toFixed(3) }] : []),
    bands: ser.powerLaw.offsets.map((o, k) => ({
      color: bandColors[k], name: cycle.bandNames[k],
      data: weekly.map(b => ({ time: b.time, value: +(10 ** (ser.powerLaw.intercept + ser.powerLaw.slope * Math.log10((b.time - GEN) / 86400) + o)).toFixed(2) })),
    })),
    halvings: ['2012-11-28', '2016-07-09', '2020-05-11', '2024-04-20'].map(x => Date.parse(x) / 1000).filter(t => t >= d[0].time),
  };
  const head = `<header><div><h1>BTC/USD · Ciclo di lungo periodo<small>${sources.history.name} · scala logaritmica · dati al ${new Date(s.asOf * 1000).toISOString().slice(0, 10)}</small></h1>
<div><span class="price">$${fmt(s.price, 0)}</span><span class="chg ${s.drawdownFromAthPct >= -5 ? 'bullish' : 'bearish'}">${fmt(s.drawdownFromAthPct, 1)}% dall'ATH (close)</span></div></div></header>
<div class="tiles">
${tile('Mayer multiple', fmt(s.mayerMultiple, 2))}${tile('Prezzo / 200W MA', fmt(s.priceTo200wMA, 2))}${tile('200W MA', '$' + fmt(s.wma200, 0))}
${tile('Pi Cycle ratio', fmt(s.piCycle.ratio, 3), s.piCycle.ratio >= 0.95 ? 'bearish' : '')}${tile('Power law fair value', '$' + fmt(s.powerLaw.fairValue, 0))}
${tile('Banda power law', s.powerLaw.band)}${tile('Giorni da halving', s.halving.daysSince + ' · ' + s.halving.cycleProgressPct + '%')}</div>`;
  const body = `<div class="toggles">
<label><input type="checkbox" data-layer="bands" checked><i class="sw" style="background:linear-gradient(90deg,#1f6feb,#3fb950,#d4c227,#f85149)"></i>Bande power law</label>
<label><input type="checkbox" data-layer="wma" checked><i class="sw" style="background:#58a6ff"></i>200W MA</label>
<label><input type="checkbox" data-layer="pi" checked><i class="sw" style="background:#e3b341"></i>Pi Cycle (111D / 2×350D)</label>
<span>Colore del prezzo = crescita mensile della 200W MA (blu freddo → rosso surriscaldato)</span></div>
<div class="chartbox" style="height:860px"><div id="chart" style="position:absolute;inset:0"></div></div>
<footer>${s.powerLaw.note} Pi Cycle Top: storicamente il cross al rialzo della 111D sopra 2×350D ha coinciso con i top di ciclo (2013, 2017, 2021). Mayer multiple = prezzo / SMA 200D.
Non è consulenza finanziaria.</footer>`;
  const script = `const D = ${embed(data)};
${CLIENT_COMMON}
const chart = mkChart(document.getElementById('chart'), { timeScale: { minBarSpacing: 0.05 } });
const P0 = { type: 'price', precision: 0, minMove: 1 };
chart.priceScale('right').applyOptions({ mode: L.PriceScaleMode.Logarithmic });
D.bands.forEach(b => reg('bands', line(chart, b.data, { color: b.color + '99', lineWidth: 1, title: b.name, lastValueVisible: true, priceFormat: P0, autoscaleInfoProvider: () => null })));
const price = line(chart, D.price, { lineWidth: 2, lastValueVisible: true, priceLineVisible: true, crosshairMarkerVisible: true, priceFormat: { type: 'price', precision: 0, minMove: 1 } });
reg('wma', line(chart, D.wma, { color: C.blue, lineWidth: 2, title: '200W MA', lastValueVisible: true, priceFormat: P0 }));
reg('pi', line(chart, D.sma111, { color: C.gold, lineWidth: 1, priceFormat: P0 }));
reg('pi', line(chart, D.pi2, { color: C.orange, lineWidth: 1, lineStyle: L.LineStyle.Dashed, priceFormat: P0 }));
L.createSeriesMarkers(price, D.halvings.map(t => ({ time: D.price.find(p => p.time >= t)?.time ?? t, position: 'belowBar', shape: 'arrowUp', color: C.text, text: 'Halving' })));
const mm = line(chart, D.mayer, { color: C.violet, lineWidth: 1.2, lastValueVisible: true }, 1);
[[2.4, C.down], [1, 'rgba(139,148,158,.5)'], [0.8, C.up]].forEach(([p, c]) => mm.createPriceLine({ price: p, color: c, lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: true }));
chart.panes()[0].setStretchFactor(650); chart.panes()[1].setStretchFactor(170);
label(chart, 0, 'Prezzo (log) · 200W MA · Pi Cycle · bande power law'); label(chart, 1, 'Mayer multiple (prezzo / SMA200D)');
chart.timeScale().fitContent();
wireToggles();
document.body.dataset.ready = '1';
`;
  return shell({ title: 'BTC Ciclo Lungo', head, body, script, lib });
}
