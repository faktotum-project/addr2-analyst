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

## Pubblicazione e Telegram

La generazione del sito e la notifica sono due passi separati: il messaggio va inviato **dopo** che la nuova versione del sito è online. La scelta dell'hosting e l'attivazione della pianificazione sono ancora da configurare. Il canale Telegram non è collegato e nessun messaggio viene inviato dall'aggiornamento locale.

Quando il sito e il canale saranno pronti, configura `ONLYSATS_SITE_URL` con l'URL pubblico della cartella del blog, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` nell'ambiente di esecuzione. Dopo il deploy, controlla i messaggi con:

```bash
node onlysats-analysis/notify-telegram.mjs --dry-run
```

Poi il processo di pubblicazione può eseguire `node onlysats-analysis/notify-telegram.mjs`. Prima di inviare verifica via HTTPS che il `data.js` pubblico contenga il nuovo articolo. Il sender invia soltanto messaggi `pending` creati nelle ultime 48 ore, così il collegamento futuro del canale non riversa un archivio di messaggi vecchi. Per un invio specifico usa `--id <id>`. Salva l'ID restituito da Telegram. Se l'esito della richiesta è incerto, lascia il messaggio in stato `sending` per evitare un reinvio cieco: prima di riprovare va verificato il canale.

Le fonti CEX hanno condizioni di riutilizzo proprie, descritte in `btc-ta/THIRD_PARTY_NOTICES.md`. Verifica i permessi prima della pubblicazione commerciale. `onchain-ohlcv` è un prototipo che copre solo una parte del mercato.
