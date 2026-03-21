// Creates the stock_universe cache table in Supabase
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://xtnubimeoawyjkvkkxaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU',
  { auth: { persistSession: false } }
);

// Check if table exists
const { data, error } = await sb.from('stock_universe').select('symbol').limit(1);
if (!error) {
  console.log('✅ stock_universe table already exists');
  process.exit(0);
}

console.log('Table missing. Please run this SQL in Supabase SQL Editor:');
console.log(`
create table if not exists stock_universe (
  id            serial primary key,
  symbol        text not null,
  name          text not null,
  exchange      text not null,
  sector        text not null,
  industry      text not null,
  market_cap    bigint not null default 0,
  avg_volume    bigint not null default 0,
  instrument_key text not null,
  updated_at    bigint not null
);
create unique index if not exists idx_universe_symbol_exchange on stock_universe(symbol, exchange);
create index if not exists idx_universe_symbol on stock_universe(symbol);
`);
