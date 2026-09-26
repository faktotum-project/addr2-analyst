# onchain-ohlcv: candele BTC/USD aperte, dagli scambi on-chain

Indicizzatore open source che costruisce candele OHLCV BTC/USD dagli scambi delle DEX su blockchain pubbliche. Non dipende da exchange o fornitori di dati: ogni numero è riproducibile da chiunque abbia accesso a un nodo.

- **Codice:** Apache-2.0 (`LICENSE`)
- **Dataset** in `data/ohlcv/`: CC BY 4.0 (`DATA_LICENSE.md`)
- **Metodo:** `METHODOLOGY.md`

> Stato: **prototipo v0.1**. Copre 7 pool Uniswap v3 su Ethereum e Base. Non ancora pronto per la produzione.

## Uso

Requisiti: Node.js 20 o successivo, nessuna dipendenza npm.

```bash
node src/backfill.mjs --days 90        # scarica gli swap e crea le barre al minuto per pool (riprende da dove si era fermato)
node src/build.mjs                     # composito → data/ohlcv/btc-usd-1h.csv, btc-usd-1d.csv, peg-1h.csv, meta.json
node validate/compare.mjs              # confronto di qualità con candele di exchange (solo come metro di paragone)
```

RPC: di default usa endpoint pubblici gratuiti (`src/config.mjs`). Per usare il tuo nodo:
```bash
OHLCV_RPC_ETHEREUM=https://mio-nodo OHLCV_RPC_BASE=https://mio-nodo-base node src/backfill.mjs
```

## Formato CSV
`time,open,high,low,close,volume_usd,swaps,minutes_with_trades,max_pools,usdt_usd`

`time` è l'apertura della barra in ISO 8601 UTC. `volume_usd` è il volume sulle DEX indicizzate.
