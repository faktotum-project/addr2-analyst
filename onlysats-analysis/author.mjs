// Editorial copy derived only from a btc-ta summary. No live price or forecast is inferred.
const integer = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const periods = {
  '1w': { adjective: 'settimanale', bar: 'settimanale', average: 'settimane', unit: 'singole settimane', label: 'settimanale', count: 208 },
  '1mo': { adjective: 'mensile', bar: 'mensile', average: 'mesi', unit: 'singoli mesi', label: 'mensile', count: 120 }
};

const amount = value => integer.format(value);
const percent = value => `${value >= 0 ? '+' : ''}${one.format(value)}%`;
const stance = bias => ({ bullish: 'prevalentemente positivi', bearish: 'prevalentemente negativi', neutral: 'misti' })[bias] || 'misti';
const biasName = bias => ({ bullish: 'rialzista', bearish: 'ribassista', neutral: 'neutro' })[bias] || 'neutro';
const direction = (price, level) => price >= level ? 'sopra' : 'sotto';
const two = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const times = value => `${one.format(value)} volte`;

// Long-horizon reading: why Bitcoin is watched as a store of value, using only report numbers.
function longTerm(s, period, quoteAmount) {
  const c = s.cycle;
  const multiple = s.price.last / s.price.rangeLow;
  const history = `Nelle ${s.meta.bars} barre ${period.bar === 'mensile' ? 'mensili' : 'settimanali'} del report, il prezzo è passato da un minimo di ${quoteAmount(s.price.rangeLow)} a ${quoteAmount(s.price.last)}: circa ${times(multiple)} il minimo della serie.`;
  const beginnerCycle = c ? ` La media delle ultime 200 settimane, una linea che riassume circa quattro anni di prezzi, è a ${quoteAmount(c.wma200)} ed è cresciuta del ${one.format(c.wma200GrowthMoMPct)}% nell'ultimo mese; il prezzo è ${two.format(c.priceTo200wMA)} volte quella media. L'ultimo halving, il dimezzamento dei nuovi bitcoin emessi, risale al ${c.halving.last}.` : '';
  const beginnerRisk = c
    ? `Il percorso non è stato lineare: oggi il prezzo è ancora ${one.format(Math.abs(c.drawdownFromAthPct))}% sotto la chiusura più alta di sempre (${quoteAmount(c.athClose)}).`
    : `Il percorso non è stato lineare: il massimo della serie è ${quoteAmount(s.price.rangeHigh)}, sopra il prezzo attuale.`;
  const proCycle = c
    ? ` 200WMA ${quoteAmount(c.wma200)} (+${one.format(c.wma200GrowthMoMPct)}% m/m), prezzo/200WMA ${two.format(c.priceTo200wMA)}; Mayer Multiple ${two.format(c.mayerMultiple)}. Power law: fair value ${quoteAmount(c.powerLaw.fairValue)}, residuo al ${one.format(c.powerLaw.residualPercentile)}° percentile (${c.powerLaw.band}). Halving ${c.halving.last}, ${c.halving.daysSince} giorni fa (${one.format(c.halving.cycleProgressPct)}% del ciclo stimato). Drawdown dall'ATH di chiusura (${quoteAmount(c.athClose)}): ${one.format(c.drawdownFromAthPct)}%.`
    : ` Massimo della serie ${quoteAmount(s.price.rangeHigh)}.`;
  return {
    beginner: {
      title: 'Bitcoin come riserva di valore',
      body: `Bitcoin ha un'offerta massima fissata dal protocollo e un'emissione di nuove monete che si dimezza circa ogni quattro anni: per questo molti lo usano come riserva di valore, cioè per conservare risparmi su orizzonti lunghi. ${history}${beginnerCycle} ${beginnerRisk} Per questo il suo valore si giudica su anni, non su ${period.unit}: i dati passati non garantiscono i risultati futuri.`
    },
    pro: {
      title: 'Orizzonte lungo',
      body: `Serie di ${s.meta.bars} barre ${s.meta.timeframe}: minimo ${quoteAmount(s.price.rangeLow)}, prezzo attuale circa ${times(multiple)} quel minimo.${proCycle} Metriche descrittive di ciclo e di scarsità, non segnali di timing.`
    }
  };
}

