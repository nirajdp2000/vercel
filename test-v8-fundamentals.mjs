/**
 * Verify the fixed fetchYahooFundamentals (v8 chart API) returns real prices
 */
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const SYMBOLS = ['RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'WIPRO', 'TATAMOTORS', 'BAJFINANCE'];

async function fetchYahooFundamentalsV8(symbol) {
  const tickers = [`${symbol}.NS`, `${symbol}.BO`];
  for (const ticker of tickers) {
    try {
      const encoded = encodeURIComponent(ticker);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1y&includePrePost=false`;
      const resp = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
      const result = resp.data?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta?.regularMarketPrice) continue;

      const returnedBase = (meta.symbol ?? '').toUpperCase().replace(/\.(NS|BO)$/, '');
      if (returnedBase && returnedBase !== symbol.toUpperCase()) continue;

      const highs  = result.indicators?.quote?.[0]?.high?.filter(v => v != null) ?? [];
      const lows   = result.indicators?.quote?.[0]?.low?.filter(v => v != null) ?? [];
      const closes = result.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? [];

      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      const pChange = prevClose && prevClose > 0
        ? ((meta.regularMarketPrice - prevClose) / prevClose * 100).toFixed(2)
        : null;

      return {
        ok: true,
        ticker,
        lastPrice: meta.regularMarketPrice.toFixed(2),
        pChange: pChange ? `${pChange}%` : 'N/A',
        weekHigh52: highs.length > 0 ? Math.max(...highs).toFixed(2) : 'N/A',
        weekLow52:  lows.length  > 0 ? Math.min(...lows).toFixed(2)  : 'N/A',
        candleCount: closes.length,
      };
    } catch (e) {
      continue;
    }
  }
  return { ok: false };
}

async function fetchNSE(symbol) {
  try {
    const r = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
      timeout: 6000, headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.nseindia.com' },
    });
    const p = r.data?.priceInfo;
    return p ? { lastPrice: p.lastPrice, pChange: p.pChange?.toFixed(2) } : null;
  } catch { return null; }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FIXED: Yahoo v8 as fundamentals source (replaces v7 401)');
console.log('═══════════════════════════════════════════════════════════\n');

for (const sym of SYMBOLS) {
  const [yb, nse] = await Promise.all([fetchYahooFundamentalsV8(sym), fetchNSE(sym)]);
  if (yb.ok) {
    const diff = nse ? Math.abs(parseFloat(yb.lastPrice) - nse.lastPrice) / nse.lastPrice * 100 : null;
    const accurate = diff !== null ? diff < 1.0 : null;
    console.log(`${sym.padEnd(14)} Yahoo v8: ₹${yb.lastPrice.padStart(8)}  NSE: ₹${String(nse?.lastPrice ?? 'N/A').padStart(8)}  diff: ${diff?.toFixed(2) ?? 'N/A'}%  ${accurate === true ? '✅' : accurate === false ? '❌' : '?'}  52W: ₹${yb.weekLow52}–₹${yb.weekHigh52}  candles: ${yb.candleCount}`);
  } else {
    console.log(`${sym.padEnd(14)} ❌ FAILED`);
  }
}
