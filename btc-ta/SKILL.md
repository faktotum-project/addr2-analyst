---
name: btc-ta
description: Analisi tecnica di Bitcoin (BTC) con dati di mercato reali e grafico annotato. Scarica le candele BTCUSDT da Binance, calcola EMA/SMA, RSI, Stoch RSI, MACD, ADX, Bollinger, ATR, OBV, VWAP ancorato, volume profile, supporti/resistenze, Fibonacci, trendline, divergenze RSI, pattern di candele, funding/open interest, Fear & Greed e metriche di ciclo (Mayer multiple, 200W MA, Pi Cycle, bande power-law). Produce un grafico HTML interattivo e un PNG con le analisi disegnate, poi un report scritto. Usare quando l'utente chiede analisi tecnica di Bitcoin/BTC, un grafico BTC con indicatori, livelli chiave, supporti e resistenze, "come vedi BTC", bias o scenari di prezzo su Bitcoin. Argomenti opzionali timeframe (15m, 1h, 4h, 1d, 1w, 1mo; predefinito 1d) e numero di barre.
license: Proprietario. Vedi LICENSE.txt; componenti di terze parti in THIRD_PARTY_NOTICES.md
metadata:
  version: "1.1.0"
---

# BTC Technical Analysis

Analisi tecnica di BTC basata su dati reali, con grafico annotato e report in italiano. Lo script calcola i numeri; tu li interpreti. Non inventare mai valori che non trovi nell'output.

Richiede Node.js 20 o successivo e accesso a internet; per generare PNG serve un browser Chromium, Chrome o Firefox. Funziona con coding agent che supportano Agent Skills e possono eseguire comandi shell.

## Argomenti

L'utente può invocare la skill con un comando (`/btc-ta 4h` negli agent che espongono le skill come comandi) oppure in linguaggio naturale ("analisi tecnica BTC sul settimanale"). Ricava questi due parametri:
- timeframe: `15m`, `1h`, `4h`, `1d` (predefinito), `1w`, `1mo` (mensile; `1M` accettato dallo script). Se l'utente parla di "breve periodo" usa 4h, per "lungo periodo" usa 1w o 1mo secondo il contesto.
- barre: 250–3000, predefinito 500. Per 1w bastano 400 barre. Sul mensile Binance ha meno di 200 barre storiche: EMA/SMA200 mensili possono essere assenti; non interpretarle come zero.
- Se l'utente chiede una lettura multi-timeframe, esegui lo script una volta per ogni timeframe (per esempio 1w, 1d, 4h) e passa `--no-cycle` dal secondo run in poi.

## Processo

1. **Esegui lo script.** `<SKILL_DIR>` è la cartella che contiene questo `SKILL.md`: usa il suo percorso assoluto. Lancia lo script dalla directory di lavoro dell'utente, così i risultati finiscono nel suo progetto:
   ```bash
   node "<SKILL_DIR>/scripts/analyze.mjs" --tf <tf> --bars <n>
   ```
   Se `node` manca o la versione è inferiore a 20, fermati e dillo all'utente, senza tentare installazioni.
   Opzioni: `--out <dir>` (predefinito `./btc-ta-output`), `--no-png`, `--no-cycle`, `--closed-only` per escludere l'ultima barra ancora in corso. Le fonti dati si cambiano con `--candles`, `--history`, `--derivatives`, `--sentiment` (vedi `references/data-providers.md`). Usale solo se l'utente lo chiede o se una fonte non risponde.
   Lo stdout è JSON con `outDir`, `files` (incluso `candles.json`), `headline` e `warnings`. Le cache HTTP durano 10 minuti in `<out>/cache/`.

2. **Leggi `summary.json`** (in `files.summary`). Contiene tutti i numeri da usare: prezzo, trend, momentum, volatilità, volumi, volume profile, struttura (S/R, Fibonacci, trendline, divergenze, pattern), derivati, sentiment, ciclo, punteggi per blocco (`scores`) con le motivazioni e il punteggio complessivo (`overall`).

