# Guida all'interpretazione

Riferimento per leggere i campi di `summary.json`. Le soglie sono convenzioni diffuse, non leggi. Su BTC, in trend forte, gli oscillatori restano a lungo in zona estrema.

## Trend (`trend`)
- **EMA 20/50/200**: con l'allineamento 20 > 50 > 200 e il prezzo sopra le tre medie il trend rialzista è pulito; l'ordine inverso indica un trend ribassista. Se le medie sono intrecciate il mercato è in range.
- **EMA200 / SMA200**: sono lo spartiacque di lungo periodo sul TF in uso. Il primo ritest dal basso dopo una rottura spesso fa da resistenza (e viceversa).
- **Golden/Death cross (EMA50×EMA200)**: segnale lento e in ritardo. Conta di più come conferma di regime che come ingresso, e va letto insieme a `barsAgo`.
- **ADX**: sotto 20 il mercato è in range e i segnali di breakout sono poco affidabili, meglio lavorare mean-reversion sulle bande. Sopra 25 il trend è forte, i pullback sulle EMA sono comprabili/vendibili e non conviene andare contro trend con i soli oscillatori. Un ADX sopra 40 che gira in calo segnala un trend che si esaurisce.
- **+DI / −DI**: il DI dominante indica la direzione, l'ADX la forza.

