// Long-horizon cycle metrics on a long daily BTC history (2012+ with Bitstamp, shorter with other providers).
import { sma } from './indicators.mjs';

const GENESIS = Date.UTC(2009, 0, 3) / 1000;
const HALVINGS = ['2012-11-28', '2016-07-09', '2020-05-11', '2024-04-20'].map(d => Date.parse(d) / 1000);
const NEXT_HALVING_EST = Date.parse('2028-04-15') / 1000; // estimate, depends on block times

// Rainbow-style bands: quantiles of residuals around a log-log (power-law) regression.
const BAND_Q = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98];
const BAND_NAMES = ['Fire sale', 'Buy', 'Accumulate', 'Fair value', 'HODL', 'FOMO', 'Bubble'];

const days = t => (t - GENESIS) / 86400;

function powerLaw(d) {
  const xs = d.map(b => Math.log10(days(b.time))), ys = d.map(b => Math.log10(b.close));
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = num / den, intercept = my - slope * mx;
  const fit = t => intercept + slope * Math.log10(days(t));
  const resid = d.map(b => Math.log10(b.close) - fit(b.time)).sort((a, b) => a - b);
  const q = p => resid[Math.min(resid.length - 1, Math.floor(p * resid.length))];
  const offsets = BAND_Q.map(q);
  const curRes = Math.log10(d.at(-1).close) - fit(d.at(-1).time);
  const percentile = resid.findIndex(r => r >= curRes) / resid.length;
  return { slope, intercept, offsets, fit, percentile: percentile < 0 ? 1 : percentile };
}

function lastCross(a, b, d) {
  for (let i = a.length - 1; i > 0; i--) {
    if ([a[i], b[i], a[i - 1], b[i - 1]].some(v => v == null)) continue;
    if (a[i - 1] <= b[i - 1] && a[i] > b[i]) return { time: d[i].time, dir: 'up' };
    if (a[i - 1] >= b[i - 1] && a[i] < b[i]) return { time: d[i].time, dir: 'down' };
  }
  return null;
}

export function computeCycle(d, source) {
  if (!d || d.length < 1500) return null;
  const closes = d.map(b => b.close);
  const sma200d = sma(closes, 200), sma111 = sma(closes, 111), sma350 = sma(closes, 350);
  const sma1400 = sma(closes, 1400); // ≈ 200-week MA
  const pi2x350 = sma350.map(v => v == null ? null : v * 2);
  const i = d.length - 1, price = closes[i];
  const pl = powerLaw(d);
  const bandNow = pl.offsets.findIndex(o => Math.log10(price) - pl.fit(d[i].time) < o);
  const lastHalving = HALVINGS.filter(h => h <= d[i].time).at(-1);
  // 200W MA month-over-month growth drives the classic heatmap colour.
  const wmaGrowth = sma1400.map((v, j) => v == null || sma1400[j - 30] == null ? null : (v / sma1400[j - 30] - 1) * 100);

  return {
    series: { sma200d, sma111, pi2x350, sma1400, wmaGrowth, powerLaw: { intercept: pl.intercept, slope: pl.slope, offsets: pl.offsets } },
    summary: {
      price,
      asOf: d[i].time,
      mayerMultiple: +(price / sma200d[i]).toFixed(3),
      sma200d: sma200d[i],
      wma200: sma1400[i],
      priceTo200wMA: +(price / sma1400[i]).toFixed(3),
      wma200GrowthMoMPct: wmaGrowth[i] == null ? null : +wmaGrowth[i].toFixed(2),
      piCycle: {
        sma111: sma111[i],
        sma350x2: pi2x350[i],
        ratio: +(sma111[i] / pi2x350[i]).toFixed(3), // >= 1 = historical top signal
        lastCross: lastCross(sma111, pi2x350, d),
      },
      powerLaw: {
        fairValue: 10 ** (pl.fit(d[i].time) + pl.offsets[3]), // median band
        residualPercentile: +(pl.percentile * 100).toFixed(1),
        band: bandNow === -1 ? 'sopra Bubble' : bandNow === 0 ? 'sotto Fire sale' : `tra ${BAND_NAMES[bandNow - 1]} e ${BAND_NAMES[bandNow]}`,
        bands: BAND_NAMES.map((name, k) => ({ name, price: 10 ** (pl.fit(d[i].time) + pl.offsets[k]) })),
        note: `Regressione log-log su ${source?.name ?? 'storico giornaliero'} dal ${new Date(d[0].time * 1000).toISOString().slice(0, 4)}; bande = quantili 2/10/25/50/75/90/98% dei residui; fair value = mediana. Modello descrittivo, non predittivo.`,
      },
      halving: {
        last: new Date(lastHalving * 1000).toISOString().slice(0, 10),
        daysSince: Math.floor((d[i].time - lastHalving) / 86400),
        nextEstimate: new Date(NEXT_HALVING_EST * 1000).toISOString().slice(0, 10),
        cycleProgressPct: +(((d[i].time - lastHalving) / (NEXT_HALVING_EST - lastHalving)) * 100).toFixed(1),
      },
      athClose: Math.max(...closes),
      drawdownFromAthPct: +((price / Math.max(...closes) - 1) * 100).toFixed(2),
    },
    bandNames: BAND_NAMES,
  };
}
