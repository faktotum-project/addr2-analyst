# Metodologia v0.1: BTC/USD OHLCV da scambi on-chain

## Obiettivo
Produrre candele BTC/USD aperte e verificabili partendo solo da dati pubblici di blockchain, senza contratti con exchange o fornitori di dati. Chiunque può rilanciare l'indicizzatore su un proprio nodo e ottenere gli stessi numeri.

## Fonti
- **Scambi**: eventi `Swap` delle pool Uniswap v3 tra BTC "wrapped" (WBTC, cbBTC) e stablecoin (USDC, USDT), su Ethereum e Base. L'elenco delle pool è in `src/config.mjs`: gli indirizzi sono ricavati dalla factory Uniswap, mentre token e decimali vengono letti on-chain a ogni esecuzione.
- **Tempo**: `blockTimestamp` del blocco che contiene lo scambio.

## Passaggi
1. **Prezzo a fine blocco.** Per ogni pool e ogni blocco si tiene solo il prezzo della pool dopo l'ultimo scambio del blocco, cioè `sqrtPriceX96` dell'ultimo evento. Gli attacchi sandwich e gli altri picchi MEV avvengono dentro un singolo blocco, quindi restano fuori per costruzione.
2. **Barre al minuto per pool.** Apertura e chiusura sono i prezzi di fine blocco del primo e dell'ultimo blocco del minuto; massimo e minimo sono gli estremi dei prezzi di fine blocco; il volume è la somma, in valore assoluto, della quantità di stablecoin scambiata.
3. **Conversione in USD.** USDC è considerato pari a 1 USD. USDT viene convertito con una stima on-chain di USDT/USD: il rapporto tra la chiusura della pool WBTC/USDC e quella della pool WBTC/USDT negli stessi minuti, con mediana mobile su 24 ore.
4. **Composito al minuto.** Apertura, massimo, minimo e chiusura sono la mediana ponderata per volume dei valori delle pool attive in quel minuto. Il volume è la somma dei volumi di tutte le pool.
5. **Filtro anomalie (Hampel).** Un minuto viene scartato se la sua chiusura dista dalla mediana dei ±15 minuti vicini più del maggiore tra 1,5% e 6 × MAD robusto (una misura di dispersione poco sensibile agli estremi). Massimi e minimi oltre la stessa soglia vengono riportati al corpo della candela.
6. **Ricampionamento** a 1h e 1d (UTC). L'apertura di ogni barra è la chiusura della barra precedente, come nelle candele degli exchange.

## Controlli pubblicati insieme ai dati
- `peg-1h.csv`: scarto tra le pool WBTC e le pool cbBTC, in punti base. Un valore che cresce segnala un possibile sgancio di uno dei due token dal BTC.
- Colonna `usdt_usd`: la stima USDT/USD usata per ogni barra.
- Colonne `swaps`, `minutes_with_trades` e `max_pools`: quanto è "denso" ogni dato.

## Limiti noti
- **Volume.** Il volume è quello scambiato sulle DEX indicizzate, non il volume dell'intero mercato BTC. Va usato per confronti relativi (OBV, profilo di volume) e non come valore assoluto.
- **Token wrapped.** WBTC e cbBTC dipendono da custodi (BitGo/BiT Global e Coinbase). Il prezzo è quello del token, che normalmente coincide con BTC entro pochi punti base.
- **USDC.** È considerato pari a 1 USD. Uno sgancio di USDC sposterebbe l'intera serie.
- **Storico.** Le pool di riferimento esistono dal 2019 (WBTC) e dal 2024 (cbBTC). Non è possibile ricostruire periodi precedenti con questo metodo.
- **Ore a bassa attività.** Nelle ore con pochi scambi, massimi e minimi sono meno precisi rispetto agli exchange più liquidi.

## Licenze
- Codice: Apache-2.0.
- Dataset prodotto (`data/ohlcv/`): CC BY 4.0. Attribuzione richiesta: "Open on-chain BTC/USD OHLCV (onchain-ohlcv), CC BY 4.0".
