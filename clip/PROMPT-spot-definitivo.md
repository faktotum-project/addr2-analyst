# Prompt: spot sponsorizzato btc-ta

Da incollare in un coding agent (Claude Code, Codex, Cursor, ecc.) aperto nella cartella `Analisi Tecnica Bitcoin/`. Prima di lanciarlo, compila i campi rimasti tra [PARENTESI QUADRE]: prezzo e URL.

---

## Obiettivo
Produci lo spot pubblicitario definitivo per vendere la skill `btc-ta`, un pacchetto che aggiunge a un coding agent l'analisi tecnica di Bitcoin con dati reali e un grafico annotato. Lo spot andrà in sponsorizzata su Instagram/Facebook (Reels e feed), TikTok, X e LinkedIn.

Pubblico: sviluppatori e trader retail che usano già un coding agent.
Messaggio unico: **"Un comando nel tuo coding agent → analisi tecnica BTC completa, con grafico reale annotato."**
Azione richiesta: acquistare su [URL] a [PREZZO].

## Materiale esistente (leggilo prima di iniziare)
- `clip/render_clip.py`, `clip/README.md`, `clip/storyboard.png`: la clip attuale da 15 s. Riusa palette, font (Inter, JetBrains Mono in `clip/fonts/`) e stile a card.
- `btc-ta/`: la skill. Genera i grafici con `node btc-ta/scripts/analyze.mjs --tf 1d` (output in `btc-ta-output/<data>_<tf>/`: `chart.html`, `chart.png`, `cycle.html`, `summary.json`).
- Problemi della clip attuale da risolvere:
  1. Nei primi 2 secondi non c'è un aggancio (titolo interrogativo e campo vuoto).
  2. Mostra una finta interfaccia web con il pulsante "Avvia analisi", ma il prodotto vive dentro un coding agent.
  3. Il grafico intero rimpicciolito a 470 px è illeggibile su telefono.
  4. Intorno ai 3 s la card del grafico appare nera o mezza vuota.
  5. Mancano voce e sottotitoli.
  6. L'audio è basso (media −32 dB).
  7. Bitrate 0,6 Mbps.
  8. Nessun prezzo, nessun link.

## Regola non negoziabile: tutto reale
Ogni schermata del prodotto deve essere una registrazione o un render di output veri della skill. Non usare video generati da AI e non ridisegnare a mano grafici, terminali o numeri. Se un'inquadratura non si può ottenere dal vero, fermati e chiedimelo.

## Materiale da catturare
1. **Terminale (registrazione reale).** Una sessione di Claude Code in cui si digita `/btc-ta 1d` e l'agent esegue lo script e scrive il report.
   - Tema scuro, font ≥ 22 px, finestra 1080×1350 o simile.
   - Usa uno strumento scriptabile (per esempio VHS di charmbracelet, oppure asciinema + agg) per la parte di digitazione. Per la risposta dell'agent usa una registrazione reale accelerata (2–4×), non ricostruita.
2. **Tour del grafico (registrazione reale).** Uno script Playwright apre `chart.html` in un viewport verticale 1080×1920 (deviceScaleFactor 2) e registra un video. Movimenti previsti:
   - zoom sulle ultime ~120 barre;
   - pan lento verso i livelli S/R e Fibonacci;
   - toggle dei layer (spegni tutto, poi riaccendi uno alla volta: EMA → S/R → Fib → trendline → divergenze → volume profile);
   - scroll sui pannelli RSI e MACD.

   Usa le API di Lightweight Charts dalla console (`chart.timeScale().setVisibleLogicalRange`) e i checkbox `[data-layer]`.
3. **Grafico di ciclo.** Una breve registrazione di `cycle.html`: zoom dal 2012 a oggi in scala logaritmica.
4. **Report.** Uno screenshot ad alta risoluzione del report in markdown renderizzato nell'agent o nell'IDE, da far scorrere nel montaggio.

Genera tutto con dati di un'unica esecuzione e riporta la data in sovrimpressione ("Dati reali · [DATA]").

## Struttura (master 9:16, 1080×1920, 30 fps, 25–30 s)
| Tempo | Scena | Visivo | Testo a schermo (grande, max 6 parole) | Voce (solo per il montaggio futuro) |
|---|---|---|---|---|
| 0–2 s | Aggancio | Il grafico annotato si compone di colpo: candele, poi livelli, poi Fib, con flash rapido dei layer | "Analisi tecnica BTC. Un comando." | "Il tuo coding agent ora legge il grafico di Bitcoin." |
| 2–6 s | Il comando | Terminale reale: digitazione `/btc-ta 1d`, output che scorre | "/btc-ta 1d" | "Scrivi un comando." |
| 6–15 s | Il grafico | Tour del grafico reale, un concetto per inquadratura con etichetta callout | "Supporti e resistenze" → "Fibonacci" → "Divergenze RSI" → "Volume profile" | "Dati reali da Binance. Livelli, Fibonacci, divergenze e volume profile, disegnati sul grafico." |
| 15–20 s | Il report | Scroll del report: bias, tabella livelli, scenario rialzista/ribassista con invalidazione | "Scenari con invalidazione" | "E un report con gli scenari: cosa conferma, cosa invalida." |
| 20–24 s | Compatibilità | Tre brevi clip reali (1 s ciascuna) della stessa richiesta in Claude Code, Codex CLI e OpenCode, poi icona cartella `SKILL.md` | "Claude Code · Codex · OpenCode" + "Formato Agent Skills" | "Funziona con Claude Code, Codex, OpenCode e gli agent compatibili con Agent Skills." |
| 24–30 s | Offerta | Logo, prezzo, URL, pulsante | "[PREZZO] · [URL]" | "Scaricala su [URL]." |

