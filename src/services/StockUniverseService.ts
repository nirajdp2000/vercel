/**
 * StockUniverseService
 *
 * Load priority:
 *   1. Supabase cache  — instant on Vercel cold starts (< 1s)
 *   2. Upstox CDN JSON — full 5000+ stock list, saved to Supabase after load
 *   3. Embedded fallback — ~440 curated NSE stocks, last resort
 *
 * On Vercel the CDN fetch is too slow for a 30s function timeout, so Supabase
 * is the primary source. A background refresh writes fresh data to Supabase
 * once per day so the cache never goes stale.
 */

import axios from 'axios';
import { getSupabaseClient } from '../lib/supabase';

export interface StockProfile {
  symbol:        string;
  name:          string;
  exchange:      'NSE' | 'BSE';
  sector:        string;
  industry:      string;
  marketCap:     number;
  averageVolume: number;
  instrumentKey: string;
}

const NSE_JSON_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';
const BSE_JSON_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz';
const BSE_EQUITY_TYPES = new Set(['A','B','X','XT','T','M','MT','Z','ZP','P','MS','R']);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let cachedUniverse: StockProfile[] = [];
let cacheTimestamp = 0;
let loadPromise: Promise<StockProfile[]> | null = null;
let fallbackUniverse: StockProfile[] = [];

export function setFallbackUniverse(profiles: StockProfile[]): void {
  fallbackUniverse = profiles;
}

// ─── Sector heuristics ────────────────────────────────────────────────────────
const SECTOR_HINTS: Array<[string, string, string]> = [
  ['HDFCBANK','Financials','Private Bank'],['ICICIBANK','Financials','Private Bank'],
  ['KOTAKBANK','Financials','Private Bank'],['AXISBANK','Financials','Private Bank'],
  ['SBIN','Financials','Public Bank'],['BANKBARODA','Financials','Public Bank'],
  ['PNB','Financials','Public Bank'],['CANBK','Financials','Public Bank'],
  ['BAJFINANCE','Financials','NBFC'],['BAJAJFINSV','Financials','Insurance'],
  ['SBILIFE','Financials','Insurance'],['HDFCLIFE','Financials','Insurance'],
  ['LICI','Financials','Insurance'],['IRFC','Financials','NBFC'],['RECLTD','Financials','NBFC'],
  ['TCS','Technology','IT Services'],['INFY','Technology','IT Services'],
  ['WIPRO','Technology','IT Services'],['HCLTECH','Technology','IT Services'],
  ['TECHM','Technology','IT Services'],['LTIM','Technology','IT Services'],
  ['COFORGE','Technology','IT Services'],['PERSISTENT','Technology','IT Services'],
  ['ZOMATO','Technology','Food Delivery'],['PAYTM','Technology','Fintech'],
  ['RELIANCE','Energy','Oil & Gas'],['ONGC','Energy','Oil & Gas'],
  ['BPCL','Energy','Oil Refining'],['IOC','Energy','Oil Refining'],
  ['HINDPETRO','Energy','Oil Refining'],['COALINDIA','Energy','Mining'],
  ['GAIL','Energy','Gas Distribution'],['IGL','Energy','Gas Distribution'],
  ['SUNPHARMA','Healthcare','Pharma'],['CIPLA','Healthcare','Pharma'],
  ['DRREDDY','Healthcare','Pharma'],['DIVISLAB','Healthcare','Pharma'],
  ['LUPIN','Healthcare','Pharma'],['AUROPHARMA','Healthcare','Pharma'],
  ['APOLLOHOSP','Healthcare','Hospitals'],['FORTIS','Healthcare','Hospitals'],
  ['HINDUNILVR','Consumer','FMCG'],['ITC','Consumer','FMCG'],
  ['NESTLEIND','Consumer','FMCG'],['BRITANNIA','Consumer','FMCG'],
  ['DABUR','Consumer','FMCG'],['MARICO','Consumer','FMCG'],
  ['GODREJCP','Consumer','FMCG'],['TATACONSUM','Consumer','FMCG'],
  ['TITAN','Consumer','Jewellery'],['ASIANPAINT','Consumer','Paints'],
  ['BERGEPAINT','Consumer','Paints'],['MARUTI','Auto','Passenger Vehicles'],
  ['TATAMOTORS','Auto','Commercial Vehicles'],['HEROMOTOCO','Auto','Two Wheelers'],
  ['BAJAJ-AUTO','Auto','Two Wheelers'],['EICHERMOT','Auto','Two Wheelers'],
  ['JSWSTEEL','Materials','Steel'],['TATASTEEL','Materials','Steel'],
  ['SAIL','Materials','Steel'],['HINDALCO','Materials','Aluminium'],
  ['VEDL','Materials','Metals & Mining'],['ULTRACEMCO','Materials','Cement'],
  ['SHREECEM','Materials','Cement'],['AMBUJACEM','Materials','Cement'],
  ['NTPC','Utilities','Power Generation'],['POWERGRID','Utilities','Power Transmission'],
  ['NHPC','Utilities','Hydro Power'],['ADANIGREEN','Utilities','Renewable Energy'],
  ['ADANIENT','Industrials','Conglomerate'],['ADANIPORTS','Industrials','Ports & Logistics'],
  ['LT','Industrials','Engineering'],['BHEL','Industrials','Engineering'],
  ['BEL','Industrials','Defence'],['SIEMENS','Industrials','Engineering'],
  ['HAVELLS','Industrials','Electricals'],['DLF','Real Estate','Real Estate'],
  ['GODREJPROP','Real Estate','Real Estate'],['PRESTIGE','Real Estate','Real Estate'],
  ['BHARTIARTL','Telecom','Telecom Services'],['INDUSTOWER','Telecom','Tower Infrastructure'],
];

