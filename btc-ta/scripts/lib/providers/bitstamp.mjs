// Bitstamp public OHLC API: BTC/USD daily history from 2012, used for cycle metrics. Keyless.
import { getJSON } from '../http.mjs';

export const history = {
  id: 'bitstamp',
  name: 'Bitstamp BTC/USD daily',
  attribution: 'Bitstamp',
  terms: 'https://www.bitstamp.net/api/',
  async fetchDaily() {
    const out = [];
    let start = 1325376000; // 2012-01-01
    const now = Math.floor(Date.now() / 1000);
    while (start < now) {
      const j = await getJSON(`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1000&start=${start}`);
      const rows = j?.data?.ohlc ?? [];
      if (!rows.length) break;
      for (const r of rows) {
        const t = +r.timestamp;
        if (out.length && t <= out.at(-1).time) continue;
        out.push({ time: t, open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: +r.volume });
      }
      start = out.at(-1).time + 86400;
      if (rows.length < 1000) break;
    }
    return out;
  },
};
