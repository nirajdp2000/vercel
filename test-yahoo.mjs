import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchOHLCV(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=2y`;
    const r = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': UA } });
    const res = r.data?.chart?.result?.[0];
    if (!res) return { symbol, error: 'no result' };
    const closes = res.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter(c => c != null && c > 0);
    return {
      symbol,
      returnedSymbol: res.meta?.symbol,
      candleCount: res.timestamp?.length,
      validCloses: validCloses.length,
      firstClose: validCloses[0]?.toFixed(2),
      lastClose: validCloses[validCloses.length - 1]?.toFixed(2),
      currentPrice: res.meta?.regularMarketPrice?.toFixed(2),
    };
  } catch (e) {
    return { symbol, error: e.message };
  }
}

// Test with known NSE stocks + some obscure ones
const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN', 'SHRINIWAS', 'LICNETFN50', 'PEARLPOLY'];

console.log('\n=== Yahoo Finance OHLCV Test ===\n');
for (const sym of symbols) {
  const result = await fetchOHLCV(sym);
  console.log(JSON.stringify(result));
}

// Also test the symbol validation logic from server.ts
console.log('\n=== Symbol Validation Test ===\n');
for (const sym of ['RELIANCE', 'SHRINIWAS']) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=2y`;
  try {
    const r = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': UA } });
    const res = r.data?.chart?.result?.[0];
    const returnedSym = (res?.meta?.symbol ?? '').toUpperCase().replace('.NS', '');
    const requestedSym = sym.toUpperCase();
    const match = returnedSym === requestedSym;
    console.log(`${sym}: returned="${returnedSym}" match=${match} price=${res?.meta?.regularMarketPrice}`);
  } catch (e) {
    console.log(`${sym}: ERROR ${e.message}`);
  }
}