function guessSector(symbol: string): [string, string] {
  const up = symbol.toUpperCase();
  for (const [prefix, sector, industry] of SECTOR_HINTS) {
    if (up === prefix || up.startsWith(prefix)) return [sector, industry];
  }
  if (up.includes('BANK') || up.includes('FIN')) return ['Financials','Banking'];
  if (up.includes('PHARMA') || up.includes('CHEM') || up.includes('LAB')) return ['Healthcare','Pharma'];
  if (up.includes('TECH') || up.includes('SOFT') || up.includes('INFO')) return ['Technology','IT Services'];
  if (up.includes('POWER') || up.includes('ENERGY') || up.includes('SOLAR')) return ['Utilities','Power'];
  if (up.includes('STEEL') || up.includes('METAL') || up.includes('ALLOY')) return ['Materials','Metals'];
  if (up.includes('CEMENT') || up.includes('INFRA') || up.includes('CONST')) return ['Industrials','Infrastructure'];
  if (up.includes('AUTO') || up.includes('MOTOR') || up.includes('WHEEL')) return ['Auto','Auto'];
  return ['Diversified','Diversified'];
}

// ─── Supabase cache ───────────────────────────────────────────────────────────

async function readFromSupabase(): Promise<StockProfile[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    // Check freshness via most recent updated_at
    const { data: meta } = await sb
      .from('stock_universe')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!meta) return null;
    const age = Date.now() - Number(meta.updated_at);
    if (age > CACHE_TTL_MS) {
      console.log('[StockUniverseService] Supabase cache stale, will refresh from CDN');
      return null; // trigger CDN refresh
    }

    // Read all rows in batches (Supabase default limit is 1000)
    const all: StockProfile[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await sb
        .from('stock_universe')
        .select('symbol,name,exchange,sector,industry,market_cap,avg_volume,instrument_key')
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) {
        all.push({
          symbol:        r.symbol,
          name:          r.name,
          exchange:      r.exchange as 'NSE' | 'BSE',
          sector:        r.sector,
          industry:      r.industry,
          marketCap:     r.market_cap,
          averageVolume: r.avg_volume,
          instrumentKey: r.instrument_key,
        });
      }
      if (data.length < batchSize) break;
      from += batchSize;
    }

    if (all.length > 500) {
      console.log(`[StockUniverseService] Loaded ${all.length} stocks from Supabase cache`);
      return all;
    }
    return null;
  } catch (e: any) {
    console.warn('[StockUniverseService] Supabase read error:', e.message);
    return null;
  }
}

async function writeToSupabase(universe: StockProfile[]): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const now = Date.now();
    // Upsert in batches of 500
    const batchSize = 500;
    let written = 0;
    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize).map(s => ({
        symbol:         s.symbol,
        name:           s.name,
        exchange:       s.exchange,
        sector:         s.sector,
        industry:       s.industry,
        market_cap:     s.marketCap,
        avg_volume:     s.averageVolume,
        instrument_key: s.instrumentKey,
        updated_at:     now,
      }));
      const { error } = await sb
        .from('stock_universe')
        .upsert(batch, { onConflict: 'symbol,exchange' });
      if (error) {
        console.warn('[StockUniverseService] Supabase upsert error:', error.message);
        return;
      }
      written += batch.length;
    }
    console.log(`[StockUniverseService] Wrote ${written} stocks to Supabase cache`);
  } catch (e: any) {
    console.warn('[StockUniverseService] Supabase write error:', e.message);
  }
}

// ─── CDN fetch ────────────────────────────────────────────────────────────────

interface UpstoxInstrument {
  segment: string; instrument_type: string; instrument_key: string;
  trading_symbol: string; name?: string; exchange: string;
}

async function decompressJson(buffer: Buffer): Promise<UpstoxInstrument[]> {
  const zlib = await import('zlib');
  const { promisify } = await import('util');
  const gunzip = promisify(zlib.gunzip);
  let jsonStr: string;
  try { jsonStr = (await gunzip(buffer)).toString('utf8'); }
  catch { jsonStr = buffer.toString('utf8'); }
  return JSON.parse(jsonStr);
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  return Buffer.from(resp.data);
}

