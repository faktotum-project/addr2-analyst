#!/usr/bin/env node
// Backfill per-pool 1-minute bars from Uniswap v3 Swap logs.
//   node src/backfill.mjs --days 90 [--chains ethereum,base] [--concurrency 4]
// Output: data/raw/<chain>.json (resumable checkpoint with per-pool minute bars).
//
// Method (see METHODOLOGY.md):
//  - For each pool and block, only the pool price AFTER the last swap of the block is kept (end-of-block price).
//    Sandwich/MEV spikes happen inside a single block and are therefore excluded by construction.
//  - Minute bars: open/close = end-of-block price of the first/last block in the minute; high/low = extremes
//    of end-of-block prices; volume = sum of |stablecoin amount| of every swap in the minute.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CHAINS, POOLS, SWAP_TOPIC } from './config.mjs';
import { Rpc, sleep } from './rpc.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({ options: {
  days: { type: 'string', default: '90' }, chains: { type: 'string' }, concurrency: { type: 'string', default: '3' },
} });
const days = +args.days;
const chains = args.chains ? args.chains.split(',') : Object.keys(CHAINS);
const CONC = +args.concurrency;

const word = (hex, k) => BigInt('0x' + hex.slice(2 + 64 * k, 2 + 64 * (k + 1)));
const signed = x => (x >= 1n << 255n ? x - (1n << 256n) : x);
const addrOf = w => '0x' + w.toString(16).padStart(40, '0');

async function poolMeta(rpc, pool) {
  const t0 = addrOf(word(await rpc.ethCall(pool.address, '0x0dfe1681'), 0)); // token0()
  const t1 = addrOf(word(await rpc.ethCall(pool.address, '0xd21220a7'), 0)); // token1()
  const dec = async t => Number(word(await rpc.ethCall(t, '0x313ce567'), 0)); // decimals()
  const [d0, d1] = [await dec(t0), await dec(t1)];
  // The BTC side has 8 decimals, the stablecoins 6: identify sides by decimals, fail loudly otherwise.
  if (!((d0 === 8 && d1 === 6) || (d0 === 6 && d1 === 8))) throw new Error(`${pool.id}: decimali inattesi ${d0}/${d1}`);
  return { ...pool, token0: t0, token1: t1, dec0: d0, dec1: d1, btcIs0: d0 === 8 };
}

function usdPerBtc(meta, sqrtPriceX96) {
  const s = Number(sqrtPriceX96) / 2 ** 96;
  const p = s * s * 10 ** (meta.dec0 - meta.dec1); // token1 per token0, human units
  return meta.btcIs0 ? p : 1 / p;
}

// Bars keyed by minute; merge-safe regardless of chunk order (open/close tracked with their block numbers).
function addPoint(bars, minute, block, price, vol, n) {
  const b = bars[minute];
  if (!b) { bars[minute] = { o: price, ob: block, c: price, cb: block, h: price, l: price, v: vol, n }; return; }
  if (block < b.ob) { b.o = price; b.ob = block; }
  if (block > b.cb) { b.c = price; b.cb = block; }
  if (price > b.h) b.h = price;
  if (price < b.l) b.l = price;
  b.v += vol; b.n += n;
}

