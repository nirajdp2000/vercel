import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Replicate exact fetchRealOHLCV logic from server.ts
async function fetchRealOHLCV(symbol) {
  try {
    const encoded = encodeURIComponent(`${symbol}.NS`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2y`;
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': UA },
    });
    const result = resp.data?.chart?.result?.[0];
    if (!result) return { symbol, result: null, reason: 'no result' };

    const returnedSym = (result.meta?.symbol ?? '').toUpperCase().replace('.NS', '');
    if (returnedSym && returnedSym !== symbol.toUpperCase()) {
      return { symbol, result: null, reason: `symbol mismatch: got "${returnedSym}"` };
    }

    const timestamps = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0];
    if (!q || timestamps.length < 60) {
      return { symbol, result: null, reason: `insufficient data: ${timestamps.length} candles` };
    }

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null || c <= 0) continue;
      candles.push({ open: o, high: h, low: l, close: c, volume: v ?? 0 });
    }

    if (candles.length < 60) {
      return { symbol, result: null, reason: `only ${candles.length} valid candles` };
    }

    return {
      symbol,
      result: 'OK',
      candles: candles.length,
      firstClose: candles[0].close.toFixed(2),
      lastClose: candles[candles.length - 1].close.toFixed(2),
      currentPrice: result.meta?.regularMarketPrice?.toFixed(2),
      returnedSym,
    };
  } catch (e) {
    return { symbol, result: null, reason: e.message };
  }
}

// Test a mix of well-known and obscure NSE stocks
const testSymbols = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN', 'TATAMOTORS', 'WIPRO',
  'SHRINIWAS', 'LICNETFN50', 'PEARLPOLY', 'GULFPETRO', 'SURANASOL', 'AMBICAAGAR'
];

console.log('\n=== Full Pipeline Test (replicating server.ts fetchRealOHLCV) ===\n');
let realCount = 0, nullCount = 0;
for (const sym of testSymbols) {
  const r = await fetchRealOHLCV(sym);
  if (r.result === 'OK') realCount++;
  else nullCount++;
  console.log(JSON.stringify(r));
}

console.log(`\nSummary: ${realCount} real, ${nullCount} null/synthetic`);

// Now test the two-pass approach timing
console.log('\n=== Timing Test: 10 stocks in parallel ===\n');
const t0 = Date.now();
const batch = ['RELIANCE','TCS','HDFCBANK','INFY','SBIN','TATAMOTORS','WIPRO','AXISBANK','ICICIBANK','KOTAKBANK'];
const results = await Promise.all(batch.map(s => fetchRealOHLCV(s)));
console.log(`10 stocks fetched in ${Date.now() - t0}ms`);
results.forEach(r => console.log(`  ${r.symbol}: ${r.result === 'OK' ? r.lastClose : r.reason}`));
