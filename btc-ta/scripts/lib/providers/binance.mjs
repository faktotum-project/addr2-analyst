// Binance public APIs: spot klines (candles) and USDⓈ-M futures (funding, open interest). Keyless.
import { getJSON } from '../http.mjs';

const INTERVAL = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w', '1mo': '1M' };
// Spot market-data host; BTC_TA_BINANCE_SPOT_URL=https://data-api.binance.vision serves the same klines where api.binance.com is geo-blocked.
const SPOT_URL = (process.env.BTC_TA_BINANCE_SPOT_URL || 'https://api.binance.com').replace(/\/$/, '');
const toCandle = k => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5], quoteVolume: +k[7] });

export const candles = {
  id: 'binance',
  name: 'Binance spot',
  pair: 'BTC/USDT',
  attribution: 'Binance',
  terms: 'https://www.binance.com/en/terms',
  // Binance returns max 1000 bars per call; page backwards with endTime.
  async fetchCandles(tf, bars) {
    const out = [];
    let endTime;
    while (out.length < bars) {
      const limit = Math.min(1000, bars - out.length);
      const url = `${SPOT_URL}/api/v3/klines?symbol=BTCUSDT&interval=${INTERVAL[tf]}&limit=${limit}` + (endTime ? `&endTime=${endTime}` : '');
      const rows = await getJSON(url);
      if (!rows.length) break;
      out.unshift(...rows.map(toCandle));
      endTime = rows[0][0] - 1;
      if (rows.length < limit) break;
    }
    return out;
  },
};

export const derivatives = {
  id: 'binance',
  name: 'Binance USDⓈ-M futures',
  attribution: 'Binance',
  terms: 'https://www.binance.com/en/terms',
  async fetchDerivatives() {
    const [premium, oi, oiHist, funding] = await Promise.all([
      getJSON('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
      getJSON('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
      getJSON('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=30'),
      getJSON('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=90'),
    ]);
    const markPrice = +premium.markPrice;
    const oiBtc = +oi.openInterest;
    const oiSeries = oiHist.map(r => ({ time: Math.floor(r.timestamp / 1000), btc: +r.sumOpenInterest, usd: +r.sumOpenInterestValue }));
    const fundingSeries = funding.map(r => ({ time: Math.floor(r.fundingTime / 1000), rate: +r.fundingRate }));
    const last7d = fundingSeries.slice(-21); // 3 fundings per day
    return {
      markPrice,
      indexPrice: +premium.indexPrice,
      basisPct: (markPrice / +premium.indexPrice - 1) * 100,
      fundingRate: +premium.lastFundingRate,
      fundingAnnualizedPct: +premium.lastFundingRate * 3 * 365 * 100,
      funding7dAvg: last7d.reduce((a, r) => a + r.rate, 0) / (last7d.length || 1),
      openInterestBtc: oiBtc,
      openInterestUsd: oiBtc * markPrice,
      oiChange7dPct: oiSeries.length >= 8 ? (oiSeries.at(-1).btc / oiSeries.at(-8).btc - 1) * 100 : null,
      oiChange30dPct: oiSeries.length >= 2 ? (oiSeries.at(-1).btc / oiSeries[0].btc - 1) * 100 : null,
      fundingSeries,
      oiSeries,
    };
  },
};