async function backfillChain(chain) {
  const rpc = new Rpc(chain);
  const cfg = CHAINS[chain];
  const pools = await Promise.all(POOLS.filter(p => p.chain === chain).map(p => poolMeta(rpc, p)));
  const byAddr = Object.fromEntries(pools.map(p => [p.address.toLowerCase(), p]));
  const file = join(ROOT, 'data', 'raw', `${chain}.json`);

  const end = await rpc.blockNumber();
  const startTs = Math.floor(Date.now() / 1000) - days * 86400;
  let state;
  try {
    state = JSON.parse(await readFile(file, 'utf8'));
    if (state.days !== days) state = null;
  } catch { state = null; }
  if (!state) {
    const start = await rpc.blockAtTime(startTs);
    state = { chain, days, startBlock: start, done: [], bars: Object.fromEntries(pools.map(p => [p.id, {}])), pools: pools.map(({ id, address, token0, token1, dec0, dec1, btcIs0, wrapped, quote, fee }) => ({ id, address, token0, token1, dec0, dec1, btcIs0, wrapped, quote, fee })) };
  }
  state.endBlock = end;

  // Plan chunks not yet done.
  const doneSet = new Set(state.done.map(([a]) => a));
  const chunks = [];
  for (let a = state.startBlock; a <= end; a += cfg.maxRange) if (!doneSet.has(a)) chunks.push([a, Math.min(end, a + cfg.maxRange - 1)]);
  const total = chunks.length + state.done.length;
  console.log(`[${chain}] blocchi ${state.startBlock}→${end}, ${pools.length} pool, chunk da fare ${chunks.length}/${total}`);

  let logsSeen = 0, sinceSave = 0, t0 = Date.now();
  const save = async () => { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(state)); };

  async function fetchRange(a, b) {
    try {
      return await rpc.call('eth_getLogs', [{ address: pools.map(p => p.address), topics: [SWAP_TOPIC], fromBlock: '0x' + a.toString(16), toBlock: '0x' + b.toString(16) }]);
    } catch (err) {
      if (err.isRangeError && b > a) { // split and retry
        const m = Math.floor((a + b) / 2);
        return [...await fetchRange(a, m), ...await fetchRange(m + 1, b)];
      }
      throw err;
    }
  }

  function processLogs(logs) {
    // end-of-block price per pool + volume per (pool, block)
    const perBlock = new Map(); // key pool|block -> {ts, price, vol, n, logIndex}
    for (const l of logs) {
      const pool = byAddr[l.address.toLowerCase()];
      if (!pool || l.removed) continue;
      const block = parseInt(l.blockNumber, 16), li = parseInt(l.logIndex, 16);
      const ts = parseInt(l.blockTimestamp, 16);
      const a0 = signed(word(l.data, 0)), a1 = signed(word(l.data, 1)), sqrtP = word(l.data, 2);
      const stable = pool.btcIs0 ? a1 : a0;
      const vol = Math.abs(Number(stable)) / 10 ** (pool.btcIs0 ? pool.dec1 : pool.dec0);
      const key = pool.id + '|' + block;
      const cur = perBlock.get(key);
      const price = usdPerBtc(pool, sqrtP);
      if (!cur) perBlock.set(key, { pool: pool.id, block, ts, price, vol, n: 1, li });
      else { cur.vol += vol; cur.n++; if (li > cur.li) { cur.li = li; cur.price = price; } }
    }
    for (const p of perBlock.values()) {
      if (!Number.isFinite(p.ts)) throw new Error('log senza blockTimestamp: serve un RPC che lo includa');
      addPoint(state.bars[p.pool], Math.floor(p.ts / 60) * 60, p.block, p.price, p.vol, p.n);
    }
    logsSeen += logs.length;
  }

  // Sliding window of concurrent fetches.
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const [a, b] = chunks[next++];
      const logs = await fetchRange(a, b);
      processLogs(logs);
      state.done.push([a, b]);
      if (++sinceSave >= 50) { sinceSave = 0; await save(); }
      const k = state.done.length;
      if (k % 25 === 0 || k === total) {
        const rate = (Date.now() - t0) / 1000 / Math.max(1, k - (total - chunks.length));
        console.log(`[${chain}] ${k}/${total} chunk · ${logsSeen} swap · ~${Math.round(rate * (total - k) / 60)} min rimanenti`);
      }
      await sleep(80);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  await save();
  const nBars = Object.values(state.bars).reduce((a, b) => a + Object.keys(b).length, 0);
  console.log(`[${chain}] completato: ${logsSeen} swap nuovi, ${nBars} barre-minuto totali → ${file}`);
}

const results = await Promise.allSettled(chains.map(backfillChain));
results.forEach((r, i) => { if (r.status === 'rejected') { console.error(`[${chains[i]}] ERRORE: ${r.reason?.stack ?? r.reason}`); process.exitCode = 1; } });