export function makeArticle(summary, paths) {
  const s = summary;
  const tf = s.meta.timeframe;
  const period = periods[tf];
  if (!period || !s.meta.lastBarClosed || !Number.isFinite(s.price.last)) {
    throw new Error('Per la pubblicazione automatica serve un report supportato con barra chiusa.');
  }
  const support = s.structure.supports?.[0]?.price;
  const resistance = s.structure.resistances?.[0]?.price;
  if (!Number.isFinite(support) || !Number.isFinite(resistance) || support >= s.price.last || resistance <= s.price.last) {
    throw new Error('Supporto o resistenza principale non valido nel report.');
  }
  if (!Number.isFinite(s.trend.ema20) || !Number.isFinite(s.momentum.rsi) || !Number.isFinite(s.momentum.macdHist)) {
    throw new Error('Indicatori principali non disponibili nel report.');
  }
  const quote = s.meta.pair.endsWith('USDT') ? 'USDT' : 'USD';
  const quoteAmount = value => `${amount(value)} ${quote}`;
  const ema50 = Number.isFinite(s.trend.ema50) ? ` e ${direction(s.price.last, s.trend.ema50)} la media a 50 ${period.average}` : '';
  const ema200 = Number.isFinite(s.trend.ema200)
    ? ` La EMA200 è a ${quoteAmount(s.trend.ema200)}.`
    : ` La EMA200 ${period.adjective} non è disponibile: la serie storica ha meno di 200 barre.`;
  const rsiReading = s.momentum.rsi >= 70 ? 'in una zona di forza elevata' : s.momentum.rsi <= 30 ? 'in una zona di debolezza elevata' : 'in una zona intermedia';
  const macdReading = s.momentum.macdHist >= 0 ? 'positivo' : 'negativo';
  const volumeReading = Number.isFinite(s.volume.vsSma20)
    ? `Il volume è ${one.format(s.volume.vsSma20)} volte la media delle ultime 20 barre.`
    : 'Il confronto del volume con la media recente non è disponibile.';
  const snapshot = s.meta.asOfIso;
  const change = percent(s.price.changePct);
  const horizon = longTerm(s, period, quoteAmount);

  return {
    id: paths.id,
    title: `Bitcoin, lettura ${period.label}: segnali ${stance(s.overall.bias)}`,
    label: `Bitcoin · analisi ${period.adjective}`,
    summary: paths.summary,
    candles: paths.candles,
    chart: paths.chart,
    ...(paths.cycleChart ? { cycleChart: paths.cycleChart } : {}),
    chartBars: period.count,
    beginner: {
      intro: `Questa è la lettura ${period.adjective} della candela iniziata il ${snapshot}. Alla chiusura, Bitcoin valeva ${quoteAmount(s.price.last)} (${change} rispetto alla barra precedente). È una fotografia del passato, non un prezzo in tempo reale.`,
      sections: [
        {
          title: 'La direzione del prezzo',
          body: `Il prezzo è ${direction(s.price.last, s.trend.ema20)} la media delle ultime 20 ${period.average}${ema50}. Le medie aiutano a vedere la direzione generale: essere sopra una media non garantisce che il prezzo continui a salire.`
        },
        {
          title: 'La forza del movimento',
          body: `L'RSI è a ${one.format(s.momentum.rsi)}, ${rsiReading}. Il MACD, un indicatore del ritmo del movimento, è ${macdReading}; la sua spinta recente è ${s.momentum.macdHistSlope}. ${volumeReading} Nessuno di questi segnali prevede da solo la prossima candela.`
        },
        {
          title: 'Le zone da osservare',
          body: `Il supporto più vicino è ${quoteAmount(support)}: una zona dove in passato il prezzo ha trovato compratori. La resistenza è ${quoteAmount(resistance)}: un'area dove ha incontrato venditori. Se il prezzo supera o perde una zona, è utile attendere la chiusura della candela prima di interpretare il cambiamento.`
        },
        horizon.beginner
      ],
      glossary: [
        { term: 'Candela', meaning: `Riassume apertura, chiusura, massimo e minimo di una barra ${period.bar}.` },
        { term: 'Media mobile', meaning: 'Una linea che riassume i prezzi di un certo numero di barre. Descrive ciò che è già accaduto.' },
        { term: 'Supporto e resistenza', meaning: 'Zone ricavate dalle reazioni passate del prezzo. Possono essere attraversate.' },
        { term: 'Halving', meaning: 'Evento del protocollo che dimezza i nuovi bitcoin creati per ogni blocco. Rende l\'emissione sempre più scarsa.' },
        { term: 'Riserva di valore', meaning: 'Un bene usato per conservare ricchezza nel tempo. Per Bitcoin è una lettura di lungo periodo, con forti oscillazioni lungo il percorso.' }
      ]
    },
    pro: {
      intro: `BTC ${tf} a ${quoteAmount(s.price.last)} sulla barra chiusa del ${snapshot}; variazione ${change}. Bias aggregato ${biasName(s.overall.bias)} (${s.overall.score}/100): è un punteggio meccanico da leggere insieme ai singoli blocchi.`,
      sections: [
        {
          title: 'Trend e struttura',
          body: `Prezzo ${direction(s.price.last, s.trend.ema20)} EMA20 (${quoteAmount(s.trend.ema20)})${Number.isFinite(s.trend.ema50) ? ` e ${direction(s.price.last, s.trend.ema50)} EMA50 (${quoteAmount(s.trend.ema50)})` : ''}. ADX ${one.format(s.trend.adx)} con +DI ${one.format(s.trend.plusDI)} e −DI ${one.format(s.trend.minusDI)}.${ema200}`
        },
        {
          title: 'Momentum e partecipazione',
          body: `RSI ${one.format(s.momentum.rsi)}; istogramma MACD ${amount(s.momentum.macdHist)}, ${s.momentum.macdHistSlope}. ${volumeReading} ${s.volume.obvAboveEma ? 'OBV sopra EMA20.' : 'OBV sotto EMA20.'}${Number.isFinite(s.volume.anchoredVwap) ? ` VWAP ancorato a ${quoteAmount(s.volume.anchoredVwap)}.` : ''}`
        },
        {
          title: 'Livelli e condizioni',
          body: `Supporto ${quoteAmount(support)}; resistenza ${quoteAmount(resistance)}. Una chiusura sopra la resistenza rafforzerebbe la lettura rialzista, mentre una chiusura sotto il supporto la indebolirebbe. Le zone provengono da pivot storici e non costituiscono obiettivi garantiti.`
        },
        horizon.pro
      ]
    }
  };
}

export function miniSummary(summary, article) {
  const s = summary;
  const quote = s.meta.pair.endsWith('USDT') ? 'USDT' : 'USD';
  return `OnlySats Analysis · BTC ${periods[s.meta.timeframe].label}\nCandela chiusa ${s.meta.asOfIso}: ${amount(s.price.last)} ${quote} (${percent(s.price.changePct)}). Segnali ${stance(s.overall.bias)}; RSI ${one.format(s.momentum.rsi)}. Supporto ${amount(s.structure.supports[0].price)}, resistenza ${amount(s.structure.resistances[0].price)}.\nLettura completa: #${article.id}\nAnalisi informativa, non è consulenza finanziaria.`;
}
