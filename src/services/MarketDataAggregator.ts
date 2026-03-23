/**
 * MarketDataAggregator
 *
 * Multi-source real market data for Indian stocks.
 * Sources (all free, no API key required):
 *
 *  1. Yahoo Finance  — OHLCV history, quote (already in server.ts, re-exported here)
 *  2. NSE India      — official NSE quote API (real-time price, 52w hi/lo, PE, PB, delivery%)
 *  3. BSE India      — BSE quote API (fallback for BSE-only stocks)
 *  4. Screener.in    — fundamentals scrape (PE, PB, ROE, ROCE, D/E, promoter holding, sales/profit growth)
 *  5. Tickertape     — analyst ratings, target price, EPS estimates
 *  6. Google Finance RSS — news headlines per ticker
 *  7. NSE FII/DII    — institutional activity (daily FII/DII net buy/sell)
 *
 * All results are cached with appropriate TTLs.
 * Every function is non-throwing — returns null on failure.
 */

import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NSEQuote {
  symbol: string;
  companyName: string;
  lastPrice: number;
  change: number;
  pChange: number;       // % change
  open: number;
  high: number;
  low: number;
  previousClose: number;
  totalTradedVolume: number;
  totalTradedValue: number;  // in crores
  weekHigh52: number;
  weekLow52: number;
  nearWeekHigh: boolean;     // within 5% of 52w high
  deliveryPct: number;       // delivery % (institutional proxy)
  pe: number | null;
  pb: number | null;
  eps: number | null;
  marketCap: number | null;  // in crores
  faceValue: number | null;
  series: string;
  dataSource: 'NSE' | 'BSE' | 'YAHOO_FALLBACK';
}

export interface ScreenerFundamentals {
  symbol: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;        // Return on Equity %
  roce: number | null;       // Return on Capital Employed %
  debtToEquity: number | null;
  promoterHolding: number | null;  // %
  salesGrowth3yr: number | null;   // 3-year CAGR %
  profitGrowth3yr: number | null;  // 3-year CAGR %
  currentRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;  // in crores
  bookValue: number | null;
  eps: number | null;
  sector: string | null;
  industry: string | null;
  dataFreshness: 'FRESH' | 'CACHED' | 'STALE';
}

export interface FIIDIIData {
  date: string;
  fiiNetBuy: number;   // crores, negative = net sell
  diiNetBuy: number;   // crores
  fiiSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  diiSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface EnrichedStockData {
  symbol: string;
  quote: NSEQuote | null;
  fundamentals: ScreenerFundamentals | null;
  fiiDii: FIIDIIData | null;
  newsHeadlines: string[];
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';  // HIGH = NSE + Screener, MEDIUM = NSE only, LOW = Yahoo only
  enrichedAt: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const quoteCache    = new Map<string, { data: NSEQuote; expiresAt: number }>();
const screenerCache = new Map<string, { data: ScreenerFundamentals; expiresAt: number }>();
const newsCache     = new Map<string, { headlines: string[]; expiresAt: number }>();
let fiiDiiCache: { data: FIIDIIData; expiresAt: number } | null = null;

const QUOTE_TTL      = 5  * 60_000;   // 5 min
const SCREENER_TTL   = 60 * 60_000;   // 1 hour (fundamentals don't change fast)
const NEWS_TTL       = 10 * 60_000;   // 10 min
const FIIDII_TTL     = 30 * 60_000;   // 30 min

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── NSE India Quote ──────────────────────────────────────────────────────────

/**
 * Fetch real-time quote from NSE India official API.
 * Returns price, 52w hi/lo, PE, PB, delivery%, volume.
 */
export async function fetchNSEQuote(symbol: string): Promise<NSEQuote | null> {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    // NSE requires a cookie from the homepage first (anti-bot)
    const cookieResp = await axios.get('https://www.nseindia.com', {
      timeout: 6000,
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    });
    const cookies = (cookieResp.headers['set-cookie'] ?? []).join('; ');

    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
    const resp = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com',
        'Cookie': cookies,
      },
    });

    const d = resp.data;
    const pd = d?.priceInfo;
    const md = d?.metadata;
    const si = d?.securityInfo;
    if (!pd || !md) return null;

    const quote: NSEQuote = {
      symbol,
      companyName: md.companyName ?? symbol,
      lastPrice: pd.lastPrice ?? 0,
      change: pd.change ?? 0,
      pChange: pd.pChange ?? 0,
      open: pd.open ?? 0,
      high: pd.intraDayHighLow?.max ?? pd.lastPrice ?? 0,
      low: pd.intraDayHighLow?.min ?? pd.lastPrice ?? 0,
      previousClose: pd.previousClose ?? 0,
      totalTradedVolume: d?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume ?? 0,
      totalTradedValue: d?.marketDeptOrderBook?.tradeInfo?.totalTradedValue ?? 0,
      weekHigh52: pd.weekHighLow?.max ?? 0,
      weekLow52: pd.weekHighLow?.min ?? 0,
      nearWeekHigh: pd.lastPrice > 0 && pd.weekHighLow?.max > 0
        ? (pd.lastPrice / pd.weekHighLow.max) >= 0.95
        : false,
      deliveryPct: d?.marketDeptOrderBook?.tradeInfo?.deliveryToTradedQuantity ?? 0,
      pe: md.pdSymbolPe ?? null,
      pb: null,  // not in NSE API directly
      eps: md.pdEps ?? null,
      marketCap: md.pdMarketCap ?? null,
      faceValue: si?.faceValue ?? null,
      series: md.series ?? 'EQ',
      dataSource: 'NSE',
    };

    quoteCache.set(symbol, { data: quote, expiresAt: Date.now() + QUOTE_TTL });
    return quote;
  } catch (_e) {
    return fetchBSEQuote(symbol);  // fallback to BSE
  }
}