## Momentum (`momentum`)
- **RSI 14**: 70/30 sono le soglie classiche. In bull market l'RSI tende a oscillare tra 40 e 80, in bear market tra 20 e 60 (range shift), e il 50 fa da pivot di regime.
- **Divergenze RSI** (`divergences`): nella divergenza *bullish* il prezzo fa un minimo più basso e l'RSI un minimo più alto; nella *bearish* il prezzo fa un massimo più alto e l'RSI un massimo più basso. Il segnale conta di più se è fresco (`barsAgo` basso), se nasce su un livello S/R e se arriva con conferma di prezzo (rottura dell'ultimo swing). Una divergenza contro un trend con ADX > 30 fallisce spesso.
- **MACD**: incroci linea/signal, posizione rispetto allo zero (regime) e pendenza dell'istogramma (`macdHistSlope`), che anticipa gli incroci.
- **Stoch RSI**: molto veloce e utile per il timing dentro il trend. K e D sopra 80 o sotto 20 da soli non bastano; conta l'incrocio K/D in uscita dalla zona estrema e nella direzione del trend superiore.

## Volatilità (`volatility`)
- **ATR / ATR%**: misura il rumore. Usalo per dimensionare stop e target (per esempio invalidazione a 1–1,5 ATR oltre il livello). Un ATR% in forte calo precede spesso espansioni.
- **Bollinger %B**: sopra 1 il prezzo chiude fuori dalla banda superiore. Nei trend forti può "camminare sulla banda" e non è un segnale di vendita automatico.
- **BB width percentile / `squeeze`**: sotto il 15° percentile c'è compressione e un movimento ampio in arrivo, ma la direzione non è indicata. Cerca la conferma nella rottura della struttura.

## Volumi (`volume`, `volumeProfile`)
- **OBV vs EMA20**: indica se il volume conferma il movimento. Prezzo in salita con OBV piatto o in calo è una salita debole.
- **VWAP ancorato** (ancorato all'inizio dello swing Fibonacci): è il prezzo medio pagato da chi è entrato dallo swing. Sopra il VWAP chi ha comprato è in profitto, e spesso fa da supporto dinamico.
- **Volume profile**: il POC è il prezzo con più scambi e agisce da magnete o pivot. VAH e VAL delimitano la value area (70% del volume). Un'accettazione fuori dalla value area porta spesso a un movimento verso l'area successiva; un rientro porta spesso a un ritorno verso il POC. Le zone a basso volume (LVN) vengono attraversate rapidamente.
  - Il volume è in **USDT**, non in BTC: così periodi con prezzi molto diversi restano confrontabili. Ogni fascia di prezzo è ampia circa ¼ di ATR (`binSizeUsd`).
  - `volumeProfile.anchored` parte dallo swing dominante, lo stesso punto d'ancoraggio di Fibonacci e VWAP, e dice dove si è scambiato di più durante il movimento in corso.
  - `volumeProfile.recent` usa una finestra fissa per timeframe (1mo = 24 mesi, 1w = 52 settimane, 1d = 180 giorni, 4h = 30 giorni, 1h = 7 giorni, 15m = 2 giorni) e descrive l'accettazione recente.
  - Se i due POC coincidono, la zona è un magnete forte. Se divergono, il valore si sta spostando nella direzione del POC recente.
  - `position` dice se il prezzo è sopra, sotto o dentro la value area. Il voto nel punteggio dei volumi usa il POC dello swing.
- **`vsSma20`**: un valore sopra 1,5 su una barra di rottura dà conferma, sotto 1 rende la rottura sospetta.

## Struttura (`structure`)
- **S/R** (`supports`, `resistances`): cluster di swing pivot entro 0,6 ATR. `touches` e `strength` (che pesa la recenza) ne indicano l'importanza. Un supporto rotto diventa resistenza (polarità).
- **Fibonacci**: calcolato sullo swing dominante delle ultime 150 barre. La zona 0,5–0,618 è quella di ritracciamento più rilevante; un ritracciamento oltre 0,786 mette in discussione lo swing. Le estensioni 1,272 e 1,618 servono come target.
- **Trendline**: `broken: true` indica che la linea è stata violata di oltre 0,3 ATR sull'ultima barra. Vale di più con 3 tocchi o più (verifica sul grafico).
- **Pattern di candele**: vanno considerati solo se si formano su un livello e in chiusura di barra. Engulfing e hammer/shooting star lontani da qualsiasi livello sono rumore.
- **`lastSwingHigh` / `lastSwingLow`**: servono a leggere la struttura HH/HL o LH/LL. Un trend rialzista si considera rotto in chiusura sotto l'ultimo HL.

## Derivati (`derivatives`)
- **Funding**: su Binance 0,01% ogni 8h è il valore base. Un funding persistente sopra 0,03% indica long affollati e rischio di long squeeze; un funding negativo mentre il prezzo tiene indica short affollati e potenziale short squeeze.
- **Open interest**: la lettura dipende dalla combinazione con il prezzo.
  - OI in salita e prezzo in salita: nuovo denaro, trend sano ma con leva in aumento.
  - OI in salita e prezzo in calo: short aggressivi o long intrappolati.
  - OI in calo e prezzo in salita: short covering, rialzo meno solido.
  - OI in calo e prezzo in calo: deleveraging, spesso vicino a un minimo locale.
- **Basis** (mark vs index): un premio elevato segnala euforia.

## Sentiment (`sentiment`)
- **Fear & Greed**: va letto in chiave contrarian solo agli estremi (sotto 20 o sopra 80). In un trend può restare in "greed" per settimane.

## Ciclo (`cycle`), solo contesto di lungo periodo
- **Mayer multiple** (prezzo / SMA200D): sotto 0,8 si è storicamente in zona di accumulo profondo; sopra 2,4 in zona di surriscaldamento. La media storica è intorno a 1,3–1,4.
- **Prezzo / 200W MA**: la 200W MA ha fatto da pavimento nei bear market passati. Un valore vicino a 1 indica un'area di valore di lungo periodo. Il colore del grafico mostra la crescita mensile della 200W MA: verso il rosso il mercato è surriscaldato.
- **Pi Cycle Top** (`ratio` = SMA111 / (2×SMA350)): un valore ≥ 1 ha coinciso con i top del 2013, del 2017 e dell'aprile 2021 (il top di novembre 2021 non è stato segnalato). Lontano da 1 il segnale non dice nulla.
- **Power law**: regressione log-log dal 2012, con bande ai quantili dei residui. È descrittiva e dipende dal campione, quindi va usata per dire "caro o economico rispetto alla storia" e non per indicare target di prezzo.
- **Halving**: storicamente i massimi di ciclo sono arrivati 12–18 mesi dopo l'halving. Il campione è di sole 4 osservazioni: trattalo come un'euristica debole.

## Trappole comuni
- **Barra non chiusa** (`lastBarClosed: false`): i segnali dell'ultima barra non sono confermati.
- **TF basso (15m/1h)**: il rumore è alto e le metriche di ciclo e sentiment sono poco rilevanti.
- **Livelli troppo vicini** (entro 0,5 ATR): trattali come un'unica zona.
- **Score**: è una media meccanica e non tiene conto del contesto. Due blocchi discordi non si "annullano" automaticamente.
