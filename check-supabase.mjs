// Quick test: verify Supabase stock_universe table has data
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtnubimeoawyjkvkkxaz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Fetch with correct column name
const { data, error } = await supabase
  .from('stock_universe')
  .select('symbol,name,exchange,sector,industry,market_cap,avg_volume,instrument_key')
  .range(0, 4);

console.log('Sample rows:', JSON.stringify(data, null, 2));
if (error) console.log('Fetch error:', error.message);

// Count all pages
let total = 0, from = 0;
while (true) {
  const { data: page, error: e } = await supabase
    .from('stock_universe')
    .select('symbol')
    .range(from, from + 999);
  if (e || !page || page.length === 0) break;
  total += page.length;
  from += 1000;
  if (page.length < 1000) break;
}
console.log('Total loaded via pagination:', total);
