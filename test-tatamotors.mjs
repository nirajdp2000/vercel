import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Test various symbol formats for TATAMOTORS
const variants = ['TATAMOTORS', 'TATA MOTORS', 'TATAMTR'];
for (const sym of variants) {
  try {
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=5d`, {
      timeout: 8000, headers: { 'User-Agent': UA }
    });
    const meta = r.data?.chart?.result?.[0]?.meta;
    console.log(`${sym}.NS -> symbol:${meta?.symbol} price:${meta?.regularMarketPrice}`);
  } catch(e) {
    console.log(`${sym}.NS -> ${e.response?.status ?? e.message}`);
  }
}

// Also check without .NS
try {
  const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/TATAMOTORS.NS?interval=1d&range=5d`, {
    timeout: 8000, headers: { 'User-Agent': UA }
  });
  console.log('raw status:', r.status, 'chart error:', r.data?.chart?.error);
} catch(e) {
  console.log('error status:', e.response?.status, 'data:', JSON.stringify(e.response?.data)?.slice(0,200));
}
