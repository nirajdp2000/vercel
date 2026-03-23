import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function trySymbol(sym) {
  try {
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`, {
      timeout: 8000, headers: { 'User-Agent': UA }
    });
    const meta = r.data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) return { sym, price: meta.regularMarketPrice, returned: meta.symbol };
    return { sym, error: 'no price' };
  } catch(e) { return { sym, error: e.response?.status ?? e.message }; }
}

// Stocks that failed with .NS — test .BO and BSE codes
const failedStocks = ['TATAMOTORS', 'SHRINIWAS', 'RAJKOTINV', 'SKYLMILAR', 'SPRAYKING', 'AMBICAAGAR', 'SURANASOL', 'GULFPETRO'];

console.log('=== Testing .NS vs .BO fallback ===');
for (const s of failedStocks) {
  const ns = await trySymbol(`${s}.NS`);
  const bo = await trySymbol(`${s}.BO`);
  console.log(`${s}: NS=${ns.price ?? ns.error}  BO=${bo.price ?? bo.error}`);
}

// Also test known working ones to confirm
console.log('\n=== Confirming working stocks ===');
const working = ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','TATAMOTORS.NS','BAJFINANCE.NS','MARUTI.NS','ADANIENT.NS'];
for (const s of working) {
  const r = await trySymbol(s);
  console.log(`${s}: ${r.price ?? r.error}`);
}
