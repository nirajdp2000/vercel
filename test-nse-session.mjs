/**
 * NSE India requires a session cookie — test with proper session init
 * Also test Moneycontrol more carefully
 */
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// NSE requires visiting homepage first to get cookies
async function nseWithSession(symbol) {
  try {
    // Step 1: Get session cookie
    const session = await axios.get('https://www.nseindia.com', {
      timeout: 5000,
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }
    });
    const cookies = session.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') ?? '';

    // Step 2: Use cookie for API call
    const r = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
      timeout: 5000,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com',
        'Cookie': cookies,
      }
    });
    const p = r.data?.priceInfo;
    return p?.lastPrice ? { ltp: p.lastPrice, prev: p.previousClose, pChange: p.pChange?.toFixed(2), high: p.intraDayHighLow?.max, low: p.intraDayHighLow?.min } : { raw: JSON.stringify(r.data).slice(0,200) };
  } catch(e) {
    return { error: e.message?.slice(0,80), status: e.response?.status };
  }
}

// Moneycontrol — find correct endpoint
async function moneycontrol(symbol) {
  const endpoints = [
    `https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${symbol}`,
    `https://priceapi.moneycontrol.com/pricefeed/bse/equitycash/${symbol}`,
    `https://api.moneycontrol.com/mcapi/v1/stock/get-stock-price?scId=${symbol}&exchange=N`,
  ];
  for (const url of endpoints) {
    try {
      const r = await axios.get(url, { timeout:5000, headers:{'User-Agent':UA,'Referer':'https://www.moneycontrol.com'} });
      const d = r.data?.data ?? r.data;
      if (d?.pricecurrent || d?.lastPrice || d?.ltp) {
        return { url, price: d.pricecurrent ?? d.lastPrice ?? d.ltp };
      }
    } catch(e) { /* try next */ }
  }
  return null;
}

// BSE India — find correct endpoint
async function bseIndia(symbol) {
  // BSE uses numeric scrip codes — need to search first
  const endpoints = [
    `https://api.bseindia.com/BseIndiaAPI/api/StockReachGraph/w?scripcode=&flag=0&fromdate=&todate=&seriesid=`,
    `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=&Scripcode=&ISIN=&industry=&segment=Equity&scrip=${symbol}`,
    `https://api.bseindia.com/BseIndiaAPI/api/QuotesScrip/w?scripcode=&flag=0&seriesid=EQ&scripname=${symbol}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await axios.get(url, { timeout:5000, headers:{'User-Agent':UA,'Referer':'https://www.bseindia.com'} });
      if (r.data && Object.keys(r.data).length > 0) {
        return { url: url.slice(0,60), data: JSON.stringify(r.data).slice(0,150) };
      }
    } catch(e) { /* try next */ }
  }
  return null;
}

// Stooq (free, no auth, global)
async function stooq(symbol) {
  try {
    const r = await axios.get(`https://stooq.com/q/l/?s=${symbol}.ns&f=sd2t2ohlcv&h&e=csv`, {
      timeout:5000, headers:{'User-Agent':UA}
    });
    const lines = r.data?.split('\n') ?? [];
    const data = lines[1]?.split(',');
    return data?.length >= 6 ? { symbol: data[0], date: data[1], close: data[6] } : null;
  } catch(e) { return { error: e.message?.slice(0,60) }; }
}

// Twelve Data (free tier — 8 req/min, no key for basic)
async function twelveData(symbol) {
  try {
    const r = await axios.get(`https://api.twelvedata.com/price?symbol=${symbol}:NSE&apikey=demo`, {
      timeout:5000, headers:{'User-Agent':UA}
    });
    return r.data?.price ? { price: r.data.price } : { raw: JSON.stringify(r.data).slice(0,100) };
  } catch(e) { return { error: e.message?.slice(0,60) }; }
}

const SYMBOLS = ['RELIANCE', 'HDFCBANK', 'BLOOM', 'TCS'];

console.log('\n═══ NSE with session cookie ═══');
for (const s of SYMBOLS) {
  const r = await nseWithSession(s);
  console.log(`  ${s.padEnd(12)}: ${JSON.stringify(r)}`);
}

console.log('\n═══ Moneycontrol ═══');
for (const s of SYMBOLS) {
  const r = await moneycontrol(s);
  console.log(`  ${s.padEnd(12)}: ${JSON.stringify(r)}`);
}

console.log('\n═══ BSE India ═══');
for (const s of SYMBOLS) {
  const r = await bseIndia(s);
  console.log(`  ${s.padEnd(12)}: ${JSON.stringify(r)}`);
}

console.log('\n═══ Stooq ═══');
for (const s of SYMBOLS) {
  const r = await stooq(s);
  console.log(`  ${s.padEnd(12)}: ${JSON.stringify(r)}`);
}

console.log('\n═══ Twelve Data ═══');
for (const s of SYMBOLS) {
  const r = await twelveData(s);
  console.log(`  ${s.padEnd(12)}: ${JSON.stringify(r)}`);
}
