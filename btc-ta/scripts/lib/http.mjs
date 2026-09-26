// Shared HTTP helper for data providers.

export async function getJSON(url, { retries = 2, headers = {} } = {}) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'btc-ta-skill', ...headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= retries) throw err;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}
