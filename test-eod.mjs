import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SB_URL = 'https://xtnubimeoawyjkvkkxaz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU';
const UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const sb  = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ── 1. Check / create ohlcv_cache table ──────────────────────────────────────
console.log('\n=== 1. ohlcv_cache table ===');
const { data: tblCheck, error: tblErr } = await sb.from('ohlcv_cache').select('symbol').limit(1);
if (tblErr?.code === 'PGRST205') {
  console.log('  Table MISSING — cannot create via REST. Run SQL in Supabase dashboard.');
  console.log('  SQL:\n  CREATE TABLE IF NOT EXISTS ohlcv_cache (symbol TEXT PRIMARY KEY, candles JSONB NOT NULL DEFAULT \'[]\', live_price NUMERIC, change_pct NUMERIC, fetched_at BIGINT NOT NULL DEFAULT (extract(epoch from now())*1000)::BIGINT);');
  process.exit(1);
} else if (tblErr) {
  console.log('  Error:', tblErr.message);
  process.exit(1);
} else {
  console.log('  Table EXISTS. Current rows:', tblCheck?.length ?? 0);
}

// ── 2. Fetch OHLCV for 3 test symbols ────────────────────────────────────────
console.log('\n=== 2. Yahoo v8 OHLCV fetch (range=2y) ===');
const TEST_SYMBOLS = ['RELIANCE', 'HDFCBANK', 'MUKKA'];
const fetched = [];

for (const sym of TEST_SYMBOLS) {
  const tickers = [`${sym}.NS`, `${sym}.BO`];
  let done = false;
  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
      const r = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } });
      const result = r.data?.chart?.result?.[0];
      const meta   = result?.meta;
      const q      = result?.indicators?.quote?.[0];
      const ts     = result?.timestamp ?? [];
      const candles = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q?.open?.[i], h = q?.high?.[i], l = q?.low?.[i], c = q?.close?.[i], v = q?.volume?.[i];
        if (o == null || h == null || l == null || c == null || c <= 0) continue;
        candles.push({ open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2), volume: v ?? 0 });
      }
      if (candles.length < 60) { console.log(`  ${sym} (${ticker}): only ${candles.length} candles — skip`); continue; }
      const livePrice  = meta?.regularMarketPrice ?? null;
      const prevClose  = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
      const changePct  = livePrice && prevClose ? +((livePrice - prevClose) / prevClose * 100).toFixed(2) : null;
      console.log(`  ${sym} (${ticker}): ${candles.length} candles, price=₹${livePrice}, chg=${changePct}%`);
      fetched.push({ symbol: sym, candles, live_price: livePrice, change_pct: changePct, fetched_at: Date.now() });
      done = true; break;
    } catch (e) { console.log(`  ${sym} (${ticker}): ${e.response?.status ?? e.message}`); }
  }
  if (!done) console.log(`  ${sym}: FAILED all tickers`);
}

// ── 3. Write to ohlcv_cache ───────────────────────────────────────────────────
console.log('\n=== 3. Write to Supabase ohlcv_cache ===');
for (const row of fetched) {
  const { error } = await sb.from('ohlcv_cache').upsert(row, { onConflict: 'symbol' });
  if (error) console.log(`  ${row.symbol}: FAIL — ${error.message}`);
  else       console.log(`  ${row.symbol}: OK (${row.candles.length} candles written)`);
}

// ── 4. Read back from ohlcv_cache ─────────────────────────────────────────────
console.log('\n=== 4. Read back from Supabase ===');
const { data: readBack, error: rErr } = await sb
  .from('ohlcv_cache')
  .select('symbol,live_price,change_pct,fetched_at')
  .in('symbol', TEST_SYMBOLS);
if (rErr) console.log('  Read error:', rErr.message);
else readBack?.forEach(r => console.log(`  ${r.symbol}: price=₹${r.live_price}, chg=${r.change_pct}%, fetched=${new Date(r.fetched_at).toISOString()}`));

// ── 5. Read candles back and validate ─────────────────────────────────────────
console.log('\n=== 5. Candle validation ===');
const { data: candleRows } = await sb.from('ohlcv_cache').select('symbol,candles').in('symbol', TEST_SYMBOLS);
candleRows?.forEach(r => {
  const c = Array.isArray(r.candles) ? r.candles : [];
  const last = c[c.length - 1];
  console.log(`  ${r.symbol}: ${c.length} candles, last close=₹${last?.close ?? 'N/A'}`);
});

// ── 6. fundamentals_cache check ───────────────────────────────────────────────
console.log('\n=== 6. fundamentals_cache ===');
const { data: fundRows, error: fErr } = await sb
  .from('fundamentals_cache')
  .select('symbol,pe,roe,roce,promoter_holding,last_price,fetched_at')
  .in('symbol', ['RELIANCE', 'HDFCBANK']);
if (fErr) console.log('  Error:', fErr.message);
else fundRows?.forEach(r => console.log(`  ${r.symbol}: PE=${r.pe}, ROE=${r.roe}, ROCE=${r.roce}, Promoter=${r.promoter_holding}%, price=₹${r.last_price}`));

console.log('\n=== ALL TESTS DONE ===');
