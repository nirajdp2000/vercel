import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Try query2 instead of query1
async function tryQ2(sym) {
  try {
    const r = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`, {
      timeout: 8000, headers: { 'User-Agent': UA }
    });
    const meta = r.data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) return `${meta.symbol} = ₹${meta.regularMarketPrice}`;
    return `no price (${r.data?.chart?.error?.code})`;
  } catch(e) { return `${e.response?.status ?? e.message}`; }
}

const variants = ['TATAMOTORS.NS', 'TATAMOTORS.BO', 'MARUTI.NS', 'BAJAJ-AUTO.NS', 'BAJAJ_AUTO.NS'];
console.log('=== query2 test ===');
for (const v of variants) console.log(`${v}: ${await tryQ2(v)}`);

// Try v10 endpoint
async function tryV10(sym) {
  try {
    const r = await axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=price`, {
      timeout: 8000, headers: { 'User-Agent': UA }
    });
    const price = r.data?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
    return price ? `₹${price}` : 'no price';
  } catch(e) { return `${e.response?.status ?? e.message}`; }
}

console.log('\n=== v10 quoteSummary test ===');
for (const v of ['TATAMOTORS.NS', 'TATAMOTORS.BO', 'MARUTI.NS']) {
  console.log(`${v}: ${await tryV10(v)}`);
}
