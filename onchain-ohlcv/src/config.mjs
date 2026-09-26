// Chains, RPC endpoints and pools indexed by the prototype.
// Pool addresses were resolved on-chain via the Uniswap v3 factory (getPool) on 2026-09-24;
// token order and decimals are read from the chain at runtime, never hardcoded.
// RPC lists can be overridden with env vars, e.g. OHLCV_RPC_ETHEREUM="https://my-node,https://fallback".

export const SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'; // Uniswap v3 Swap

export const CHAINS = {
  ethereum: {
    rpcs: ['https://rpc.mevblocker.io', 'https://ethereum.public.blockpi.network/v1/rpc/public'],
    maxRange: 5000,      // blocks per eth_getLogs (lowest limit among the RPCs above)
    blockTime: 12,
  },
  base: {
    rpcs: ['https://mainnet.base.org'],
    maxRange: 2000,
    blockTime: 2,
  },
};

// quote: the stablecoin side. 'USDC' is treated as USD; 'USDT' is converted with the on-chain USDT/USD estimate.
// wrapped: which BTC wrapper the pool trades (custodial pegs are monitored separately).
export const POOLS = [
  { id: 'eth-wbtc-usdc-5', chain: 'ethereum', address: '0x9a772018fbd77fcd2d25657e5c547baff3fd7d16', wrapped: 'WBTC', quote: 'USDC', fee: 0.0005 },
  { id: 'eth-wbtc-usdc-30', chain: 'ethereum', address: '0x99ac8ca7087fa4a2a1fb6357269965a2014abc35', wrapped: 'WBTC', quote: 'USDC', fee: 0.003 },
  { id: 'eth-wbtc-usdt-30', chain: 'ethereum', address: '0x9db9e0e53058c89e5b94e29621a205198648425b', wrapped: 'WBTC', quote: 'USDT', fee: 0.003 },
  { id: 'eth-cbbtc-usdc-5', chain: 'ethereum', address: '0x54e58c986818903d2d86dafe03f5f5e6c2ca6710', wrapped: 'cbBTC', quote: 'USDC', fee: 0.0005 },
  { id: 'eth-cbbtc-usdc-30', chain: 'ethereum', address: '0x4548280ac92507c9092a511c7396cbea78fa9e49', wrapped: 'cbBTC', quote: 'USDC', fee: 0.003 },
  { id: 'base-cbbtc-usdc-5', chain: 'base', address: '0xfbb6eed8e7aa03b138556eedaf5d271a5e1e43ef', wrapped: 'cbBTC', quote: 'USDC', fee: 0.0005 },
  { id: 'base-cbbtc-usdc-30', chain: 'base', address: '0xec558e484cc9f2210714e345298fdc53b253c27d', wrapped: 'cbBTC', quote: 'USDC', fee: 0.003 },
];

// Pair used to estimate USDT/USD: same chain, same wrapper, USDC vs USDT quote.
export const USDT_BASIS_PAIR = { usdc: 'eth-wbtc-usdc-5', usdt: 'eth-wbtc-usdt-30' };

export function rpcsFor(chain) {
  const env = process.env[`OHLCV_RPC_${chain.toUpperCase()}`];
  return env ? env.split(',').map(s => s.trim()).filter(Boolean) : CHAINS[chain].rpcs;
}