3. **Guarda `chart.png`** (e `cycle.png` se c'è), se sei in grado di leggere immagini. Controlla che le annotazioni tornino con il prezzo, per esempio che i livelli S/R cadano davvero su zone di reazione e che la trendline non sia stata rotta molte volte. Se qualcosa sembra incoerente dillo nel report invece di nasconderlo. Se non puoi leggere immagini, salta questo passo e scrivi nel report che il grafico non è stato controllato visivamente.

4. **Scrivi il report** seguendo `references/report-template.md`. Per l'interpretazione di ogni indicatore, le soglie e le trappole comuni consulta `references/indicators.md`, soprattutto quando i blocchi sono discordanti.

5. **Consegna**: indica i percorsi di `chart.html` (interattivo, con layer attivabili, si apre in qualsiasi browser) e `chart.png`. Se il tuo ambiente permette di pubblicare o condividere pagine HTML, proponilo in una riga, ma non pubblicare nulla senza un sì esplicito dell'utente.

## Regole

- **Solo numeri dal summary.** Arrotonda come vuoi, ma non stimare valori mancanti e non cercare prezzi o notizie sul web: l'analisi si basa esclusivamente sull'output dello script. Se `warnings` segnala una fonte non disponibile, o se una fonte è disattivata (`meta.sources.<ruolo>` è `null`), dillo e salta quella sezione.
- **Dichiara sempre la data dei dati** (`meta.asOfIso`) e segnala se l'ultima barra è ancora aperta (`meta.lastBarClosed: false`): RSI, MACD e pattern dell'ultima barra possono cambiare prima della chiusura.
- **Scenari, non previsioni.** Presenta uno scenario rialzista e uno ribassista, ciascuno con trigger, obiettivi e livello di invalidazione presi dai livelli calcolati. Indica quale dei due è favorito dalle confluenze e perché.
- **Confluenza più importante del singolo segnale.** Un livello vale di più quando coincidono S/R, Fibonacci, EMA, POC/VAH/VAL o trendline, e il report deve farlo notare.
- **I punteggi sono un riassunto meccanico.** Usali come punto di partenza, ma se la tua lettura diverge (per esempio trend forte con divergenza ribassista fresca) spiegalo.
- **Il ciclo è contesto, non timing.** Mayer multiple, power law e Pi Cycle descrivono dove si trova il prezzo rispetto alla storia e non danno segnali d'ingresso.
- **Cita le fonti.** Accanto al valore del Fear & Greed scrivi "fonte: " seguito da `meta.sources.sentiment.attribution` (per alternative.me è una condizione d'uso dei dati). In fondo al report elenca i `name` di `meta.sources`.
- Chiudi sempre con: *"Analisi generata automaticamente a scopo informativo, non è consulenza finanziaria."*
- Scrivi in italiano, salvo richiesta diversa. Esprimi i prezzi in USD senza decimali.

## File

- `scripts/analyze.mjs`: entrypoint. Dipende solo da Node ≥ 20, senza pacchetti npm.
- `scripts/lib/data.mjs` e `scripts/lib/providers/`: fonti dati sostituibili. Predefinite: Binance spot e futures, Bitstamp per lo storico daily dal 2012, alternative.me per Fear & Greed. Contratto per aggiungerne altre in `references/data-providers.md`.
- `scripts/lib/indicators.mjs`, `structure.mjs`, `cycle.mjs`: calcoli.
- `scripts/lib/render.mjs`: HTML con TradingView Lightweight Charts 5.2.1, incluso inline da `assets/`.
- `scripts/screenshot.mjs`: conversione PNG con chrome-headless-shell di Playwright, Chrome/Chromium di sistema oppure Firefox. Per forzare un binario imposta `BTC_TA_CHROME`.
- `scripts/selftest.mjs`: test degli indicatori, da lanciare con `node scripts/selftest.mjs` dopo ogni modifica ai calcoli.
- `README.md`: installazione per i diversi agent. `LICENSE.txt` e `THIRD_PARTY_NOTICES.md`: licenze.
