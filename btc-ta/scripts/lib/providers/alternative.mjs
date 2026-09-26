// alternative.me Crypto Fear & Greed Index API. Keyless.
// Terms: commercial use allowed with attribution shown right next to the data.
import { getJSON } from '../http.mjs';

export const sentiment = {
  id: 'alternative',
  name: 'alternative.me Fear & Greed Index',
  attribution: 'alternative.me',
  terms: 'https://alternative.me/crypto/fear-and-greed-index/',
  async fetchSentiment() {
    const j = await getJSON('https://api.alternative.me/fng/?limit=30');
    const d = j.data.map(r => ({ time: +r.timestamp, value: +r.value, label: r.value_classification }));
    return { now: d[0], weekAgo: d[7] ?? null, monthAgo: d[29] ?? null, series: d.reverse() };
  },
};
