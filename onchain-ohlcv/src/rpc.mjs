// Minimal JSON-RPC client with endpoint rotation, retries and adaptive eth_getLogs ranges.
import { rpcsFor } from './config.mjs';

export class Rpc {
  constructor(chain) {
    this.chain = chain;
    this.urls = rpcsFor(chain);
    this.i = 0;
  }

  async call(method, params, { retries = 6 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const url = this.urls[(this.i + attempt) % this.urls.length];
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'onchain-ohlcv/0.1' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(30000),
        });
        const text = await res.text();
        let j;
        try { j = JSON.parse(text); } catch { throw new RpcError(`HTTP ${res.status}: ${text.slice(0, 120)}`, res.status === 429); }
        if (j.error) throw new RpcError(j.error.message ?? JSON.stringify(j.error), /rate|limit exceeded|too many requests/i.test(j.error.message ?? ''), j.error);
        this.i = (this.i + attempt) % this.urls.length; // stick with the endpoint that worked
        return j.result;
      } catch (err) {
        lastErr = err;
        if (err instanceof RpcError && err.isRangeError) throw err; // caller shrinks the range
        await sleep(Math.min(15000, 500 * 2 ** attempt) + Math.random() * 300);
      }
    }
    throw lastErr;
  }

  async blockNumber() { return parseInt(await this.call('eth_blockNumber', []), 16); }

  async blockTime(n) {
    const b = await this.call('eth_getBlockByNumber', ['0x' + n.toString(16), false]);
    return parseInt(b.timestamp, 16);
  }

  // Binary search for the first block with timestamp >= ts.
  async blockAtTime(ts) {
    let lo = 1, hi = await this.blockNumber();
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if ((await this.blockTime(mid)) < ts) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  async ethCall(to, data) { return this.call('eth_call', [{ to, data }, 'latest']); }
}

export class RpcError extends Error {
  constructor(msg, rateLimited = false, raw) {
    super(msg);
    this.rateLimited = rateLimited;
    this.raw = raw;
    this.isRangeError = /range|too many|limit.*(results|logs)|10000|query returned more|response size/i.test(msg) && !rateLimited;
  }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