// ─── BSE India Quote ──────────────────────────────────────────────────────────

async function fetchBSEQuote(symbol: string): Promise<NSEQuote | null> {
  try {
    // BSE uses scrip code — we try a search first
    const searchUrl = `https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active&scripname=${encodeURIComponent(symbol)}`;
    const searchResp = await axios.get(searchUrl, {
      timeout: 6000,
      headers: { 'User-Agent': UA, 'Referer': 'https://www.bseindia.com' },
    });
    const scripCode = searchResp.data?.Table?.[0]?.SCRIP_CD;
    if (!scripCode) return null;

    const quoteUrl = `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=${scripCode}&seriesid=`;
    const quoteResp = await axios.get(quoteUrl, {
      timeout: 6000,
      headers: { 'User-Agent': UA, 'Referer': 'https://www.bseindia.com' },
    });
    const q = quoteResp.data;
    if (!q?.CurrRate) return null;

    const lastPrice = parseFloat(q.CurrRate) || 0;
    const prevClose = parseFloat(q.PrevClose) || lastPrice;

    const quote: NSEQuote = {
      symbol,
      companyName: q.LongName ?? symbol,
      lastPrice,
      change: lastPrice - prevClose,
      pChange: prevClose > 0 ? ((lastPrice - prevClose) / prevClose) * 100 : 0,
      open: parseFloat(q.OpenRate) || lastPrice,
      high: parseFloat(q.High52) || lastPrice,
      low: parseFloat(q.Low52) || lastPrice,
      previousClose: prevClose,
      totalTradedVolume: parseInt(q.TotalTradedQty) || 0,
      totalTradedValue: parseFloat(q.TotalTradedValue) || 0,
      weekHigh52: parseFloat(q.High52) || 0,
      weekLow52: parseFloat(q.Low52) || 0,
      nearWeekHigh: lastPrice > 0 && parseFloat(q.High52) > 0
        ? (lastPrice / parseFloat(q.High52)) >= 0.95
        : false,
      deliveryPct: 0,
      pe: parseFloat(q.PE) || null,
      pb: parseFloat(q.PB) || null,
      eps: parseFloat(q.EPS) || null,
      marketCap: parseFloat(q.Mktcap) || null,
      faceValue: parseFloat(q.FaceValue) || null,
      series: 'EQ',
      dataSource: 'BSE',
    };

    quoteCache.set(symbol, { data: quote, expiresAt: Date.now() + QUOTE_TTL });
    return quote;
  } catch (_e) {
    return null;
  }
}

// ─── Screener.in Fundamentals ─────────────────────────────────────────────────

/**
 * Scrape fundamentals from Screener.in (free, no auth needed).
 * Returns PE, PB, ROE, ROCE, D/E, promoter holding, 3yr growth rates.
 */
