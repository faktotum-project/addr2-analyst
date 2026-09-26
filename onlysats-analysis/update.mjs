#!/usr/bin/env node
// Import a completed btc-ta report, or run fresh analyses and publish new closed bars to the static blog.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeArticle, miniSummary } from './author.mjs';

const exec = promisify(execFile);
const siteDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(siteDir, '..');
const contentFile = join(siteDir, 'content/articles.json');
const { values: args } = parseArgs({ options: {
  import: { type: 'string' },
  run: { type: 'boolean', default: false },
  tf: { type: 'string', default: '1w,1mo' },
  'dry-run': { type: 'boolean', default: false }
} });
if (Boolean(args.import) === Boolean(args.run)) {
  throw new Error('Usa --import <cartella-report> oppure --run [--tf 1w,1mo].');
}

async function analyze(tf) {
  const command = join(projectDir, 'btc-ta/scripts/analyze.mjs');
  const { stdout } = await exec(process.execPath, [command, '--tf', tf, '--bars', '500', '--out', join(projectDir, 'btc-ta-output'), '--no-png', '--closed-only'], {
    cwd: projectDir, timeout: 180000, maxBuffer: 4 * 1024 * 1024
  });
  return JSON.parse(stdout).outDir;
}

const reportDirs = args.import
  ? [resolve(args.import)]
  : await (async () => {
      const timeframes = args.tf.split(',').map(value => value.trim()).filter(Boolean);
      if (!timeframes.length || timeframes.some(value => !['1w', '1mo'].includes(value))) {
        throw new Error('Timeframe automatici disponibili: 1w, 1mo (solo medio-lungo periodo).');
      }
      const dirs = [];
      for (const tf of timeframes) dirs.push(await analyze(tf));
      return dirs;
    })();

const existing = JSON.parse(await readFile(contentFile, 'utf8'));
const ids = new Set(existing.map(entry => entry.id));
const additions = [];
for (const reportDir of reportDirs) {
  const summary = JSON.parse(await readFile(join(reportDir, 'summary.json'), 'utf8'));
  if (summary.meta.warnings?.length) throw new Error(`Report con avvisi, pubblicazione fermata: ${summary.meta.warnings.join('; ')}`);
  const tf = summary.meta.timeframe;
  const id = `btc-${tf}-${summary.meta.asOfIso.slice(0, 10)}`;
  if (ids.has(id)) { console.log(`Già pubblicato: ${id}`); continue; }
  const paths = {
    id,
    summary: `content/reports/${id}/summary.json`,
    candles: `content/reports/${id}/candles.json`,
    chart: `assets/${id}-chart.html`,
    cycleChart: null
  };
  let cycle = false;
  try { await readFile(join(reportDir, 'cycle.html')); cycle = true; } catch {}
  if (cycle) paths.cycleChart = `assets/${id}-cycle.html`;
  const article = makeArticle(summary, paths);
  const candles = JSON.parse(await readFile(join(reportDir, 'candles.json'), 'utf8'));
  const last = candles.at(-1);
  if (!last || last.time !== summary.meta.asOf || Math.abs(last.close - summary.price.last) > .01) {
    throw new Error(`Candele e summary non corrispondono per ${id}`);
  }
  await readFile(join(reportDir, 'chart.html'));
  additions.push({ reportDir, summary, paths, article, id, cycle });
  ids.add(id);
}

if (args['dry-run']) {
  console.log(JSON.stringify({ newArticles: additions.map(item => ({ id: item.id, title: item.article.title, telegram: miniSummary(item.summary, item.article) })) }, null, 2));
  process.exit(0);
}
if (!additions.length) { console.log('Nessuna nuova candela chiusa da pubblicare.'); process.exit(0); }

for (const item of additions) {
  const reportTarget = join(siteDir, 'content/reports', item.id);
  await mkdir(reportTarget, { recursive: true });
  await copyFile(join(item.reportDir, 'summary.json'), join(reportTarget, 'summary.json'));
  await copyFile(join(item.reportDir, 'candles.json'), join(reportTarget, 'candles.json'));
  await copyFile(join(item.reportDir, 'chart.html'), join(siteDir, item.paths.chart));
  if (item.cycle) await copyFile(join(item.reportDir, 'cycle.html'), join(siteDir, item.paths.cycleChart));
}

const candidate = [...additions.map(item => item.article), ...existing];
const dated = await Promise.all(candidate.map(async entry => ({
  entry,
  asOf: JSON.parse(await readFile(resolve(siteDir, entry.summary), 'utf8')).meta.asOf
})));
dated.sort((a, b) => b.asOf - a.asOf);
const ordered = dated.map(item => item.entry);
const temporaryContent = join(siteDir, 'content/articles.pending.json');
await writeFile(temporaryContent, JSON.stringify(ordered, null, 2) + '\n');
await exec(process.execPath, [join(siteDir, 'build.mjs'), temporaryContent], { cwd: projectDir, timeout: 60000 });
await rename(temporaryContent, contentFile);

const outboxDir = join(siteDir, 'outbox');
await mkdir(outboxDir, { recursive: true });
for (const item of additions) {
  const outboxFile = join(outboxDir, `${item.id}.json`);
  await writeFile(outboxFile, JSON.stringify({
    id: item.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    text: miniSummary(item.summary, item.article)
  }, null, 2) + '\n');
}
console.log(`Sito aggiornato: ${additions.map(item => item.id).join(', ')}. Mini riassunti pronti in outbox/.`);
