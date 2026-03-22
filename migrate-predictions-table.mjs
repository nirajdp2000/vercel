import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtnubimeoawyjkvkkxaz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Add missing columns via Supabase SQL RPC
const { error } = await sb.rpc('exec_sql', {
  sql: `
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS current_price FLOAT;
    ALTER TABLE predictions ADD COLUMN IF NOT EXISTS sector TEXT;
  `
});

if (error) {
  console.log('RPC not available, trying direct insert workaround:', error.message);
} else {
  console.log('Columns added successfully');
}

// Verify by inserting a test row
const today = new Date().toISOString().split('T')[0];
const { error: insErr } = await sb.from('predictions').insert({
  stock_symbol: 'VERIFY_TEST',
  prediction_date: today,
  target_date: today,
  prediction: 'Bullish',
  confidence: 75,
  predicted_price: 100.0,
  current_price: 98.5,
  sector: 'Technology',
  signals: { RSI: 0.3, MACD: 0.2, Volume: 0.1, Trend: 0.4, Sentiment: 0.2, Bollinger: 0.1, Stochastic: 0.3, Acceleration: 0.1, ATR: 2.5 },
  explanation: 'Verify test',
  created_at: Date.now(),
});
console.log('Verify insert:', insErr ? `FAIL: ${insErr.message}` : 'OK - columns exist');
await sb.from('predictions').delete().eq('stock_symbol', 'VERIFY_TEST');
