/**
 * Deep price flow test — traces exactly what price reaches Superbrain and LSTM
 * Tests: Yahoo v7 (fundamentals), Yahoo v8 (OHLCV), NSE Bhav, and the final
 * currentPrice that gets passed to Superbrain.
 */
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const SYMBOLS = ['RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'WIPRO'];

// ── Test 1: Yahoo v7 quote (used by MarketDataAggregator for lastPrice) ──────
async function testYahooV7(symbol) {
  const ticker = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice,regularMarketChangePercent,trailingPE,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap`;
  try {
    const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
    const q = r.data?.quoteResponse?.result?.[0];
    return q ? { ok: true, price: q.regularMarketPrice, pe: q.trailingPE, hi52: q.fiftyTwoWeekHigh } : { ok: false, reason: 'no result' };
  } catch (e) {
    return { ok: false, status: e.response?.status, reason: e.message };
  }
}

// ── Test 2: Yahoo v8 chart (used by fetchRealOHLCV for candles) ───────────────
async function testYahooV8(symbol) {
  const ticker = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  try {
    const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
    const result = r.data?.chart?.result?.[0];
    const meta = result?.meta;
    const closes = result?.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
    return meta ? {
      ok: true,
      regularMarketPrice: meta.regularMarketPrice,
      lastOHLCVClose: closes.at(-1),
      diff: meta.regularMarketPrice && closes.at(-1)
        ? Math.abs(meta.regularMarketPrice - closes.at(-1)).toFixed(2)
        : 'N/A',
      candleCount: closes.length,
    } : { ok: false, reason: 'no meta' };
  } catch (e) {
    return { ok: false, status: e.response?.status, reason: e.message };
  }
}

// ── Test 3: NSE Bhav copy (official EOD price) ────────────────────────────────
async function testNSEBhav(symbol) {
  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
  try {
    const r = await axios.get(url, {
      timeout: 6000,
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.nseindia.com' },
    });
    const p = r.data?.priceInfo;
    return p ? { ok: true, lastPrice: p.lastPrice, prevClose: p.previousClose, pChange: p.pChange?.toFixed(2) } : { ok: false };
  } catch (e) {
    return { ok: false, status: e.response?.status, reason: e.message };
  }
}

// ── Test 4: Simulate what analyzeUltraQuantProfile does ──────────────────────
// When Yahoo v7 fails → enrichedData.yahoo = null → currentPrice = endPrice (synthetic!)
// When Yahoo v8 OHLCV succeeds → endPrice = real last close ✓
// When Yahoo v8 OHLCV fails → endPrice = random walk price ✗ (FAKE)
async function testOHLCVLastClose(symbol) {
  const ticker = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
  try {
    const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
    const result = r.data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
    const timestamps = result?.timestamp ?? [];
    const lastTs = timestamps.at(-1);
    return {
      ok: true,
      candleCount: closes.length,
      lastClose: closes.at(-1)?.toFixed(2),
      lastDate: lastTs ? new Date(lastTs * 1000).toISOString().split('T')[0] : null,
      isStale: lastTs ? (Date.now() - lastTs * 1000) > 5 * 24 * 60 * 60 * 1000 : true,
    };
  } catch (e) {
    return { ok: false, status: e.response?.status, reason: e.message };
  }
}

// ── Test 5: LSTM formula analysis ─────────────────────────────────────────────
// lstmPredictedPrice = endPrice * (1 + avgReturn * 10)
// avgReturn = average of last 50 daily returns
// If avgReturn = 0.002 (0.2%/day), lstmPredicted = endPrice * 1.02 (+2%)
// If avgReturn = 0.005 (0.5%/day), lstmPredicted = endPrice * 1.05 (+5%)
// This is NOT a real LSTM — it's a simple 10-day linear extrapolation
function analyzeLSTMFormula(closes) {
  if (!closes || closes.length < 51) return null;
  const last50 = closes.slice(-50);
  const returns = [];
  for (let i = 1; i < last50.length; i++) {
    returns.push((last50[i] - last50[i-1]) / last50[i-1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const endPrice = closes.at(-1);
  const lstmPredicted = endPrice * (1 + avgReturn * 10);
  return {
    endPrice: endPrice?.toFixed(2),
    avgDailyReturn: (avgReturn * 100).toFixed(4) + '%',
    lstmPredicted: lstmPredicted?.toFixed(2),
    impliedUpside: ((lstmPredicted - endPrice) / endPrice * 100).toFixed(2) + '%',
    note: 'lstmPredictedPrice = endPrice * (1 + avgReturn * 10) — 10-day linear extrapolation, NOT a real LSTM',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  PRICE FLOW DEEP TRACE — What actually reaches Superbrain/LSTM');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const sym of SYMBOLS) {
  console.log(`\n╔══ ${sym} ${'═'.repeat(50 - sym.length)}`);

  const [v7, v8, nse, ohlcv2y] = await Promise.allSettled([
    testYahooV7(sym),
    testYahooV8(sym),
    testNSEBhav(sym),
    testOHLCVLastClose(sym),
  ]);

  const rv7   = v7.status   === 'fulfilled' ? v7.value   : { ok: false };
  const rv8   = v8.status   === 'fulfilled' ? v8.value   : { ok: false };
  const rnse  = nse.status  === 'fulfilled' ? nse.value  : { ok: false };
  const r2y   = ohlcv2y.status === 'fulfilled' ? ohlcv2y.value : { ok: false };

  console.log(`\n  [1] Yahoo v7 (MarketDataAggregator.lastPrice → currentPrice):`);
  if (rv7.ok) {
    console.log(`      ✅ lastPrice = ₹${rv7.price}  PE=${rv7.pe}  52W-Hi=₹${rv7.hi52}`);
  } else {
    console.log(`      ❌ FAILED (HTTP ${rv7.status}) — enrichedData.yahoo = null`);
    console.log(`      ⚠️  currentPrice will fall back to endPrice (OHLCV last close or SYNTHETIC)`);
  }

  console.log(`\n  [2] Yahoo v8 OHLCV 5d (regularMarketPrice vs lastOHLCVClose):`);
  if (rv8.ok) {
    console.log(`      regularMarketPrice : ₹${rv8.regularMarketPrice}`);
    console.log(`      lastOHLCVClose     : ₹${rv8.lastOHLCVClose}`);
    console.log(`      difference         : ₹${rv8.diff} (should be ~0)`);
  } else {
    console.log(`      ❌ FAILED (HTTP ${rv8.status})`);
  }

  console.log(`\n  [3] NSE Direct (ground truth):`);
  if (rnse.ok) {
    console.log(`      lastPrice = ₹${rnse.lastPrice}  prevClose=₹${rnse.prevClose}  pChange=${rnse.pChange}%`);
  } else {
    console.log(`      ❌ FAILED (HTTP ${rnse.status})`);
  }

  console.log(`\n  [4] Yahoo v8 OHLCV 2y (endPrice used for all indicators):`);
  if (r2y.ok) {
    console.log(`      lastClose  = ₹${r2y.lastClose}  (${r2y.lastDate})`);
    console.log(`      candles    = ${r2y.candleCount}`);
    console.log(`      isStale    = ${r2y.isStale ? '⚠️  YES — data is >5 days old!' : '✅ fresh'}`);
  } else {
    console.log(`      ❌ FAILED — endPrice will be SYNTHETIC RANDOM WALK`);
  }

  // LSTM analysis using real closes
  if (r2y.ok && r2y.candleCount >= 51) {
    // Re-fetch closes for LSTM analysis
    try {
      const ticker = `${sym}.NS`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
      const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
      const closes = r.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
      const lstm = analyzeLSTMFormula(closes);
      if (lstm) {
        console.log(`\n  [5] LSTM formula (endPrice * (1 + avgReturn * 10)):`);
        console.log(`      endPrice       = ₹${lstm.endPrice}`);
        console.log(`      avgDailyReturn = ${lstm.avgDailyReturn}`);
        console.log(`      lstmPredicted  = ₹${lstm.lstmPredicted}  (${lstm.impliedUpside} upside)`);
        console.log(`      ⚠️  ${lstm.note}`);
      }
    } catch (_) {}
  }

  // Final verdict
  console.log(`\n  ── VERDICT ──`);
  const priceSource = rv7.ok ? `Yahoo v7 lastPrice ₹${rv7.price}` : r2y.ok ? `OHLCV lastClose ₹${r2y.lastClose}` : 'SYNTHETIC RANDOM WALK';
  const groundTruth = rnse.ok ? rnse.lastPrice : rv8.ok ? rv8.regularMarketPrice : 'unknown';
  const isAccurate = rv7.ok && rnse.ok ? Math.abs(rv7.price - rnse.lastPrice) / rnse.lastPrice < 0.01 : null;
  console.log(`  currentPrice source : ${priceSource}`);
  console.log(`  NSE ground truth    : ₹${groundTruth}`);
  if (isAccurate !== null) {
    console.log(`  accuracy            : ${isAccurate ? '✅ within 1% of NSE' : '❌ >1% deviation from NSE'}`);
  }
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY OF ISSUES');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`
KEY FINDINGS:
  1. If Yahoo v7 returns 401 → enrichedData.yahoo = null
     → currentPrice = endPrice (OHLCV last close)
     → If OHLCV also fails → currentPrice = SYNTHETIC RANDOM WALK PRICE
     → Superbrain gets a completely fake price → fake targets

  2. lstmPredictedPrice = endPrice * (1 + avgReturn * 10)
     This is NOT a real LSTM. It's a 10-day linear extrapolation.
     If endPrice is synthetic → lstmPredicted is also synthetic.
     Even with real data, this formula is too simplistic.

  3. The enrichment cache (MarketDataAggregator) runs in background.
     On first cold start → cache is empty → all prices are synthetic.
     Only after background warm completes do real prices appear.

  4. Yahoo v7 /v7/finance/quote endpoint is rate-limited / returning 401
     on Vercel (different IP pool). This is the root cause.
`);
