/**
 * Deep price tally: Yahoo Finance v8 API vs Upstox v3 API
 * Tests 5 liquid NSE stocks and compares prices from both sources.
 * Also validates the OHLCV candle data quality.
 */
import axios from 'axios';

const SYMBOLS = ['RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'ICICIBANK'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ── Yahoo Finance v8 quote ──────────────────────────────────────────────────
async function yahooQuote(symbol) {
  const ticker = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  try {
    const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
    const result = r.data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return { error: 'no meta' };

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const lastClose = closes.filter(Boolean).at(-1);

    return {
      source: 'yahoo',
      symbol: meta.symbol,
      regularMarketPrice: meta.regularMarketPrice,
      chartPreviousClose: meta.chartPreviousClose,
      previousClose: meta.previousClose,
      lastOHLCVClose: lastClose,
      currency: meta.currency,
      exchangeName: meta.exchangeName,
      marketState: meta.marketState,
      candleCount: closes.filter(Boolean).length,
      lastTimestamp: timestamps.at(-1) ? new Date(timestamps.at(-1) * 1000).toISOString() : null,
      pChange: meta.regularMarketChangePercent?.toFixed(2),
    };
  } catch (e) {
    return { error: e.message, status: e.response?.status };
  }
}

// ── Yahoo Finance v7 quote (alternative endpoint) ──────────────────────────
async function yahooV7Quote(symbol) {
  const ticker = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
  try {
    const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
    const q = r.data?.quoteResponse?.result?.[0];
    if (!q) return { error: 'no result' };
    return {
      source: 'yahoo_v7',
      symbol: q.symbol,
      regularMarketPrice: q.regularMarketPrice,
      regularMarketPreviousClose: q.regularMarketPreviousClose,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      marketCap: q.marketCap,
      trailingPE: q.trailingPE,
      marketState: q.marketState,
    };
  } catch (e) {
    return { error: e.message, status: e.response?.status };
  }
}

// ── Upstox v3 LTP (requires valid token) ───────────────────────────────────
async function upstoxLTP(symbol, token) {
  if (!token) return { error: 'no token' };
  // Upstox instrument key format: NSE_EQ|ISIN or NSE_EQ|SYMBOL
  // Using symbol-based key
  const instrumentKey = `NSE_EQ|${symbol}`;
  const url = `https://api.upstox.com/v3/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`;
  try {
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 5000,
    });
    const data = r.data?.data;
    const key = Object.keys(data ?? {})[0];
    const q = data?.[key];
    return {
      source: 'upstox',
      ltp: q?.last_price,
      prevClose: q?.cp,
      change: q?.net_change,
      changePct: q?.net_change_percentage,
    };
  } catch (e) {
    return { error: e.message, status: e.response?.status };
  }
}

