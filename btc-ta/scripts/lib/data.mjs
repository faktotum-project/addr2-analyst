// Data loading: resolves the configured providers (see providers/index.mjs), fetches in parallel and caches on disk.
// Optional sources never abort the analysis; failures end up in `warnings`.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveSources } from './providers/index.mjs';

const CACHE_TTL_MS = 10 * 60 * 1000;
const TF_MS = { '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5, '1w': 6048e5, '1mo': null };
export const TIMEFRAMES = Object.keys(TF_MS);

export function barEndMs(openTime, tf) {
  if (!TIMEFRAMES.includes(tf)) throw new Error(`Timeframe non supportato: ${tf}`);
  if (tf === '1mo') {
    const date = new Date(openTime * 1000);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  return openTime * 1000 + TF_MS[tf];
}

async function cached(cacheDir, key, fn) {
  const file = join(cacheDir, `${key}.json`);
  try {
    const s = await stat(file);
    if (Date.now() - s.mtimeMs < CACHE_TTL_MS) return JSON.parse(await readFile(file, 'utf8'));
  } catch {}
  const data = await fn();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}

async function optional(label, fn, warnings) {
  try { return await fn(); } catch (err) { warnings.push(`${label}: ${err.message}`); return null; }
}

const describe = p => p && { id: p.id, name: p.name, attribution: p.attribution, terms: p.terms };

export async function fetchAll({ tf, bars, cacheDir, sources: choice, needHistory = true }) {
  if (!TIMEFRAMES.includes(tf)) throw new Error(`Timeframe non supportato: ${tf} (usa ${TIMEFRAMES.join(', ')})`);
  const src = resolveSources(choice);
  const warnings = [];
  const [candles, longDaily, derivatives, fearGreed] = await Promise.all([
    cached(cacheDir, `candles_${src.candles.id}_${tf}_${bars}`, () => src.candles.fetchCandles(tf, bars)),
    needHistory && src.history ? optional(src.history.name, () => cached(cacheDir, `history_${src.history.id}`, () => src.history.fetchDaily()), warnings) : null,
    src.derivatives ? optional(src.derivatives.name, () => cached(cacheDir, `derivatives_${src.derivatives.id}`, () => src.derivatives.fetchDerivatives()), warnings) : null,
    src.sentiment ? optional(src.sentiment.name, () => cached(cacheDir, `sentiment_${src.sentiment.id}`, () => src.sentiment.fetchSentiment()), warnings) : null,
  ]);
  if (candles.length < 60) throw new Error(`Troppe poche barre ricevute (${candles.length})`);
  return {
    candles, longDaily, derivatives, fearGreed, warnings,
    sources: {
      candles: { ...describe(src.candles), pair: src.candles.pair },
      history: longDaily ? describe(src.history) : null,
      derivatives: derivatives ? describe(src.derivatives) : null,
      sentiment: fearGreed ? describe(src.sentiment) : null,
    },
  };
}
