# Fonti dati sostituibili

La skill separa i dati in quattro ruoli. Per ognuno si può scegliere la fonte in modo indipendente:

| Ruolo | Flag / variabile d'ambiente | Predefinito | Obbligatorio |
|---|---|---|---|
| Candele del timeframe analizzato | `--candles` / `BTC_TA_CANDLES` | `binance` | sì |
| Storico giornaliero lungo (metriche di ciclo) | `--history` / `BTC_TA_HISTORY` | `bitstamp` | no (`none`), oppure `candles` per riusare il provider delle candele |
| Derivati (funding, open interest) | `--derivatives` / `BTC_TA_DERIVATIVES` | `binance` | no (`none`) |
| Sentiment (Fear & Greed) | `--sentiment` / `BTC_TA_SENTIMENT` | `alternative` | no (`none`) |

Per vedere le fonti disponibili: `node scripts/analyze.mjs --list-sources`.

## Fonte aperta: `onchain`
`--candles onchain --history onchain` usa il dataset **Open on-chain BTC/USD OHLCV** (progetto `onchain-ohlcv`, dati CC BY 4.0), costruito dagli scambi delle DEX su Ethereum e Base.
- Imposta `BTC_TA_ONCHAIN_DATA` con la cartella o l'URL che contiene `btc-usd-1h.csv` e `btc-usd-1d.csv`.
- Timeframe: `1h`, `4h`, `1d`, `1w`. Il `15m` e il mensile non sono disponibili nel dataset attuale.
- Il volume è quello delle DEX indicizzate, non dell'intero mercato.
- Lo storico dipende da quanto è stato indicizzato: le metriche di ciclo richiedono almeno 1500 giorni.
- Attribuzione obbligatoria: la skill la riporta nei grafici e nel report tramite `meta.sources`.

Le fonti usate in ogni analisi finiscono in `summary.json` (`meta.sources`), nell'intestazione e nel piè di pagina dei grafici. Quando un ruolo è `none`, il blocco corrispondente sparisce dai punteggi e dal report.

## Aggiungere una fonte

1. Crea `scripts/lib/providers/<nome>.mjs` ed esporta uno o più oggetti tra `candles`, `history`, `derivatives`, `sentiment`, rispettando il contratto qui sotto.
2. Registrali in `scripts/lib/providers/index.mjs`, dentro `REGISTRY`.
3. Prova con `node scripts/analyze.mjs --candles <id>` e controlla il PNG.

Campi comuni a tutti i provider: `id` (minuscolo, univoco nel ruolo), `name` (mostrato nel grafico), `attribution` (il nome da citare accanto al dato), `terms` (URL delle condizioni d'uso).

### `candles`
- `pair`: stringa mostrata nel grafico, per esempio `"BTC/USD"`.
- `fetchCandles(tf, bars)`: restituisce una Promise con un array di barre in ordine cronologico crescente, `{ time, open, high, low, close, volume, quoteVolume? }`.
  - `time` è l'apertura della barra in secondi Unix (UTC).
  - `volume` è in BTC.
  - `quoteVolume` è in USD o USDT. Se manca, viene stimato come volume × prezzo tipico.
  - `tf` può essere `15m`, `1h`, `4h`, `1d`, `1w` o `1mo` (mensile). Il provider Binance lo mappa all'intervallo API `1M`.
- La fonte deve gestire da sola la paginazione per restituire fino a 3000 barre.

### `history`
- `fetchDaily()`: restituisce una Promise con barre giornaliere dal più lontano possibile (almeno 1500 giorni, altrimenti le metriche di ciclo vengono saltate), nello stesso formato di `candles`.

### `derivatives`
- `fetchDerivatives()`: restituisce una Promise con `{ markPrice, indexPrice, basisPct, fundingRate, fundingAnnualizedPct, funding7dAvg, openInterestBtc, openInterestUsd, oiChange7dPct, oiChange30dPct }`.
  - `fundingRate` è per periodo di 8 ore, in frazione (0.0001 = 0,01%).
  - I campi non disponibili valgono `null`.

### `sentiment`
- `fetchSentiment()`: restituisce una Promise con `{ now: { value, label }, weekAgo: { value } | null, monthAgo: { value } | null }`. `value` va da 0 a 100.

Gli errori vanno lanciati con un messaggio leggibile: la skill li riporta in `warnings` e prosegue senza quel blocco. Fa eccezione il ruolo `candles`, senza il quale l'analisi si ferma.
