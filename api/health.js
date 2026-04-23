// Serverless health probe for c0r7x perps terminal.
// Pings each upstream exchange REST endpoint server-side (no CORS, no browser geo-block)
// and returns a per-exchange status + latency + build commit snapshot.
//
// Consumed by the Puppeteer watchdog and by humans hitting /api/health directly.

const PROBES = [
  { name: 'binance-fapi',   url: 'https://fapi.binance.com/fapi/v1/ping' },
  { name: 'binance-spot',   url: 'https://api.binance.com/api/v3/ping' },
  { name: 'hyperliquid',    url: 'https://api.hyperliquid.xyz/info', method: 'POST',
    body: JSON.stringify({ type: 'meta' }), headers: { 'content-type': 'application/json' } },
  { name: 'aster',          url: 'https://fapi.asterdex.com/fapi/v1/ping' },
  { name: 'bybit',          url: 'https://api.bybit.com/v5/market/time' },
  { name: 'okx',            url: 'https://www.okx.com/api/v5/public/time' },
  { name: 'coinbase',       url: 'https://api.exchange.coinbase.com/time' },
  { name: 'coinbase-intx',  url: 'https://api.international.coinbase.com/api/v1/time' },
  { name: 'bitget',         url: 'https://api.bitget.com/api/v2/public/time' },
  { name: 'gate',           url: 'https://api.gateio.ws/api/v4/spot/time' },
  { name: 'kucoin',         url: 'https://api-futures.kucoin.com/api/v1/timestamp' },
];

async function probe(p) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(p.url, {
      method: p.method || 'GET',
      headers: p.headers,
      body: p.body,
      signal: ctl.signal,
    });
    const latencyMs = Date.now() - t0;
    return { name: p.name, ok: r.ok, status: r.status, latencyMs };
  } catch (e) {
    return { name: p.name, ok: false, status: 0, latencyMs: Date.now() - t0, error: String(e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const results = await Promise.all(PROBES.map(probe));
  const allOk = results.every(r => r.ok);
  const summary = {
    ok: allOk,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
    region: process.env.VERCEL_REGION || 'unknown',
    ts: new Date().toISOString(),
    exchanges: Object.fromEntries(results.map(r => [r.name, r])),
  };
  res.setHeader('cache-control', 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  res.status(allOk ? 200 : 503).json(summary);
}
