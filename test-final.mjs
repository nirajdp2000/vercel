import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Replicate exact new fetchRealOHLCV logic
async function fetchRealOHLCV(symbol) {
  const tickers = [`${symbol}.NS`, `${symbol}.BO`];
  for (const ticker of tickers) {
    try {
      const encoded = encodeURIComponent(ticker);
      const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2y`, {
        timeout: 8000, headers: { 'User-Agent': UA }
      });
      const result = r.data?.chart?.result?.[0];
      if (!result) continue;
      const returnedBase = (result.meta?.symbol ?? '').toUpperCase().replace(/\.(NS|BO)$/, '');
      const requestedBase = symbol.toUpperCase();
      if (returnedBase && returnedBase !== requestedBase) continue;
      const q = result.indicators?.quote?.[0];
      const timestamps = result.timestamp ?? [];
      if (!q || timestamps.length < 60) continue;
      const candles = [];
      for (let i = 0; i < timestamps.length; i++) {
        const c = q.close?.[i];
        if (c != null && c > 0) candles.push(c);
      }
      if (candles.length < 60) continue;
      return { symbol, ticker, candles: candles.length, lastClose: candles[candles.length-1].toFixed(2), currentPrice: result.meta?.regularMarketPrice?.toFixed(2) };
    } catch(_e) { continue; }
  }
  return { symbol, result: 'FAILED - no data on NS or BO' };
}

// Test all the stocks that were showing wrong prices in the screenshot
const stocks = [
  'SHRINIWAS','LICNETFN50','PEARLPOLY','GULFPETRO','SURANASOL',
  'AMBICAAGAR','RAJKOTINV','SPRAYKING','SKYLMILAR',
  'TATAMOTORS','RELIANCE','TCS','HDFCBANK','SBIN','WIPRO','INFY'
];

console.log('=== Final Test: NS→BO fallback ===\n');
const t0 = Date.now();
const results = await Promise.all(stocks.map(s => fetchRealOHLCV(s)));
console.log(`All ${stocks.length} fetched in ${Date.now()-t0}ms\n`);
let real=0, failed=0;
for (const r of results) {
  if (r.result) { failed++; console.log(`❌ ${r.symbol}: ${r.result}`); }
  else { real++; console.log(`✅ ${r.symbol} via ${r.ticker}: ₹${r.currentPrice} (${r.candles} candles)`); }
}
console.log(`\nReal: ${real}/${stocks.length}, Failed: ${failed}/${stocks.length}`);
