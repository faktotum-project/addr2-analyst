// Open on-chain BTC/USD OHLCV (onchain-ohlcv, CC BY 4.0): candles built from DEX swaps on public blockchains.
// Location of the dataset (a folder or a base URL containing btc-usd-1h.csv and btc-usd-1d.csv):
//   BTC_TA_ONCHAIN_DATA=/path/to/onchain-ohlcv/data/ohlcv   or   BTC_TA_ONCHAIN_DATA=https://…/data/ohlcv
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_LOCATION = ''; // set to the public dataset URL once published
const ATTRIBUTION = 'Open on-chain BTC/USD OHLCV (onchain-ohlcv), CC BY 4.0';

function location() {
  const loc = process.env.BTC_TA_ONCHAIN_DATA || DEFAULT_LOCATION;
  if (!loc) throw new Error('dataset on-chain non configurato: imposta BTC_TA_ONCHAIN_DATA (cartella o URL con btc-usd-1h.csv)');
  return loc;
}

async function load(file) {
  const loc = location();
  const text = /^https?:\/\//.test(loc)
    ? await (async () => { const r = await fetch(`${loc.replace(/\/$/, '')}/${file}`, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`HTTP ${r.status} ${file}`); return r.text(); })()
    : await readFile(join(loc, file), 'utf8');
  return text.trim().split('\n').slice(1).map(l => {
    const [t, o, h, lo, c, v] = l.split(',');
    return { time: Date.parse(t) / 1000, open: +o, high: +h, low: +lo, close: +c, volume: +v / +c, quoteVolume: +v };
  });
}

// Aggregate consecutive bars into buckets of `sec` seconds (UTC-aligned; weeks start on Monday like exchanges).
function resample(bars, sec, offset = 0) {
  const out = [];
  for (const b of bars) {
    const t = Math.floor((b.time - offset) / sec) * sec + offset, x = out.at(-1);
    if (!x || x.time !== t) out.push({ ...b, time: t });
    else { x.high = Math.max(x.high, b.high); x.low = Math.min(x.low, b.low); x.close = b.close; x.volume += b.volume; x.quoteVolume += b.quoteVolume; }
  }
  return out;
}

const MONDAY_OFFSET = 4 * 86400; // 1970-01-01 was a Thursday

export const candles = {
  id: 'onchain',
  name: 'On-chain DEX (onchain-ohlcv)',
  pair: 'BTC/USD',
  attribution: ATTRIBUTION,
  terms: 'https://creativecommons.org/licenses/by/4.0/',
  async fetchCandles(tf, bars) {
    let series;
    if (tf === '1h') series = await load('btc-usd-1h.csv');
    else if (tf === '4h') series = resample(await load('btc-usd-1h.csv'), 4 * 3600);
    else if (tf === '1d') series = await load('btc-usd-1d.csv');
    else if (tf === '1w') series = resample(await load('btc-usd-1d.csv'), 7 * 86400, MONDAY_OFFSET);
    else throw new Error(`timeframe ${tf} non disponibile nel dataset on-chain (disponibili: 1h, 4h, 1d, 1w)`);
    return series.slice(-bars);
  },
};

export const history = {
  id: 'onchain',
  name: 'On-chain DEX daily (onchain-ohlcv)',
  attribution: ATTRIBUTION,
  terms: 'https://creativecommons.org/licenses/by/4.0/',
  fetchDaily: () => load('btc-usd-1d.csv'),
};
