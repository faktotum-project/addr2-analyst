# Template del report

Tieni il report in 400–700 parole. Usa titoli brevi, tabelle solo dove aiutano e sempre numeri precisi presi da `summary.json`. Non usare frasi riempitive come "il mercato è incerto" senza spiegare perché.

---

## BTC/USDT · {TF} — {asOfIso}{" (barra in corso)" se lastBarClosed=false}

**Prezzo:** ${last} ({changePct}% ultima barra, {change20BarsPct}% su 20 barre)
**Bias complessivo:** {overall.bias} ({overall.score}/100). Aggiungi una frase che spieghi il perché, citando i 2–3 fattori decisivi.

### Quadro sintetico
| Blocco | Bias | Motivi chiave |
|---|---|---|
| Trend | … | EMA, ADX … |
| Momentum | … | RSI, MACD … |
| Volumi | … | OBV, VWAP, POC |
| Derivati | … | funding, OI |
| Sentiment | … | F&G |
| Ciclo | … | Mayer, 200W MA, power law |

### Trend e struttura
Scrivi 3–5 frasi su allineamento delle EMA, regime ADX, struttura HH/HL o LH/LL con gli ultimi swing, trendline (attiva o rotta) ed eventuali golden/death cross recenti.

### Momentum
Descrivi RSI (zona e range shift), MACD (regime e pendenza dell'istogramma), incrocio dello Stoch RSI e divergenze attive con `barsAgo`.

### Volatilità e volumi
Descrivi ATR%, Bollinger (%B, squeeze sì o no), OBV rispetto al prezzo e VWAP ancorato. Per il volume profile riporta entrambi i profili (swing e recente): POC, VAH, VAL e `position`, e segnala se i due POC coincidono.

### Livelli chiave
| Livello | Prezzo | Distanza | Confluenze |
|---|---|---|---|
| R2 | … | +x% | … |
| R1 | … | +x% | Fib 0.382 + EMA50 … |
| **Prezzo** | … | — | |
| S1 | … | −x% | POC + Fib 0.5 … |
| S2 | … | −x% | … |

Evidenzia le confluenze, cioè i livelli entro circa 0,5 ATR da un altro livello calcolato.

### Derivati e sentiment
Scrivi 2–3 frasi: funding (valore attuale e media 7 giorni), combinazione tra variazione dell'OI e prezzo, Fear & Greed attuale rispetto a 7 e 30 giorni fa, con accanto "fonte: alternative.me".

### Contesto di ciclo
Scrivi 2–3 frasi su Mayer multiple, rapporto prezzo/200W MA, banda power law, Pi Cycle ratio e giorni dall'halving. Specifica che si tratta di contesto e non di timing.

### Scenari
**Rialzista**: trigger (per esempio chiusura {TF} sopra R1 con volume > media), obiettivi (R2 ed estensione Fib), invalidazione.
**Ribassista**: trigger (per esempio chiusura sotto S1), obiettivi (S2, VAL, Fib 0.618), invalidazione.
**Scenario favorito**: indica quale e perché, sulla base delle confluenze. Se i segnali sono misti, dillo chiaramente e indica cosa guardare.

### Cosa monitorare
Elenca 3 punti concreti, per esempio "chiusura giornaliera sopra 87.400", "funding sopra 0,03%" o "RSI che perde 50".

**Grafici:** `chart.html` (interattivo) · `chart.png` · `cycle.html`

*Analisi generata automaticamente a scopo informativo, non è consulenza finanziaria.*
