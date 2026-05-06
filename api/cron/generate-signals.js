// =====================================================================
// /api/cron/generate-signals — Vercel scheduled function
// =====================================================================
// Runs daily (configured in vercel.json crons) to generate fresh
// composite signals server-side, independent of any browser session.
// Writes results to Supabase via the REST API using the service-role
// key (must be set as SUPABASE_SERVICE_ROLE_KEY in Vercel env vars).
//
// Engine here is a server-side mirror of the client's signal logic in
// index.html, using only built-in fetch (Node 18+). It's narrower than
// the client because:
//   - No liquidation cascade indicator (depends on WS feed only the
//     browser has). Until liq events are mirrored to Supabase, the
//     cron computes a 3-indicator composite (funding-flip, OI/price
//     divergence, cross-exchange basis).
//   - No ETF flow signal yet (needs Farside data source decision).
//
// Manual trigger: GET /api/cron/generate-signals
// (with Authorization: Bearer <CRON_SECRET> header for safety; cron
// runs from Vercel itself which sets the header automatically.)
// =====================================================================

const SUPABASE_URL              = process.env.SUPABASE_URL || 'https://xzxxhsjwzkgxhdbvyaud.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET               = process.env.CRON_SECRET; // optional auth

// ---- Constants (mirror client) ----
const MIN_24H_VOLUME    = 50_000_000;
const FUNDING_FLIP_MIN  = 0.0002;
const OI_RISING_MIN     = 0.05;
const OI_FALLING_MAX    = -0.03;
const PRICE_BIG_MOVE    = 0.03;
const BASIS_MIN_BPS     = 20;
const FETCH_CONCURRENCY = 6;
const TOP_N_UNIVERSE    = 50;

const SLTP_PROFILES = [
  [10_000_000_000, 0.025, 0.0375, 0.05,  0.075],
  [   500_000_000, 0.040, 0.060,  0.080, 0.120],
  [    50_000_000, 0.060, 0.090,  0.120, 0.180],
];

const BIN = 'https://fapi.binance.com';

