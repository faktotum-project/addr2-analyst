import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = dirname(fileURLToPath(import.meta.url));
const sourceFile = process.argv[2] ? resolve(process.argv[2]) : join(siteDir, 'content/articles.json');
const source = JSON.parse(await readFile(sourceFile, 'utf8'));
const assetsDir = join(siteDir, 'assets');
await mkdir(assetsDir, { recursive: true });

const seen = new Set();
const articles = [];
for (const entry of source) {
  if (!/^[a-z0-9-]+$/.test(entry.id) || seen.has(entry.id)) {
    throw new Error(`ID articolo non valido o duplicato: ${entry.id}`);
  }
  seen.add(entry.id);
  for (const mode of ['beginner', 'pro']) {
    if (!entry[mode]?.intro || !entry[mode]?.sections?.length) {
      throw new Error(`Manca il testo ${mode} per ${entry.id}`);
    }
  }

  const summary = JSON.parse(await readFile(resolve(siteDir, entry.summary), 'utf8'));
  const allCandles = JSON.parse(await readFile(resolve(siteDir, entry.candles), 'utf8'));
  const latest = allCandles.at(-1);
  if (!latest || latest.time !== summary.meta.asOf || Math.abs(latest.close - summary.price.last) > 0.01) {
    throw new Error(`Candele e riepilogo non corrispondono per ${entry.id}`);
  }
  const candles = allCandles.slice(-entry.chartBars).map(({ time, close }) => [time, close]);
  if (candles.length < 2 || !summary.meta?.asOfIso || !summary.structure?.supports?.length || !summary.structure?.resistances?.length) {
    throw new Error(`Dati insufficienti per ${entry.id}`);
  }

  const chartFile = `${entry.id}-chart.html`;
  const chartSource = resolve(siteDir, entry.chart);
  const chartTarget = join(assetsDir, chartFile);
  if (chartSource !== chartTarget) await copyFile(chartSource, chartTarget);
  let cycleChart = null;
  if (entry.cycleChart) {
    cycleChart = `${entry.id}-cycle.html`;
    const cycleSource = resolve(siteDir, entry.cycleChart);
    const cycleTarget = join(assetsDir, cycleChart);
    if (cycleSource !== cycleTarget) await copyFile(cycleSource, cycleTarget);
  }

  const sources = Object.values(summary.meta.sources)
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex(other => other.name === item.name) === index)
    .map(({ name, attribution, terms }) => ({ name, attribution, terms }));

  articles.push({
    id: entry.id,
    title: entry.title,
    label: entry.label,
    pair: summary.meta.pair,
    timeframe: summary.meta.timeframe,
    asOf: summary.meta.asOfIso,
    generatedAt: summary.meta.generatedAt,
    lastBarClosed: summary.meta.lastBarClosed,
    price: summary.price.last,
    changePct: summary.price.changePct,
    trend: {
      ema20: summary.trend.ema20,
      ema50: summary.trend.ema50,
      ema200: summary.trend.ema200,
      adx: summary.trend.adx
    },
    momentum: {
      rsi: summary.momentum.rsi,
      macdHist: summary.momentum.macdHist,
      macdHistSlope: summary.momentum.macdHistSlope
    },
    volumeVsSma20: summary.volume.vsSma20,
    support: summary.structure.supports[0].price,
    resistance: summary.structure.resistances[0].price,
    overall: summary.overall,
    sentiment: summary.sentiment,
    sources,
    chart: `assets/${chartFile}`,
    cycleChart: cycleChart ? `assets/${cycleChart}` : null,
    candles,
    beginner: entry.beginner,
    pro: entry.pro
  });
}

const dataFile = join(siteDir, 'data.js');
const temporaryFile = `${dataFile}.tmp`;
await writeFile(temporaryFile, `window.ONLYSATS_ARTICLES = ${JSON.stringify(articles)};\n`);
await rename(temporaryFile, dataFile);
console.log(`Pubblicate ${articles.length} analisi in onlysats-analysis/data.js`);