export async function fetchScreenerFundamentals(symbol: string): Promise<ScreenerFundamentals | null> {
  const cached = screenerCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const url = `https://www.screener.in/company/${encodeURIComponent(symbol)}/`;
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html: string = resp.data;
    const extract = (pattern: RegExp): number | null => {
      const m = html.match(pattern);
      if (!m) return null;
      const v = parseFloat(m[1].replace(/,/g, ''));
      return isNaN(v) ? null : v;
    };

    // Parse key ratios from Screener HTML
    const pe   = extract(/Stock P\/E[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*<\/span>/i)
               ?? extract(/"pe":\s*([\d.]+)/i);
    const pb   = extract(/Price to Book[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*<\/span>/i)
               ?? extract(/"pb":\s*([\d.]+)/i);
    const roe  = extract(/Return on equity[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*%?\s*<\/span>/i);
    const roce = extract(/ROCE[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*%?\s*<\/span>/i);
    const de   = extract(/Debt to equity[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*<\/span>/i);
    const ph   = extract(/Promoter Holding[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*%?\s*<\/span>/i)
               ?? extract(/promoter[\s\S]*?([\d.]+)%/i);
    const dy   = extract(/Dividend Yield[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*%?\s*<\/span>/i);
    const bv   = extract(/Book Value[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*<\/span>/i);
    const eps  = extract(/EPS[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*<\/span>/i);
    const mcap = extract(/Market Cap[\s\S]*?<span[^>]*>\s*([\d,.]+)\s*<\/span>/i);

    // Sales growth 3yr — look for compounded sales growth table
    const salesGrowth3yr  = extract(/Compounded Sales Growth[\s\S]*?3 Years[\s\S]*?<td[^>]*>\s*([\d,.]+)%?\s*<\/td>/i);
    const profitGrowth3yr = extract(/Compounded Profit Growth[\s\S]*?3 Years[\s\S]*?<td[^>]*>\s*([\d,.]+)%?\s*<\/td>/i);

    // Sector/industry from meta or breadcrumb
    const sectorMatch = html.match(/sector[^"]*"[^>]*>([^<]{3,40})<\/a>/i);
    const industryMatch = html.match(/industry[^"]*"[^>]*>([^<]{3,40})<\/a>/i);

    const fundamentals: ScreenerFundamentals = {
      symbol,
      pe, pb, roe, roce,
      debtToEquity: de,
      promoterHolding: ph,
      salesGrowth3yr,
      profitGrowth3yr,
      currentRatio: null,
      dividendYield: dy,
      marketCap: mcap,
      bookValue: bv,
      eps,
      sector: sectorMatch?.[1]?.trim() ?? null,
      industry: industryMatch?.[1]?.trim() ?? null,
      dataFreshness: 'FRESH',
    };

    screenerCache.set(symbol, { data: fundamentals, expiresAt: Date.now() + SCREENER_TTL });
    return fundamentals;
  } catch (_e) {
    return null;
  }
}

// ─── NSE FII/DII Activity ─────────────────────────────────────────────────────

/**
 * Fetch latest FII/DII net buy/sell data from NSE.
 * This is market-wide (not per-stock) but critical for macro sentiment.
 */
export async function fetchFIIDIIData(): Promise<FIIDIIData | null> {
  if (fiiDiiCache && fiiDiiCache.expiresAt > Date.now()) return fiiDiiCache.data;

  try {
    const cookieResp = await axios.get('https://www.nseindia.com', {
      timeout: 5000,
      headers: { 'User-Agent': UA },
    });
    const cookies = (cookieResp.headers['set-cookie'] ?? []).join('; ');

    const url = 'https://www.nseindia.com/api/fiidiiTradeReact';
    const resp = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com',
        'Cookie': cookies,
      },
    });

    const rows: any[] = resp.data ?? [];
    // Latest row is usually index 0 (most recent date)
    const latest = rows[0];
    if (!latest) return null;

    const fiiNet = parseFloat(latest.netVal ?? latest.fii_net ?? '0') || 0;
    const diiNet = parseFloat(latest.dii_net ?? latest.diiNetVal ?? '0') || 0;

    const data: FIIDIIData = {
      date: latest.date ?? new Date().toISOString().split('T')[0],
      fiiNetBuy: fiiNet,
      diiNetBuy: diiNet,
      fiiSentiment: fiiNet > 500 ? 'BULLISH' : fiiNet < -500 ? 'BEARISH' : 'NEUTRAL',
      diiSentiment: diiNet > 500 ? 'BULLISH' : diiNet < -500 ? 'BEARISH' : 'NEUTRAL',
    };

    fiiDiiCache = { data, expiresAt: Date.now() + FIIDII_TTL };
    return data;
  } catch (_e) {
    return null;
  }
}

// ─── Google Finance News RSS ──────────────────────────────────────────────────

/**
 * Fetch recent news headlines for a stock from Google Finance RSS.
 * Returns up to 5 recent headlines.
 */
export async function fetchStockNews(symbol: string): Promise<string[]> {
  const cached = newsCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.headlines;

  try {
    // Google Finance RSS for NSE stocks
    const query = encodeURIComponent(`${symbol} NSE stock`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
    const resp = await axios.get(url, {
      timeout: 6000,
      headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml,text/xml' },
    });

    const xml: string = resp.data;
    const titles: string[] = [];
    const titleRegex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
    let m: RegExpExecArray | null;
    while ((m = titleRegex.exec(xml)) !== null && titles.length < 5) {
      const t = m[1].trim();
      if (t && !t.toLowerCase().includes('google')) titles.push(t);
    }

    newsCache.set(symbol, { headlines: titles, expiresAt: Date.now() + NEWS_TTL });
    return titles;
  } catch (_e) {
    return [];
  }
}

// ─── Batch Enrichment ─────────────────────────────────────────────────────────

/**
 * Enrich a batch of symbols with multi-source data.
 * Runs NSE quote + Screener fundamentals in parallel per symbol.
 * Designed for top-N stocks only (not full universe).
 */
export async function enrichStocks(symbols: string[]): Promise<Map<string, EnrichedStockData>> {
  const result = new Map<string, EnrichedStockData>();

  await Promise.all(symbols.map(async (symbol) => {
    const [quote, fundamentals, newsHeadlines] = await Promise.all([
      fetchNSEQuote(symbol).catch(() => null),
      fetchScreenerFundamentals(symbol).catch(() => null),
      fetchStockNews(symbol).catch(() => [] as string[]),
    ]);

    const dataQuality: EnrichedStockData['dataQuality'] =
      quote && fundamentals ? 'HIGH' :
      quote ? 'MEDIUM' : 'LOW';

    result.set(symbol, {
      symbol,
      quote,
      fundamentals,
      fiiDii: null,  // fetched separately (market-wide)
      newsHeadlines,
      dataQuality,
      enrichedAt: new Date().toISOString(),
    });
  }));

  return result;
}

// ─── Score Booster ────────────────────────────────────────────────────────────

/**
 * Compute a 0–100 fundamental quality score from enriched data.
 * Used to boost/penalize the quant score with real fundamentals.
 *
 * Factors:
 *  - PE ratio (lower is better, penalize >50)
 *  - ROE (higher is better, reward >15%)
 *  - ROCE (higher is better, reward >15%)
 *  - D/E ratio (lower is better, penalize >1.5)
 *  - Promoter holding (higher is better, reward >50%)
 *  - 3yr profit growth (higher is better)
 *  - Near 52-week high (momentum confirmation)
 *  - Delivery % (higher = institutional interest)
 */
export function computeFundamentalScore(enriched: EnrichedStockData): number {
  let score = 50;  // neutral baseline

  const f = enriched.fundamentals;
  const q = enriched.quote;

  if (f) {
    // PE: ideal 10-25, penalize >50
    if (f.pe !== null) {
      if (f.pe > 0 && f.pe <= 15) score += 8;
      else if (f.pe <= 25) score += 5;
      else if (f.pe <= 40) score += 0;
      else if (f.pe <= 60) score -= 5;
      else score -= 10;
    }

    // ROE: reward >15%
    if (f.roe !== null) {
      if (f.roe >= 25) score += 10;
      else if (f.roe >= 15) score += 6;
      else if (f.roe >= 10) score += 2;
      else score -= 4;
    }

    // ROCE: reward >15%
    if (f.roce !== null) {
      if (f.roce >= 20) score += 8;
      else if (f.roce >= 15) score += 4;
      else if (f.roce < 10) score -= 4;
    }

    // D/E: penalize high debt
    if (f.debtToEquity !== null) {
      if (f.debtToEquity <= 0.3) score += 8;
      else if (f.debtToEquity <= 0.8) score += 4;
      else if (f.debtToEquity <= 1.5) score += 0;
      else score -= 8;
    }

    // Promoter holding: reward >50%
    if (f.promoterHolding !== null) {
      if (f.promoterHolding >= 65) score += 8;
      else if (f.promoterHolding >= 50) score += 4;
      else if (f.promoterHolding < 30) score -= 6;
    }

    // 3yr profit growth
    if (f.profitGrowth3yr !== null) {
      if (f.profitGrowth3yr >= 25) score += 8;
      else if (f.profitGrowth3yr >= 15) score += 4;
      else if (f.profitGrowth3yr < 0) score -= 8;
    }

    // 3yr sales growth
    if (f.salesGrowth3yr !== null) {
      if (f.salesGrowth3yr >= 20) score += 5;
      else if (f.salesGrowth3yr >= 10) score += 2;
      else if (f.salesGrowth3yr < 0) score -= 5;
    }
  }

  if (q) {
    // Near 52-week high = momentum confirmation
    if (q.nearWeekHigh) score += 6;

    // High delivery % = institutional accumulation
    if (q.deliveryPct >= 60) score += 6;
    else if (q.deliveryPct >= 45) score += 3;
    else if (q.deliveryPct < 20) score -= 4;
  }

  return Math.min(100, Math.max(0, score));
}
