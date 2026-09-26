# Validazione composito on-chain BTC/USD

Periodo: 2026-06-26T16:00 → 2026-09-24T16:00 UTC · 2161 ore, 91 giorni.
Riferimenti usati solo per il confronto: Coinbase BTC-USD, Binance BTCUSDT.

## vs Coinbase BTC-USD

| Metrica | 1h | 1d |
|---|---|---|
| Barre confrontate | 2161 (copertura 100.0%) | 91 (copertura 100.0%) |
| Scarto close: mediana / p95 / p99 / max (%) | 0.036 / 0.231 / 0.358 / 0.539 | 0.033 / 0.187 / 0.539 / 0.539 |
| Scarto close medio con segno (%) | 0.011 | 0.012 |
| Scarto high: mediana / p95 (%) | 0.038 / 0.186 | 0.050 / 0.269 |
| Scarto low: mediana / p95 (%) | 0.064 / 0.217 | 0.079 / 0.395 |
| Ampiezza barra on-chain / riferimento (mediana) | 0.93 | 0.97 |
| Correlazione rendimenti | 0.9455 | 0.9981 |
| Correlazione volumi (log) | 0.754 | 0.858 |

**Indicatori su 1h calcolati con il codice della skill:**

| Indicatore | Nostro (ultimo) | Riferimento (ultimo) | Scarto mediano | Scarto p95 | Note |
|---|---|---|---|---|---|
| rsi | 53.51 | 52.13 | 0.779 punti | 4.347 punti | zona (>70/<30/neutra) coincide nel 97.8% delle ore |
| ema20 | 84117.13 | 84147.77 | 0.021 % | 0.060 % |  |
| ema50 | 84508.54 | 84535.90 | 0.019 % | 0.050 % |  |
| ema200 | 82444.12 | 82461.24 | 0.017 % | 0.046 % |  |
| macdHist | 130.30 | 122.06 | 2.768 punti | 14.200 punti | segno coincide nel 97.8% delle ore |
| atr | 642.37 | 676.64 | 7.586 % | 30.312 % |  |
| bbUpper | 84948.18 | 84819.13 | 0.031 % | 0.106 % |  |

## vs Binance BTCUSDT

| Metrica | 1h | 1d |
|---|---|---|
| Barre confrontate | 2161 (copertura 100.0%) | 91 (copertura 100.0%) |
| Scarto close: mediana / p95 / p99 / max (%) | 0.069 / 0.256 / 0.398 / 0.584 | 0.056 / 0.247 / 0.548 / 0.548 |
| Scarto close medio con segno (%) | -0.064 | -0.053 |
| Scarto high: mediana / p95 (%) | 0.088 / 0.181 | 0.107 / 0.242 |
| Scarto low: mediana / p95 (%) | 0.051 / 0.295 | 0.052 / 0.595 |
| Ampiezza barra on-chain / riferimento (mediana) | 0.95 | 0.98 |
| Correlazione rendimenti | 0.9458 | 0.9980 |
| Correlazione volumi (log) | 0.750 | 0.818 |

**Indicatori su 1h calcolati con il codice della skill:**

| Indicatore | Nostro (ultimo) | Riferimento (ultimo) | Scarto mediano | Scarto p95 | Note |
|---|---|---|---|---|---|
| rsi | 53.51 | 52.31 | 0.774 punti | 4.358 punti | zona (>70/<30/neutra) coincide nel 97.8% delle ore |
| ema20 | 84117.13 | 84167.21 | 0.068 % | 0.138 % |  |
| ema50 | 84508.54 | 84551.05 | 0.070 % | 0.122 % |  |
| ema200 | 82444.12 | 82483.82 | 0.071 % | 0.099 % |  |
| macdHist | 130.30 | 122.83 | 2.937 punti | 14.109 punti | segno coincide nel 97.6% delle ore |
| atr | 642.37 | 651.42 | 7.470 % | 34.993 % |  |
| bbUpper | 84948.18 | 84836.04 | 0.064 % | 0.159 % |  |

## Controlli interni

- Spread WBTC vs cbBTC (pool on-chain): mediana -3.2 bps, p95 20.1 bps, max 70.6 bps.
- USDT/USD stimato on-chain: min 0.99634, mediana 1.00051, max 1.00272.
- Ore senza scambi: 0; ore con meno di 10 minuti con scambi: 2.

## Analisi completa della skill btc-ta sul 4h (24/09/2026 16:00 UTC): on-chain vs Binance

Stessa configurazione (500 barre, derivati e ciclo disattivati); cambia solo la fonte delle candele.

| Valore | On-chain | Binance | Scarto |
|---|---|---|---|
| Prezzo | 84.572 | 84.482 | +0,11% |
| EMA 20 / 50 / 200 | 84.336 / 82.524 / 78.029 | 84.353 / 82.556 / 78.072 | −0,02% / −0,04% / −0,06% |
| RSI · MACD hist · Stoch K | 54,4 · −389 · 13,6 | 53,7 · −394 · 13,7 | ≤ 1,3% |
| ADX · ATR | 31,3 · 1.056 | 31,7 · 1.070 | −1,3% |
| Bollinger sup / inf | 87.341 / 83.343 | 87.359 / 83.353 | ≤ 0,02% |
| Fibonacci (swing e livelli) | 74.959 → 87.372 | 74.968 → 87.396 | ≤ 0,03% |
| R1 | 87.305 | 87.337 | −0,04% |
| S1 / S2 / S3 | 80.146 / 76.725 / 74.992 | 81.751 / 79.695 / 76.342 | −2,0% / −3,7% / −1,8% |
| VWAP ancorato | 80.433 | 81.907 | −1,8% |
| POC swing / recente | 76.147 / 78.260 | 86.180 / 77.264 | −11,6% / +1,3% |
| Bias per blocco | trend ↑, momentum =, volumi ↑ | uguale | identici |
| Punteggio complessivo | +48 | +34 | |
| Divergenza RSI (11/09 12:00) | rialzista | ribassista | **opposta** |
| Pattern di candele (ultimi 20) | 6 | 6 | 3 in comune |

Lettura:
- **Indicatori di prezzo** (medie, oscillatori, bande, Fibonacci): coincidono entro l'1–2%.
- **Indicatori basati sul volume** (VWAP, POC): divergono. Il volume on-chain descrive dove si scambia sulle DEX, non su tutto il mercato.
- **Rilevatori di struttura** (cluster S/R, divergenze, pattern): uno scarto di prezzo dello 0,1% basta a cambiarne l'esito. È una fragilità degli algoritmi della skill, indipendente dalla fonte, da correggere.
