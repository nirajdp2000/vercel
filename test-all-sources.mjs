/**
 * Test ALL available free Indian stock data sources
 * Goal: find which ones work reliably without auth
 */
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SYMBOLS = ['RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'BLOOM'];

async function test(name, fn) {
  try {
    const start = Date.now();
    const result = await fn();
    console.log(`  ✅ ${name} (${Date.now()-start}ms):`, JSON.stringify(result).slice(0, 120));
    return result;
  } catch(e) {
    console.log(`  ❌ ${name}: HTTP ${e.response?.status ?? 'ERR'} — ${e.message?.slice(0,60)}`);
    return null;
  }
}

for (const sym of SYMBOLS) {
  console.log(`\n══ ${sym} ══════════════════════════════════════════════`);

  // 1. Yahoo v8 chart (proven working)
  await test('Yahoo v8 chart (NS)', async () => {
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=5d`, {timeout:5000,headers:{'User-Agent':UA}});
    const m = r.data?.chart?.result?.[0]?.meta;
    return { price: m?.regularMarketPrice, prev: m?.chartPreviousClose, state: m?.marketState };
  });

  // 2. NSE India equity quote (official, no auth)
  await test('NSE India /api/quote-equity', async () => {
    const r = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${sym}`, {
      timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json','Referer':'https://www.nseindia.com'}
    });
    const p = r.data?.priceInfo;
    return { ltp: p?.lastPrice, prev: p?.previousClose, pChange: p?.pChange?.toFixed(2) };
  });

  // 3. NSE India get-quotes (alternative endpoint)
  await test('NSE India /api/get-quotes', async () => {
    const r = await axios.get(`https://www.nseindia.com/api/get-quotes?symbol=${sym}&series=EQ`, {
      timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json','Referer':'https://www.nseindia.com'}
    });
    const d = r.data?.data?.[0];
    return { ltp: d?.lastPrice, prev: d?.previousClose };
  });

  // 4. BSE India (for BSE-listed stocks)
  await test('BSE India scrip', async () => {
    const r = await axios.get(`https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=&Scripcode=&ISIN=&industry=&segment=Equity&scrip=${sym}`, {
      timeout:5000, headers:{'User-Agent':UA,'Referer':'https://www.bseindia.com'}
    });
    return r.data?.Header ? { price: r.data.Header.CurrRate } : null;
  });

  // 5. Groww API (public, no auth)
  await test('Groww API', async () => {
    const r = await axios.get(`https://groww.in/v1/api/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc?name=${sym}`, {
      timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json'}
    });
    return r.data ? { ltp: r.data.ltp ?? r.data.close } : null;
  });

  // 6. Screener.in company page (JSON endpoint)
  await test('Screener.in JSON', async () => {
    const r = await axios.get(`https://www.screener.in/api/company/${sym}/`, {
      timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json','Referer':'https://www.screener.in'}
    });
    return r.data ? { name: r.data.name, bseCode: r.data.bse_code, nseCode: r.data.nse_code } : null;
  });

  // 7. Monecontrol (public quote)
  await test('Moneycontrol quote', async () => {
    const r = await axios.get(`https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${sym}`, {
      timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json','Referer':'https://www.moneycontrol.com'}
    });
    const d = r.data?.data;
    return d ? { price: d.pricecurrent, prev: d.priceclose } : null;
  });

  // 8. Upstox market quote (no auth — public endpoint)
  await test('Upstox public quote (no auth)', async () => {
    const r = await axios.get(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_EQ%7C${sym}`, {
      timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json'}
    });
    return r.data?.data ? { ltp: Object.values(r.data.data)[0]?.last_price } : null;
  });

  // 9. Alpha Vantage (free tier, no key needed for some)
  await test('Alpha Vantage (no key)', async () => {
    const r = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}.BSE&apikey=demo`, {
      timeout:5000, headers:{'User-Agent':UA}
    });
    const q = r.data?.['Global Quote'];
    return q?.['05. price'] ? { price: q['05. price'] } : null;
  });

  // 10. Yahoo Finance v8 with crumb (try without crumb first)
  await test('Yahoo v8 2y OHLCV last close', async () => {
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=2y`, {
      timeout:5000, headers:{'User-Agent':UA}
    });
    const result = r.data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
    const ts = result?.timestamp ?? [];
    return {
      lastClose: closes.at(-1)?.toFixed(2),
      lastDate: ts.at(-1) ? new Date(ts.at(-1)*1000).toISOString().split('T')[0] : null,
      count: closes.length
    };
  });
}

console.log('\n\n══ CHECKING BLOOM SPECIFICALLY (BSE small-cap) ══════════');
// BLOOM is likely BSE-only, not on NSE
await test('Yahoo BLOOM.BO', async () => {
  const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/BLOOM.BO?interval=1d&range=5d`, {timeout:5000,headers:{'User-Agent':UA}});
  const m = r.data?.chart?.result?.[0]?.meta;
  return { price: m?.regularMarketPrice, symbol: m?.symbol };
});
await test('Yahoo BLOOM.NS', async () => {
  const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/BLOOM.NS?interval=1d&range=5d`, {timeout:5000,headers:{'User-Agent':UA}});
  const m = r.data?.chart?.result?.[0]?.meta;
  return { price: m?.regularMarketPrice, symbol: m?.symbol };
});
await test('NSE BLOOM', async () => {
  const r = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=BLOOM`, {
    timeout:5000, headers:{'User-Agent':UA,'Accept':'application/json','Referer':'https://www.nseindia.com'}
  });
  return { ltp: r.data?.priceInfo?.lastPrice };
});
