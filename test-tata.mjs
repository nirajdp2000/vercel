import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function trySymbol(sym) {
  try {
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`, {
      timeout: 8000, headers: { 'User-Agent': UA }
    });
    const meta = r.data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) return `${meta.symbol} = ₹${meta.regularMarketPrice}`;
    return `no price`;
  } catch(e) { return `${e.response?.status ?? e.message}`; }
}

// TATAMOTORS BSE code is 500570
const variants = [
  'TATAMOTORS.NS', 'TATAMOTORS.BO', '500570.BO',
  'TATAMOTOR.NS', 'TATA.NS', 'TTM',  // TTM is NYSE ADR
];
for (const v of variants) console.log(`${v}: ${await trySymbol(v)}`);

// Also test a broader search via Yahoo search API
try {
  const r = await axios.get('https://query1.finance.yahoo.com/v1/finance/search?q=TATAMOTORS&lang=en-US&region=IN', {
    timeout: 8000, headers: { 'User-Agent': UA }
  });
  const quotes = r.data?.quotes?.slice(0,5) ?? [];
  console.log('\nSearch results:');
  quotes.forEach(q => console.log(`  ${q.symbol} - ${q.shortname} - ${q.exchange}`));
} catch(e) { console.log('search error:', e.message); }