async function fetchJson(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} for ${url}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function pLimit(items, fn, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try { results[idx] = await fn(items[idx], idx); }
      catch (e) { results[idx] = { __err: String(e?.message || e) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ---- Universe ----
async function fetchUniverse() {
  const all = await fetchJson(`${BIN}/fapi/v1/ticker/24hr`);
  return all
    .filter(t => t.symbol.endsWith('USDT'))
    .filter(t => !/UP|DOWN|BULL|BEAR/.test(t.symbol))
    .filter(t => +t.quoteVolume >= MIN_24H_VOLUME)
    .filter(t => +t.lastPrice > 0)
    .map(t => ({
      sym: t.symbol,
      vol: +t.quoteVolume,
      price: +t.lastPrice,
      chgPct: +t.priceChangePercent / 100,
    }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, TOP_N_UNIVERSE);
}

async function fetchSymbolHistory(sym) {
  const fUrl = `${BIN}/fapi/v1/fundingRate?symbol=${sym}&limit=4`;
  const oUrl = `${BIN}/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=24`;
  const [f, o] = await Promise.all([
    fetchJson(fUrl).catch(() => []),
    fetchJson(oUrl).catch(() => []),
  ]);
  return { sym, funding: Array.isArray(f) ? f : [], oi: Array.isArray(o) ? o : [] };
}

// Cross-exchange perp prices — Bybit, OKX, Gate, KuCoin
async function fetchCrossExchangePrices() {
  const out = {};
  // Bybit
  try {
    const r = await fetchJson('https://api.bybit.com/v5/market/tickers?category=linear');
    for (const t of (r?.result?.list || [])) {
      if (t.symbol?.endsWith('USDT')) out[t.symbol] = out[t.symbol] || {};
      if (t.lastPrice) (out[t.symbol] ||= {}).bybit = +t.lastPrice;
    }
  } catch {}
  // OKX (uses BTC-USDT-SWAP format — we map to BTCUSDT)
  try {
    const r = await fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
    for (const t of (r?.data || [])) {
      const m = t.instId?.match(/^([A-Z0-9]+)-USDT-SWAP$/);
      if (m && t.last) {
        const sym = m[1] + 'USDT';
        (out[sym] ||= {}).okx = +t.last;
      }
    }
  } catch {}
  // Gate
  try {
    const r = await fetchJson('https://fx-api.gateio.ws/api/v4/futures/usdt/tickers');
    for (const t of (Array.isArray(r) ? r : [])) {
      const sym = t.contract?.replace('_USDT', 'USDT');
      if (sym && t.last) (out[sym] ||= {}).gate = +t.last;
    }
  } catch {}
  return out;
}

// ---- Indicators ----
function indFundingFlip(funding, oiDelta) {
  if (!funding || funding.length < 2) return { l: 0, s: 0, confirms: [] };
  const curr = +funding[funding.length - 1].fundingRate;
  const prevs = funding.slice(0, -1).map(x => +x.fundingRate);
  const prev = prevs.reduce((a, b) => a + b, 0) / Math.max(1, prevs.length);
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return { l: 0, s: 0, confirms: [] };
  const confirms = [];
  let l = 0, s = 0;
  if (prev > FUNDING_FLIP_MIN && curr < 0 && oiDelta > OI_RISING_MIN) {
    l += 3;
    confirms.push({ side: 'long', label: `funding flipped ${(prev*100).toFixed(3)}% → ${(curr*100).toFixed(3)}%`, strong: true });
  }
  if (prev < -FUNDING_FLIP_MIN && curr > 0 && oiDelta > OI_RISING_MIN) {
    s += 3;
    confirms.push({ side: 'short', label: `funding flipped ${(prev*100).toFixed(3)}% → ${(curr*100).toFixed(3)}%`, strong: true });
  }
  return { l, s, confirms };
}

function indOiDivergence(priceChg, oiDelta) {
  const confirms = [];
  let l = 0, s = 0;
  if (priceChg < -PRICE_BIG_MOVE && oiDelta > OI_RISING_MIN) {
    l += 2.5;
    confirms.push({ side: 'long', label: `OI +${(oiDelta*100).toFixed(1)}% / 24h while price ${(priceChg*100).toFixed(1)}%`, strong: true });
  }
  if (priceChg > PRICE_BIG_MOVE && oiDelta < OI_FALLING_MAX) {
    s += 2.5;
    confirms.push({ side: 'short', label: `OI ${(oiDelta*100).toFixed(1)}% / 24h while price +${(priceChg*100).toFixed(1)}%`, strong: true });
  }
  if (priceChg > PRICE_BIG_MOVE && oiDelta > OI_RISING_MIN * 1.5) {
    l += 1.0;
    confirms.push({ side: 'long', label: `healthy trend: price + OI both rising`, strong: false });
  }
  if (priceChg < -PRICE_BIG_MOVE && oiDelta < OI_FALLING_MAX * 1.5) {
    s += 1.0;
    confirms.push({ side: 'short', label: `downtrend confirmed by OI shrinking`, strong: false });
  }
  return { l, s, confirms };
}

function indBasisSpread(sym, price, others) {
  const confirms = [];
  let l = 0, s = 0;
  const o = others?.[sym] || {};
  const pool = [];
  for (const ex of ['bybit', 'okx', 'gate']) if (o[ex]) pool.push({ ex, p: o[ex] });
  if (!pool.length) return { l, s, confirms };
  let maxBps = 0, hit = null;
  for (const v of pool) {
    const bps = ((price - v.p) / v.p) * 10_000;
    if (Math.abs(bps) > Math.abs(maxBps)) { maxBps = bps; hit = v.ex; }
  }
  if (Math.abs(maxBps) < BASIS_MIN_BPS) return { l, s, confirms };
  if (maxBps > 0) {
    l += 1.5;
    confirms.push({ side: 'long', label: `Binance +${maxBps.toFixed(0)}bps over ${hit}`, strong: false });
  } else {
    s += 1.5;
    confirms.push({ side: 'short', label: `Binance ${maxBps.toFixed(0)}bps under ${hit}`, strong: false });
  }
  return { l, s, confirms };
}

function computeZones(side, price, vol) {
  let profile = SLTP_PROFILES[SLTP_PROFILES.length - 1];
  for (const p of SLTP_PROFILES) { if (vol >= p[0]) { profile = p; break; } }
  const [, sl, tp1, tp2, tp3] = profile;
  const dir = side === 'long' ? 1 : -1;
  return {
    entry: price,
    stopLoss: price * (1 - sl * dir),
    tp1: price * (1 + tp1 * dir),
    tp2: price * (1 + tp2 * dir),
    tp3: price * (1 + tp3 * dir),
    slPct: sl, tp1Pct: tp1, tp2Pct: tp2, tp3Pct: tp3,
  };
}

function scoreSymbol(rec, hist, others) {
  if (!hist?.oi || hist.oi.length < 2) return null;
  const oiNow = +hist.oi[hist.oi.length - 1].sumOpenInterestValue || +hist.oi[hist.oi.length - 1].sumOpenInterest || 0;
  const oi24 = +hist.oi[0].sumOpenInterestValue || +hist.oi[0].sumOpenInterest || 0;
  if (!oi24) return null;
  const oiDelta = (oiNow - oi24) / oi24;

  const i1 = indFundingFlip(hist.funding, oiDelta);
  const i2 = indOiDivergence(rec.chgPct, oiDelta);
  const i3 = indBasisSpread(rec.sym, rec.price, others);

  const longTotal  = i1.l + i2.l + i3.l;
  const shortTotal = i1.s + i2.s + i3.s;
  const longConfirms  = (i1.l > 0.5 ? 1 : 0) + (i2.l > 0.5 ? 1 : 0) + (i3.l > 0.5 ? 1 : 0);
  const shortConfirms = (i1.s > 0.5 ? 1 : 0) + (i2.s > 0.5 ? 1 : 0) + (i3.s > 0.5 ? 1 : 0);

  return {
    sym: rec.sym,
    price: rec.price,
    vol: rec.vol,
    longScore:  longConfirms  >= 2 ? Math.min(10, longTotal)  : 0,
    shortScore: shortConfirms >= 2 ? Math.min(10, shortTotal) : 0,
    confirms: [...i1.confirms, ...i2.confirms, ...i3.confirms],
    meta: {
      oiDelta, oiNow, oi24,
      priceChg24h: rec.chgPct,
      fundingCurrent: hist.funding.length ? +hist.funding[hist.funding.length - 1].fundingRate : null,
      vol: rec.vol,
      source: 'cron',
    },
  };
}

// ---- Supabase REST ----
async function supabaseInsert(rows) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[cron] no SUPABASE_SERVICE_ROLE_KEY set — skipping persist');
    return { skipped: true };
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`supabase insert ${r.status}: ${await r.text()}`);
  return { inserted: rows.length };
}

// ---- Main handler ----
async function handler(req, res) {
  // Optional auth: require CRON_SECRET if set in env (Vercel cron sets a header)
  if (CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const t0 = Date.now();
  try {
    const universe = await fetchUniverse();
    const others = await fetchCrossExchangePrices();

    const histories = await pLimit(universe, (rec) => fetchSymbolHistory(rec.sym), FETCH_CONCURRENCY);
    const scored = [];
    for (let i = 0; i < universe.length; i++) {
      const h = histories[i];
      if (!h || h.__err) continue;
      const r = scoreSymbol(universe[i], h, others);
      if (r && (r.longScore > 0 || r.shortScore > 0)) scored.push(r);
    }
    const longs  = scored.filter(s => s.longScore > 0).sort((a, b) => b.longScore - a.longScore);
    const shorts = scored.filter(s => s.shortScore > 0).sort((a, b) => b.shortScore - a.shortScore);

    // Build Supabase rows
    const rows = [];
    for (const s of longs) {
      const z = computeZones('long', s.price, s.vol);
      rows.push({
        symbol: s.sym, side: 'long', signal_type: 'composite', score: s.longScore,
        entry_price: z.entry, stop_loss: z.stopLoss, tp1: z.tp1, tp2: z.tp2, tp3: z.tp3,
        confirms: s.confirms.filter(c => c.side === 'long'), metadata: s.meta, author: 'cron',
      });
    }
    for (const s of shorts) {
      const z = computeZones('short', s.price, s.vol);
      rows.push({
        symbol: s.sym, side: 'short', signal_type: 'composite', score: s.shortScore,
        entry_price: z.entry, stop_loss: z.stopLoss, tp1: z.tp1, tp2: z.tp2, tp3: z.tp3,
        confirms: s.confirms.filter(c => c.side === 'short'), metadata: s.meta, author: 'cron',
      });
    }

    let dbResult = { inserted: 0 };
    if (rows.length) dbResult = await supabaseInsert(rows);

    return res.status(200).json({
      ok: true,
      durationMs: Date.now() - t0,
      universeSize: universe.length,
      crossExSymbols: Object.keys(others).length,
      longCount: longs.length,
      shortCount: shorts.length,
      dbResult,
      topLongs:  longs.slice(0, 5).map(s => ({ sym: s.sym, score: +s.longScore.toFixed(1) })),
      topShorts: shorts.slice(0, 5).map(s => ({ sym: s.sym, score: +s.shortScore.toFixed(1) })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e), durationMs: Date.now() - t0 });
  }
}

module.exports = handler;
module.exports.default = handler;
