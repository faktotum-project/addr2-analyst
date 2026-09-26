// Provider registry. Each data role can be switched independently with a CLI flag or env var:
//   --candles     / BTC_TA_CANDLES      OHLCV for the analysed timeframe (required)
//   --history     / BTC_TA_HISTORY      long daily history for cycle metrics ("candles" = reuse the candle provider)
//   --derivatives / BTC_TA_DERIVATIVES  funding / open interest ("none" to disable)
//   --sentiment   / BTC_TA_SENTIMENT    Fear & Greed ("none" to disable)
// To add a source, create a module next to this one that exports objects with the contract in
// references/data-providers.md and register them below.
import * as binance from './binance.mjs';
import * as bitstamp from './bitstamp.mjs';
import * as alternative from './alternative.mjs';
import * as onchain from './onchain.mjs';

const byId = list => Object.fromEntries(list.map(p => [p.id, p]));

export const REGISTRY = {
  candles: byId([binance.candles, onchain.candles]),
  history: byId([bitstamp.history, onchain.history]),
  derivatives: byId([binance.derivatives]),
  sentiment: byId([alternative.sentiment]),
};

export const DEFAULTS = { candles: 'binance', history: 'bitstamp', derivatives: 'binance', sentiment: 'alternative' };

// Daily history built from the candle provider itself (shorter, but no extra data source).
function historyFromCandles(p) {
  return {
    id: 'candles',
    name: `${p.name} daily`,
    attribution: p.attribution,
    terms: p.terms,
    fetchDaily: () => p.fetchCandles('1d', 6000),
  };
}

export function resolveSources(choice = {}) {
  const pick = role => (choice[role] ?? process.env[`BTC_TA_${role.toUpperCase()}`] ?? DEFAULTS[role]).toLowerCase();
  const get = role => {
    const id = pick(role);
    if (id === 'none' && role !== 'candles') return null;
    const p = REGISTRY[role][id];
    if (!p) throw new Error(`Fonte "${id}" non disponibile per ${role}. Disponibili: ${[...Object.keys(REGISTRY[role]), ...(role === 'candles' ? [] : ['none']), ...(role === 'history' ? ['candles'] : [])].join(', ')}`);
    return p;
  };
  const candles = get('candles');
  const history = pick('history') === 'candles' ? historyFromCandles(candles) : get('history');
  return { candles, history, derivatives: get('derivatives'), sentiment: get('sentiment') };
}

export function listSources() {
  return Object.fromEntries(Object.entries(REGISTRY).map(([role, ps]) => [role, {
    default: DEFAULTS[role],
    available: [...Object.values(ps).map(p => ({ id: p.id, name: p.name, terms: p.terms })),
      ...(role === 'history' ? [{ id: 'candles', name: 'storico giornaliero dal provider delle candele' }] : []),
      ...(role !== 'candles' ? [{ id: 'none', name: 'disattivato' }] : [])],
  }]));
}
