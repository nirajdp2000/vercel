import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtnubimeoawyjkvkkxaz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const today = new Date().toISOString().split('T')[0];

// Simulate exactly what saveAllPredictions now sends (no current_price/sector top-level)
const rows = [
  {
    stock_symbol: 'LLOYDSENGG',
    prediction_date: today,
    target_date: today,
    prediction: 'Bullish',
    confidence: 95,
    predicted_price: 2048,
    signals: { RSI: 1, MACD: 0.516, Volume: 0.205, Trend: 1, Sentiment: 0.894, Bollinger: 1, Stochastic: 1, Acceleration: 0.561, ATR: 26.24, current_price: 2027.01, sector: 'Diversified' },
    explanation: 'Bullish — RSI 86 strong, MACD bullish, EMA aligned up, BB breakout up',
    created_at: Date.now(),
  },
  {
    stock_symbol: 'BDL',
    prediction_date: today,
    target_date: today,
    prediction: 'Bearish',
    confidence: 95,
    predicted_price: 584.91,
    signals: { RSI: -1, MACD: -0.111, Volume: 0, Trend: -1, Sentiment: -0.81, Bollinger: -0.78, Stochastic: -1, Acceleration: -0.946, ATR: 10.8, current_price: 593.55, sector: 'Diversified' },
    explanation: 'Bearish — RSI 20 oversold, MACD bearish, EMA aligned down',
    created_at: Date.now(),
  }
];

// Delete first
await sb.from('predictions').delete().eq('prediction_date', today);
console.log('Deleted existing rows for', today);

// Insert
const { error } = await sb.from('predictions').insert(rows);
console.log('Batch insert:', error ? `FAIL: ${error.message}` : 'OK');

// Read back
const { data, error: qErr } = await sb.from('predictions').select('*').eq('prediction_date', today);
console.log('Read back:', qErr ? `FAIL: ${qErr.message}` : `${data.length} rows`);
if (data?.length) {
  console.log('Sample row:', JSON.stringify(data[0], null, 2));
  console.log('current_price from signals:', data[0].signals?.current_price);
  console.log('sector from signals:', data[0].signals?.sector);
}

// Cleanup
await sb.from('predictions').delete().eq('prediction_date', today);
console.log('Cleanup done');
