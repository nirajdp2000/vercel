import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function trySymbol(sym) {
  try {
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`, {
      timeout: 8000, headers: { 'User-Agent': UA }
    });
    const meta = r.data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      return { sym, price: meta.regularMarketPrice, returned: meta.symbol };
    }
    return { sym, error: 'no price' };
  } catch(e) {
    return { sym, error: e.response?.status ?? e.message };
  }
}

// TATAMOTORS variants
const tataCandidates = ['TATAMOTORS.NS', 'TATAMOTORS.BO', 'TATAMOTOR.NS', '500570.BO'];
console.log('=== TATAMOTORS variants ===');
for (const s of tataCandidates) console.log(JSON.stringify(await trySymbol(s)));

// Check a few more common ones that might 404
const others = ['BAJFINANCE.NS', 'BAJAJFINSV.NS', 'NESTLEIND.NS', 'ULTRACEMCO.NS', 'POWERGRID.NS', 'NTPC.NS'];
console.log('\n=== Other common stocks ===');
for (const s of others) console.log(JSON.stringify(await trySymbol(s)));

// Test timing for 15 parallel fetches
console.log('\n=== Timing: 15 parallel ===');
const t0 = Date.now();
const syms = ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','SBIN.NS','WIPRO.NS',
              'AXISBANK.NS','ICICIBANK.NS','KOTAKBANK.NS','HCLTECH.NS',
              'SUNPHARMA.NS','TITAN.NS','BAJFINANCE.NS','NESTLEIND.NS','ULTRACEMCO.NS'];
const res = await Promise.all(syms.map(s => trySymbol(s)));
console.log(`15 parallel: ${Date.now()-t0}ms`);
res.forEach(r => console.log(`  ${r.sym}: ${r.price ?? r.error}`));
