/**
 * One-time script: fetches full NSE+BSE universe from Upstox CDN
 * and seeds it into Supabase so Vercel cold starts are instant.
 * Run: node _seed-universe.mjs
 */
import axios from 'axios';
import zlib from 'zlib';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

const gunzip = promisify(zlib.gunzip);
const sb = createClient(
  'https://xtnubimeoawyjkvkkxaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU',
  { auth: { persistSession: false } }
);

const BSE_EQUITY_TYPES = new Set(['A','B','X','XT','T','M','MT','Z','ZP','P','MS','R']);

const SECTOR_HINTS = [
  ['HDFCBANK','Financials','Private Bank'],['ICICIBANK','Financials','Private Bank'],
  ['KOTAKBANK','Financials','Private Bank'],['AXISBANK','Financials','Private Bank'],
  ['SBIN','Financials','Public Bank'],['TCS','Technology','IT Services'],
  ['INFY','Technology','IT Services'],['WIPRO','Technology','IT Services'],
  ['RELIANCE','Energy','Oil & Gas'],['ONGC','Energy','Oil & Gas'],
  ['SUNPHARMA','Healthcare','Pharma'],['CIPLA','Healthcare','Pharma'],
  ['HINDUNILVR','Consumer','FMCG'],['ITC','Consumer','FMCG'],
  ['MARUTI','Auto','Passenger Vehicles'],['TATAMOTORS','Auto','Commercial Vehicles'],
  ['JSWSTEEL','Materials','Steel'],['TATASTEEL','Materials','Steel'],
  ['NTPC','Utilities','Power Generation'],['LT','Industrials','Engineering'],
];

function guessSector(symbol) {
  const up = symbol.toUpperCase();
  for (const [prefix, sector, industry] of SECTOR_HINTS) {
    if (up === prefix || up.startsWith(prefix)) return [sector, industry];
  }
  if (up.includes('BANK') || up.includes('FIN')) return ['Financials','Banking'];
  if (up.includes('PHARMA') || up.includes('CHEM')) return ['Healthcare','Pharma'];
  if (up.includes('TECH') || up.includes('SOFT')) return ['Technology','IT Services'];
  if (up.includes('POWER') || up.includes('ENERGY')) return ['Utilities','Power'];
  if (up.includes('STEEL') || up.includes('METAL')) return ['Materials','Metals'];
  if (up.includes('AUTO') || up.includes('MOTOR')) return ['Auto','Auto'];
  return ['Diversified','Diversified'];
}

async function fetchAndParse(url, filterFn) {
  console.log('Fetching', url);
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  let data;
  try { data = JSON.parse((await gunzip(Buffer.from(r.data))).toString('utf8')); }
  catch { data = JSON.parse(Buffer.from(r.data).toString('utf8')); }
  return data.filter(filterFn);
}

async function main() {
  // Check table exists
  const { error: te } = await sb.from('stock_universe').select('symbol').limit(1);
  if (te) {
    console.error('❌ stock_universe table not found. Create it first in Supabase SQL Editor.');
    process.exit(1);
  }

  const [nse, bse] = await Promise.all([
    fetchAndParse(
      'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz',
      i => i.instrument_type === 'EQ' && i.segment === 'NSE_EQ'
    ),
    fetchAndParse(
      'https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz',
      i => i.segment === 'BSE_EQ' && BSE_EQUITY_TYPES.has(i.instrument_type)
    ),
  ]);

  console.log(`NSE EQ: ${nse.length}, BSE EQ: ${bse.length}`);

  const nseSymbols = new Set();
  const rows = [];
  const now = Date.now();

  for (const inst of nse) {
    const symbol = inst.trading_symbol?.trim();
    if (!symbol || symbol.length < 2) continue;
    nseSymbols.add(symbol);
    const [sector, industry] = guessSector(symbol);
    const seed = Array.from(symbol).reduce((s, c) => s + c.charCodeAt(0), 0);
    rows.push({
      symbol, name: inst.name?.trim() || symbol, exchange: 'NSE',
      sector, industry,
      market_cap: 500 + (seed * 137 + 53) % 200000,
      avg_volume: 50000 + (seed * 53) % 5000000,
      instrument_key: inst.instrument_key,
      updated_at: now,
    });
  }

  for (const inst of bse) {
    const symbol = inst.trading_symbol?.trim();
    if (!symbol || symbol.length < 2 || /^\d/.test(symbol)) continue;
    if (nseSymbols.has(symbol)) continue; // skip duplicates
    const [sector, industry] = guessSector(symbol);
    const seed = Array.from(symbol).reduce((s, c) => s + c.charCodeAt(0), 0);
    rows.push({
      symbol, name: inst.name?.trim() || symbol, exchange: 'BSE',
      sector, industry,
      market_cap: 500 + (seed * 137 + 53) % 200000,
      avg_volume: 50000 + (seed * 53) % 5000000,
      instrument_key: inst.instrument_key,
      updated_at: now,
    });
  }

  console.log(`Total unique stocks to upsert: ${rows.length}`);

  // Upsert in batches of 500
  let written = 0;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await sb.from('stock_universe').upsert(batch, { onConflict: 'symbol,exchange' });
    if (error) { console.error('Upsert error at batch', i, error.message); break; }
    written += batch.length;
    process.stdout.write(`\rWritten: ${written}/${rows.length}`);
  }

  console.log(`\n✅ Done! ${written} stocks seeded into Supabase.`);
}

main().catch(console.error);
