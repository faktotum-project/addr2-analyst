# OnlySats Analysis: istruzioni per addr2

Quando aggiorni questo blog:

- Usa `node onlysats-analysis/update.mjs --run` per creare articoli da candele chiuse nei timeframe 1w e 1mo. Il blog copre solo il medio-lungo periodo: non aggiungere analisi 4h o 1d. Se uno dei report fallisce, fermati e rendi visibile l'errore; non pubblicare dati parziali.
- Se migliori i testi in `content/articles.json`, usa soltanto i numeri del relativo `content/reports/<id>/summary.json`. Conserva due letture realmente diverse: Principiante spiega termini e contesto, Pro indica indicatori, livelli e condizioni. Metti in evidenza i punti forti di Bitcoin (riserva di valore, scarsità, orizzonte pluriennale) senza nascondere volatilità e drawdown. Non presentare un punteggio come previsione.
- Ricostruisci il sito con `node onlysats-analysis/build.mjs` dopo modifiche ai testi. Verifica che `data.js` e i grafici corrispondano ai report.
- Pubblica con il servizio di hosting configurato. Esegui `notify-telegram.mjs` soltanto quando la nuova pagina pubblica è raggiungibile e il canale Telegram è configurato. Non inviare messaggi per bozze o deploy falliti.
- Non riprovare automaticamente un messaggio rimasto in stato `sending`: l'esito Telegram è incerto e un secondo invio può duplicarlo.