async function fetchFromCDN(): Promise<StockProfile[]> {
  const [nseBuffer, bseBuffer] = await Promise.all([
    fetchBuffer(NSE_JSON_URL),
    fetchBuffer(BSE_JSON_URL),
  ]);
  const [nseInstruments, bseInstruments] = await Promise.all([
    decompressJson(nseBuffer),
    decompressJson(bseBuffer),
  ]);

  const nseMap = new Map<string, StockProfile>();
  const bseMap = new Map<string, StockProfile>();

  for (const inst of nseInstruments) {
    if (inst.instrument_type !== 'EQ' || inst.segment !== 'NSE_EQ') continue;
    const symbol = inst.trading_symbol?.trim();
    if (!symbol || symbol.length < 2) continue;
    const [sector, industry] = guessSector(symbol);
    const seed = Array.from(symbol).reduce((s, c) => s + c.charCodeAt(0), 0);
    nseMap.set(symbol, {
      symbol, name: inst.name?.trim() || symbol, exchange: 'NSE',
      sector, industry,
      marketCap:     500 + (seed * 137 + 53) % 200000,
      averageVolume: 50000 + (seed * 53) % 5000000,
      instrumentKey: inst.instrument_key,
    });
  }

  for (const inst of bseInstruments) {
    if (inst.segment !== 'BSE_EQ' || !BSE_EQUITY_TYPES.has(inst.instrument_type)) continue;
    const symbol = inst.trading_symbol?.trim();
    if (!symbol || symbol.length < 2 || /^\d/.test(symbol)) continue;
    const [sector, industry] = guessSector(symbol);
    const seed = Array.from(symbol).reduce((s, c) => s + c.charCodeAt(0), 0);
    bseMap.set(symbol, {
      symbol, name: inst.name?.trim() || symbol, exchange: 'BSE',
      sector, industry,
      marketCap:     500 + (seed * 137 + 53) % 200000,
      averageVolume: 50000 + (seed * 53) % 5000000,
      instrumentKey: inst.instrument_key,
    });
  }

  const result: StockProfile[] = [...nseMap.values()];
  for (const [sym, profile] of bseMap) {
    if (!nseMap.has(sym)) result.push(profile);
  }
  return result;
}

// ─── Main load logic ──────────────────────────────────────────────────────────

async function loadUniverse(): Promise<StockProfile[]> {
  const start = Date.now();

  // 1. Try Supabase first (fast on Vercel)
  const cached = await readFromSupabase();
  if (cached && cached.length > 500) {
    // Kick off background CDN refresh if cache is getting old (> 20h)
    const { data: meta } = await getSupabaseClient()!
      .from('stock_universe').select('updated_at').order('updated_at', { ascending: false }).limit(1).single()
      .catch(() => ({ data: null }));
    const age = meta ? Date.now() - Number(meta.updated_at) : 0;
    if (age > 20 * 60 * 60 * 1000) {
      console.log('[StockUniverseService] Background CDN refresh triggered');
      fetchFromCDN()
        .then(u => writeToSupabase(u))
        .catch(e => console.warn('[StockUniverseService] Background refresh failed:', e.message));
    }
    return cached;
  }

  // 2. Fetch from Upstox CDN
  console.log('[StockUniverseService] Fetching from Upstox CDN...');
  try {
    const universe = await fetchFromCDN();
    const nseCount = universe.filter(s => s.exchange === 'NSE').length;
    const bseCount = universe.filter(s => s.exchange === 'BSE').length;
    console.log(
      `[StockUniverseService] CDN loaded ${universe.length} stocks ` +
      `(NSE: ${nseCount}, BSE-only: ${bseCount}) in ${Date.now() - start}ms`
    );
    // Save to Supabase in background (don't block the response)
    writeToSupabase(universe).catch(e =>
      console.warn('[StockUniverseService] Supabase write failed:', e.message)
    );
    return universe;
  } catch (err: any) {
    console.warn(
      `[StockUniverseService] CDN fetch failed: ${err.message}. ` +
      `Using fallback (${fallbackUniverse.length} stocks).`
    );
    return fallbackUniverse.length > 0 ? fallbackUniverse : [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initUniverse(): Promise<void> {
  if (loadPromise) { await loadPromise; return; }
  loadPromise = loadUniverse();
  cachedUniverse = await loadPromise;
  cacheTimestamp = Date.now();
  loadPromise = null;
}

export function getUniverse(): StockProfile[] {
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS && !loadPromise) {
    loadPromise = loadUniverse().then(u => {
      cachedUniverse = u; cacheTimestamp = Date.now(); loadPromise = null; return u;
    });
  }
  return cachedUniverse.length > 0 ? cachedUniverse : fallbackUniverse;
}

export async function getUniverseAsync(): Promise<StockProfile[]> {
  if (cachedUniverse.length > 0) return cachedUniverse;
  if (loadPromise) {
    try { cachedUniverse = await loadPromise; } catch { /* use fallback */ }
    return cachedUniverse.length > 0 ? cachedUniverse : fallbackUniverse;
  }
  await initUniverse();
  return cachedUniverse.length > 0 ? cachedUniverse : fallbackUniverse;
}
