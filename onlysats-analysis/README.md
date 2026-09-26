# OnlySats Analysis

Blog statico in italiano per le analisi BTC di addr2. `index.html` si apre anche come file locale. Ogni articolo offre grafico sintetico, grafico tecnico completo e lettura **Principiante** o **Pro**. Il blog è dedicato al medio-lungo periodo: sono pubblicati solo il settimanale (`1w`) e il mensile (`1mo`, visualizzato come `1M`). Ogni articolo include una sezione su Bitcoin come riserva di valore (scarsità, halving, media a 200 settimane, storico della serie), scritta con i soli numeri del report.

## Aggiornamento autonomo

`update.mjs` esegue `btc-ta` per `1w` e `1mo`, usando solo candele **chiuse**. Per ogni nuova candela crea i due testi italiani dai valori del `summary.json`, copia report e grafico nel blog, aggiorna `data.js` e prepara un mini riassunto in `outbox/`. Una seconda esecuzione con la stessa candela non crea duplicati.

```bash
node onlysats-analysis/update.mjs --run
```

Per controllare un report già generato, senza cambiare il sito:

```bash
node onlysats-analysis/update.mjs --import btc-ta-output/<cartella-report> --dry-run
```

Per importarlo davvero, togli `--dry-run`. Il report deve avere `summary.json`, `candles.json` e `chart.html`; `cycle.html` è facoltativo. Il processo si ferma se trova avvisi, dati incoerenti, livelli mancanti o una candela ancora aperta. I file degli articoli sono conservati in `content/reports/`, così il sito può essere ricostruito anche senza le cache locali di `btc-ta`:

```bash
node onlysats-analysis/build.mjs
```

`content/articles.json` contiene i testi. addr2 può rivederli e migliorarli usando il report come unica fonte per i numeri; dopo le modifiche, esegue di nuovo `build.mjs`.

## Aggiornamento pianificato

`.github/workflows/onlysats-update.yml` esegue `update.mjs` su GitHub Actions: ogni lunedì alle 00:20 UTC per `1w` e il giorno 1 alle 00:20 UTC per `1mo`. Se c'è una nuova candela chiusa, il workflow committa su `main` articoli, grafici, `data.js` e `outbox/`, quindi l'archivio si aggiorna da solo. Se un report fallisce, il job fallisce e non pubblica nulla. Dai runner GitHub `api.binance.com` non è raggiungibile, quindi il workflow usa `BTC_TA_BINANCE_SPOT_URL=https://data-api.binance.vision`, l'host pubblico di Binance per gli stessi dati di mercato. Si può avviare a mano da *Actions → OnlySats update → Run workflow*.

## Pubblicazione e Telegram

Il sito è pubblicato su Vercel (https://addr2-analyst.vercel.app, Root Directory `onlysats-analysis`) e si aggiorna a ogni push su `main`. Dopo il push, il workflow esegue `notify-telegram.mjs --wait 600`: attende fino a 10 minuti che il `data.js` pubblico contenga il nuovo articolo e solo allora invia il mini riassunto nel gruppo OnlySats, topic "Analisi tecnica" (`TELEGRAM_CHAT_ID=-1002388482188`, `TELEGRAM_THREAD_ID=2`). Il token del bot è il secret di repository `TELEGRAM_BOT_TOKEN`; senza secret l'invio viene saltato. Lo stato di ogni messaggio (`sent` con l'ID Telegram, oppure `sending`) viene committato in `outbox/`, anche se l'invio fallisce.

Il sender invia soltanto messaggi `pending` creati nelle ultime 48 ore, così non riversa un archivio di messaggi vecchi. Per un invio specifico usa `--id <id>`; per un'anteprima `--dry-run`. Se l'esito della richiesta è incerto, il messaggio resta in stato `sending` per evitare un reinvio cieco: prima di riprovare va verificato il gruppo.

Le fonti CEX hanno condizioni di riutilizzo proprie, descritte in `btc-ta/THIRD_PARTY_NOTICES.md`. Verifica i permessi prima della pubblicazione commerciale. `onchain-ohlcv` è un prototipo che copre solo una parte del mercato.