// ── NSE India direct (no auth needed, public) ──────────────────────────────
async function nseQuote(symbol) {
  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
  try {
    const r = await axios.get(url, {
      timeout: 6000,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com',
      },
    });
    const d = r.data?.priceInfo;
    return {
      source: 'nse_direct',
      lastPrice: d?.lastPrice,
      previousClose: d?.previousClose,
      change: d?.change,
      pChange: d?.pChange,
      open: d?.open,
      high: d?.intraDayHighLow?.max,
      low: d?.intraDayHighLow?.min,
    };
  } catch (e) {
    return { error: e.message, status: e.response?.status };
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const UPSTOX_TOKEN = process.env.UPSTOX_ACCESS_TOKEN || '';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  PRICE DATA TALLY: Yahoo Finance vs Upstox vs NSE Direct');
console.log('═══════════════════════════════════════════════════════════\n');

for (const sym of SYMBOLS) {
  console.log(`\n── ${sym} ──────────────────────────────────────────`);

  const [yv8, yv7, upstox, nse] = await Promise.allSettled([
    yahooQuote(sym),
    yahooV7Quote(sym),
    upstoxLTP(sym, UPSTOX_TOKEN),
    nseQuote(sym),
  ]);

  const r8   = yv8.status   === 'fulfilled' ? yv8.value   : { error: yv8.reason };
  const r7   = yv7.status   === 'fulfilled' ? yv7.value   : { error: yv7.reason };
  const rUp  = upstox.status === 'fulfilled' ? upstox.value : { error: upstox.reason };
  const rNse = nse.status   === 'fulfilled' ? nse.value   : { error: nse.reason };

  console.log('Yahoo v8 (chart API):');
  if (r8.error) {
    console.log(`  ❌ Error: ${r8.error} (HTTP ${r8.status ?? 'N/A'})`);
  } else {
    console.log(`  regularMarketPrice : ₹${r8.regularMarketPrice}`);
    console.log(`  lastOHLCVClose     : ₹${r8.lastOHLCVClose}`);
    console.log(`  chartPreviousClose : ₹${r8.chartPreviousClose}`);
    console.log(`  pChange            : ${r8.pChange}%`);
    console.log(`  marketState        : ${r8.marketState}`);
    console.log(`  lastCandleDate     : ${r8.lastTimestamp}`);
    console.log(`  candleCount(5d)    : ${r8.candleCount}`);
    console.log(`  currency           : ${r8.currency} | exchange: ${r8.exchangeName}`);
  }

  console.log('Yahoo v7 (quote API):');
  if (r7.error) {
    console.log(`  ❌ Error: ${r7.error} (HTTP ${r7.status ?? 'N/A'})`);
  } else {
    console.log(`  regularMarketPrice : ₹${r7.regularMarketPrice}`);
    console.log(`  prevClose          : ₹${r7.regularMarketPreviousClose}`);
    console.log(`  52W High/Low       : ₹${r7.fiftyTwoWeekHigh} / ₹${r7.fiftyTwoWeekLow}`);
    console.log(`  PE                 : ${r7.trailingPE}`);
    console.log(`  marketState        : ${r7.marketState}`);
  }

  console.log('Upstox v3:');
  if (rUp.error) {
    console.log(`  ❌ Error: ${rUp.error} (HTTP ${rUp.status ?? 'N/A'})`);
  } else {
    console.log(`  LTP                : ₹${rUp.ltp}`);
    console.log(`  prevClose          : ₹${rUp.prevClose}`);
    console.log(`  change%            : ${rUp.changePct?.toFixed(2)}%`);
  }

  console.log('NSE Direct:');
  if (rNse.error) {
    console.log(`  ❌ Error: ${rNse.error} (HTTP ${rNse.status ?? 'N/A'})`);
  } else {
    console.log(`  lastPrice          : ₹${rNse.lastPrice}`);
    console.log(`  previousClose      : ₹${rNse.previousClose}`);
    console.log(`  pChange            : ${rNse.pChange}%`);
  }

  // Price delta analysis
  const prices = [
    r8.regularMarketPrice,
    r7.regularMarketPrice,
    rUp.ltp,
    rNse.lastPrice,
  ].filter(p => p != null && p > 0);

  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = ((max - min) / min * 100).toFixed(2);
    console.log(`\n  📊 Price spread across sources: ${spread}% (min ₹${min}, max ₹${max})`);
    if (parseFloat(spread) > 1) {
      console.log(`  ⚠️  DISCREPANCY > 1% — data sources disagree!`);
    } else {
      console.log(`  ✅ Sources agree within 1%`);
    }
  }
}

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  SUPERBRAIN TARGET PRICE LOGIC ANALYSIS');
console.log('═══════════════════════════════════════════════════════════');
console.log(`
The Superbrain computePriceTargets() formula:
  annualReturn = (cagr / 100) * (superScore / 60)
  holdMonths   = superScore >= 70 ? 12 : superScore >= 55 ? 9 : 6
  targetPrice  = currentPrice * (1 + annualReturn * holdMonths / 12)

PROBLEM IDENTIFIED:
  If cagr = 25% and superScore = 75:
    annualReturn = 0.25 * (75/60) = 0.3125  (31.25% annual)
    holdMonths   = 12
    targetPrice  = currentPrice * 1.3125  (+31% in 12 months)

  If cagr = 80% (synthetic/inflated) and superScore = 80:
    annualReturn = 0.80 * (80/60) = 1.067  (106% annual!)
    holdMonths   = 12
    targetPrice  = currentPrice * 2.067  (+107% — UNREALISTIC)

ROOT CAUSES OF FAKE-LOOKING DATA:
  1. CAGR is computed from synthetic candles (random walk) when Yahoo fails
     → inflated CAGR (40-120%) → inflated target prices
  2. currentPrice from Yahoo v8 uses regularMarketPrice (delayed 15min)
     → may differ from real-time Upstox LTP
  3. Yahoo v8 chart API sometimes returns stale/cached data
  4. No cross-validation between Yahoo price and OHLCV last close
  5. Superbrain target formula uses CAGR directly — synthetic CAGR = garbage in, garbage out
`);
