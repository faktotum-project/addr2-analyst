# Richieste di permesso per l'uso commerciale dei dati

La skill `btc-ta` viene venduta come software che l'acquirente esegue sul proprio computer. Le chiamate alle API partono dalla macchina dell'acquirente e il venditore non ridistribuisce dati. Le condizioni di Binance e Bitstamp però coprono in modo ampio "servizi che traggono profitto" dai loro dati, quindi serve un consenso scritto prima di vendere.

Riferimenti verificati il 24/09/2026:
- **Binance:** le condizioni d'uso vietano, senza consenso scritto, "any other websites/apps/services that charge for or otherwise profit from market data obtained from Binance". Il contatto per le partnership sui dati non è indicato in modo univoco: usa il form partner o un ticket di supporto dal sito binance.com e chiedi di essere indirizzato al team Market Data / API.
- **Bitstamp:** per l'uso commerciale dei dati serve un "commercial use Data License Agreement" da chiedere a partners@bitstamp.net (fonte: bitstamp.net/api).
- **alternative.me:** l'uso commerciale è consentito con attribuzione accanto al dato, che la skill già mostra. Non serve una richiesta. Per conferma scritta, facoltativa: support@alternative.me.

Una volta che la risposta è arrivata, archiviala in questa cartella.

---

## Bozza: Bitstamp (partners@bitstamp.net)

**Subject:** Commercial Data License request — desktop technical-analysis tool (btc-ta)

Hello Bitstamp Partners team,

I'm [NAME], [COMPANY/ROLE] based in [COUNTRY]. I'm about to sell **btc-ta**, a software package ("skill") for AI coding agents that produces technical-analysis charts and reports for Bitcoin.

How it uses Bitstamp data:
- The buyer runs the software locally. Requests go from the buyer's own machine to your public endpoint `GET /api/v2/ohlc/btcusd/` (daily candles, about 6 requests per run, cached for 10 minutes).
- The data are used only to compute long-term indicators (200-week MA, Mayer multiple, power-law bands), shown in a chart on the buyer's screen with "Bitstamp" credited as the source.
- We do not store, resell or redistribute the raw data, and we do not operate any server that serves them.
- Expected volume: [NUMBER] buyers in the first year. Price of the software: [PRICE].

Could you tell me whether this use needs a Commercial Data License Agreement and, if so, send me the terms and pricing?

Thank you,
[NAME]
[EMAIL] · [WEBSITE]

---

## Bozza: Binance (form partner / ticket di supporto)

**Subject:** Written consent request — commercial desktop software using Binance public market data API

Hello Binance team,

I'm [NAME], [COMPANY/ROLE] based in [COUNTRY]. I'm going to sell **btc-ta**, a software package for AI coding agents that generates technical-analysis charts and reports for BTC/USDT. Your Terms of Use require written consent for services that profit from Binance market data, so I'm asking before launch.

How it uses Binance data:
- The software runs on the buyer's own computer and calls public, keyless endpoints directly from there:
  - `/api/v3/klines` for BTCUSDT (up to 3 requests per run);
  - `/fapi/v1/premiumIndex`, `/fapi/v1/openInterest`, `/futures/data/openInterestHist` and `/fapi/v1/fundingRate` (1 request each per run).
  - Results are cached for 10 minutes, well within your rate limits.
- Data are shown only to the buyer, in a local chart with "Binance" credited as the source. No trading, no order routing, no data feed, no storage or redistribution on our side.
- Expected volume: [NUMBER] buyers in the first year. Price: [PRICE].

Could you confirm whether you can grant written consent for this use, or point me to the right programme (for example a data licence or partner programme)?

Thank you,
[NAME]
[EMAIL] · [WEBSITE]
