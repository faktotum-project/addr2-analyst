# Componenti e dati di terze parti

## Software incluso

### TradingView Lightweight Charts™ 5.2.1
- File: `assets/lightweight-charts-5.2.1.js` (build standalone, non modificata)
- Copyright 2023 TradingView, Inc.
- Licenza: Apache License 2.0. Testo completo in `licenses/lightweight-charts-LICENSE.txt`.
- Attribuzione: i grafici mostrano il logo TradingView (opzione `attributionLogo`, attiva di default), come richiesto dalla libreria. Non disattivarlo.
- Sito: https://www.tradingview.com/lightweight-charts/

## Dati di mercato (non inclusi, scaricati a runtime dal computer dell'utente)

| Fonte | Uso nella skill | Condizioni note |
|---|---|---|
| Binance (API pubbliche spot e futures) | Candele BTCUSDT, funding, open interest | Le condizioni d'uso di Binance vietano senza consenso scritto i servizi che "charge for or otherwise profit from market data obtained from Binance". Serve una verifica prima della vendita. |
| Bitstamp (API pubblica OHLC) | Storico giornaliero BTC/USD dal 2012 per le metriche di ciclo | L'uso commerciale dei dati richiede un Data License Agreement (partners@bitstamp.net). |
| Open on-chain BTC/USD OHLCV (`onchain-ohlcv`) | Candele e storico con `--candles onchain` / `--history onchain` | Dati CC BY 4.0, derivati da transazioni pubbliche su Ethereum e Base. Attribuzione mostrata nei grafici. |
| alternative.me (Fear & Greed Index API) | Indice Fear & Greed | Uso commerciale consentito con attribuzione "right next to the display of the data". La skill la mostra accanto al valore. |

Chi usa la skill è responsabile del rispetto delle condizioni d'uso delle fonti dati.
