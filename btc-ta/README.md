# btc-ta: analisi tecnica Bitcoin per coding agent

Skill in formato [Agent Skills](https://agentskills.io/specification) (`SKILL.md`). Chiedi un'analisi di BTC al tuo coding agent e ricevi:
- un grafico interattivo annotato (`chart.html`) e la sua immagine PNG;
- il grafico del ciclo di lungo periodo;
- un report scritto con livelli chiave e scenari.

## Requisiti
- Node.js 20 o successivo (`node --version`). Nessun pacchetto npm da installare.
- Accesso a internet: i dati vengono scaricati da API pubbliche.
- Facoltativo, per i PNG: Chromium, Chrome o Firefox. Se nessuno viene trovato automaticamente, imposta `BTC_TA_CHROME=/percorso/del/browser`.

## Installazione

Copia la cartella `btc-ta/` nella cartella delle skill del tuo agent. Il nome della cartella deve restare `btc-ta`.

| Agent | Cartella personale (tutti i progetti) | Cartella di progetto |
|---|---|---|
| Claude Code | `~/.claude/skills/btc-ta/` | `.claude/skills/btc-ta/` |
| OpenAI Codex CLI | `~/.agents/skills/btc-ta/` | `.agents/skills/btc-ta/` |
| OpenCode | `~/.config/opencode/skills/btc-ta/` (legge anche `~/.claude/skills` e `~/.agents/skills`) | `.opencode/skills/btc-ta/` |
| Qwen Code | `~/.qwen/skills/btc-ta/` | `.qwen/skills/btc-ta/` |
| Altri agent compatibili con Agent Skills | vedi la documentazione dell'agent | |

Esempio (Linux/macOS):
```bash
mkdir -p ~/.agents/skills && cp -r btc-ta ~/.agents/skills/
```

Poi verifica che tutto funzioni:
```bash
node ~/.agents/skills/btc-ta/scripts/selftest.mjs
```

## Uso
- In linguaggio naturale: "fammi l'analisi tecnica di BTC sul 4h".
- Come comando, negli agent che lo supportano: `/btc-ta 1w`.

Timeframe disponibili: `15m`, `1h`, `4h`, `1d` (predefinito), `1w`, `1mo` (mensile). I risultati vengono salvati in `./btc-ta-output/` nella cartella in cui stai lavorando. `--closed-only` esclude la barra ancora in corso, utile per gli aggiornamenti automatici.

## Fonti dati
Predefinite: Binance (candele, funding, open interest), Bitstamp (storico dal 2012), alternative.me (Fear & Greed). Ogni fonte si può sostituire o disattivare:
```bash
node scripts/analyze.mjs --list-sources
node scripts/analyze.mjs --tf 1d --history candles --derivatives none
```
Oppure con le variabili d'ambiente `BTC_TA_CANDLES`, `BTC_TA_HISTORY`, `BTC_TA_DERIVATIVES`, `BTC_TA_SENTIMENT`. Per aggiungere una fonte vedi `references/data-providers.md`.

## Licenze e fonti
- Licenza della skill: `LICENSE.txt`.
- Componenti e dati di terze parti: `THIRD_PARTY_NOTICES.md`.

Strumento informativo. Non è consulenza finanziaria.
