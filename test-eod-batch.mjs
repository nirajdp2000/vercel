import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU';
const UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const sb  = createClient('https://xtnubimeoawyjkvkkxaz.supabase.co', SB_KEY, { auth: { persistSession: false } });

// Top 20 Nifty symbols
const SYMBOLS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','SBIN','BHARTIARTL','ITC',
  'KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','SUNPHARMA','TITAN',
  'BAJFINANCE','HCLTECH','WIPRO','TATAMOTORS','NTPC'
];

const OVERRIDES = { 'TATAMOTORS': 'TATAMOTORS.BO', 'M&M': 'M%26M.NS' };
const results = { ok: 0, fail: 0, totalCandles: 0 };
const start = Date.now();

console.log(`\nEOD Batch test — ${SYMBOLS.length} symbols, batch=10\n`);

// Batch of 10 at a time
const BATCH = 10;
for (let i = 0; i < SYMBOLS.length; i += BATCH) {
  const batch = SYMBOLS.slice(i, i + BATCH);
  console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.join(', ')}`);

  await Promise.allSettled(batch.map(async sym => {
    const override = OVERRIDES[sym];
    const tickers = override ? [override, `${sym}.NS`, `${sym}.BO`] : [`${sym}.NS`, `${sym}.BO`];
    for (const ticker of tickers) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
        const r = await axios.get(url, { timeout: 5000, headers: { 'User-Agent': UA } });
        const result = r.data?.chart?.result?.[0];
        const meta = result?.meta;
        const q = result?.indicators?.quote?.[0];
        const ts = result?.timestamp ?? [];
        const candles = [];
        for (let j = 0; j < ts.length; j++) {
          const o = q?.open?.[j], h = q?.high?.[j], l = q?.low?.[j], c = q?.close?.[j], v = q?.volume?.[j];
          if (o == null || h == null || l == null || c == null || c <= 0) continue;
          candles.push({ open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2), volume: v ?? 0 });
        }
        if (candles.length < 60) continue;
        const livePrice = meta?.regularMarketPrice ?? null;
        const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
        const changePct = livePrice && prevClose ? +((livePrice - prevClose) / prevClose * 100).toFixed(2) : null;

        const { error } = await sb.from('ohlcv_cache').upsert(
          { symbol: sym, candles, live_price: livePrice, change_pct: changePct, fetched_at: Date.now() },
          { onConflict: 'symbol' }
        );
        if (error) { console.log(`  ✗ ${sym}: ${error.message}`); results.fail++; }
        else { console.log(`  ✓ ${sym}: ${candles.length} candles, ₹${livePrice} (${changePct}%)`); results.ok++; results.totalCandles += candles.length; }
        return;
      } catch (e) { /* try next ticker */ }
    }
    console.log(`  ✗ ${sym}: all tickers failed`);
    results.fail++;
  }));

  if (i + BATCH < SYMBOLS.length) await new Promise(r => setTimeout(r, 500));
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n=== DONE in ${elapsed}s ===`);
console.log(`OK: ${results.ok}/${SYMBOLS.length} | Failed: ${results.fail} | Total candles: ${results.totalCandles}`);

// Verify read-back from Supabase
const { data, error } = await sb.from('ohlcv_cache').select('symbol,live_price,change_pct').in('symbol', SYMBOLS);
console.log(`\nSupabase read-back: ${data?.length ?? 0} rows`);
data?.slice(0, 5).forEach(r => console.log(`  ${r.symbol}: ₹${r.live_price} (${r.change_pct}%)`));