Disclaimer sempre visibile negli ultimi 6 s e in piccolo per tutta la durata: *"Strumento informativo. Non è consulenza finanziaria."*

## Stile
- Palette e font della clip attuale: sfondo crema, arancione Bitcoin, card con bordi sottili. Il grafico resta scuro (tema del prodotto) dentro una cornice arrotondata.
- Testo principale ≥ 64 px, secondario ≥ 40 px. Nessun testo sotto i 32 px, tranne il disclaimer (≥ 26 px).
- Safe zone per le interfacce dei social: nessun elemento importante nei primi 220 px in alto, negli ultimi 380 px in basso e negli ultimi 120 px a destra.
- Movimento: transizioni a molla brevi (200–350 ms), zoom e pan lenti sul grafico, un solo elemento animato per volta. Niente transizioni decorative.
- Callout sul grafico: rettangolo arrotondato arancione + etichetta, allineati alle coordinate reali. Ricavale con `series.priceToCoordinate` / `timeScale().timeToCoordinate` dalla pagina, non a occhio.

## Audio e testo
- **Questa versione non ha voce.** Il messaggio passa interamente dal testo a schermo e dalla musica. Il testo deve bastare da solo: ogni scena regge senza audio.
- Il testo va a tempo con la musica (cambi di scena sui battiti) e resta a schermo almeno 1,2 s per ogni 3 parole.
- Prepara il progetto per aggiungere la mia voce più avanti:
  - salva la colonna "Voce" come `clip/vo-script.txt`, con i tempi di ogni frase;
  - esporta la musica come traccia separata (`music.wav`);
  - struttura il progetto in modo che, con un file `vo.wav`, basti un comando per rigenerare tutte le varianti con la voce e la musica in ducking di −12 dB sotto la voce.
- Musica: riusa `clip/soundtrack.wav` o una traccia royalty-free con licenza commerciale che copra la pubblicità a pagamento. Salva la licenza in `clip/licenses/`.
- Loudness finale −14 LUFS integrati, true peak ≤ −1 dBTP (ffmpeg `loudnorm` a due passaggi).

## Tecnica
- Compositing: usa Remotion (React). Verifica la licenza (gratuita per individui e piccole aziende). Se non è adatta, estendi `clip/render_clip.py` con FFmpeg per gli overlay video.
- Export: H.264 High, 1080×1920, 30 fps, 12 Mbps, AAC 320 kbps, `+faststart`.
- Varianti dallo stesso progetto (le composizioni vanno ripensate per ogni formato, non ritagliate dal 9:16):
  - `spot-9x16-30s.mp4`: master per Instagram/Facebook Reels e TikTok
  - `spot-9x16-15s.mp4`: aggancio → comando → 2 inquadrature del grafico → offerta
  - `spot-4x5-30s.mp4` (1080×1350): feed di Instagram e Facebook
  - `spot-1x1-30s.mp4` (1080×1080): X e LinkedIn
  - `spot-16x9-30s.mp4` (1920×1080): X, LinkedIn e landing page. Su LinkedIn il pubblico è più tecnico: in questa variante il terminale può restare a schermo più a lungo.
  - TikTok: rispetta anche la safe zone destra (icone) e quella inferiore (didascalia).
  - 3 varianti del solo aggancio iniziale per A/B test: "Un comando. Analisi completa." / "Il tuo agent ora fa analisi tecnica." / "Da prompt a grafico annotato in 3 secondi" (usa quest'ultima solo se i tempi misurati lo confermano).
- Consegna anche la copertina 1080×1920 e uno storyboard PNG con un fotogramma per scena.

## Vincoli di contenuto (pubblicità in ambito crypto e finanza)
- Nessuna promessa di guadagno, nessun "compra/vendi", nessuna percentuale di successo. Il bias "rialzista/ribassista" mostralo come lettura degli indicatori, mai come segnale operativo.
- Agent verificati il 24/09/2026 (skill copiata in `~/.agents/skills`, richiesta in linguaggio naturale, grafico generato): Claude Code, OpenAI Codex CLI, OpenCode. Qwen Code non è ancora verificato: non nominarlo. Solo nomi in testo, niente loghi di terzi senza autorizzazione.
- Mantieni visibile l'attribuzione di TradingView Lightweight Charts che compare nel grafico.
- Nessun riferimento a Binance, Bitstamp o altri marchi come partner: al massimo "dati di mercato reali". Non lanciare la campagna finché non ci sono i permessi d'uso commerciale dei dati (vedi `licensing/richieste-permessi-dati.md`) o una fonte alternativa con licenza. Se le fonti cambiano, rigenera i grafici con la nuova configurazione e ricontrolla i fotogrammi.

## Verifica prima di consegnare
- Estrai un fotogramma ogni secondo per ogni variante e controllali: testo leggibile a 360 px di larghezza, niente nella safe zone, nessun fotogramma nero o vuoto.
- Misura la loudness con `ffmpeg -af ebur128` e riporta il valore.
- Controlla che ogni numero visibile coincida con il `summary.json` dell'esecuzione usata.
- Consegna l'elenco dei file prodotti, la durata di ciascuno e le domande aperte.
