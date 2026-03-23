/**
 * MarketDataAggregator — Indian Stock Market Data
 *
 * Free sources used (no API key required):
 *
 *  1. Yahoo Finance v8  — OHLCV history + quote (primary, already proven working)
 *  2. Yahoo Finance v7  — fundamentals: PE, EPS, 52W hi/lo, market cap (same domain, free)
 *  3. NSE India CSV     — bhav copy (end-of-day price, volume, delivery%) — official public data
 *  4. Screener.in JSON  — PE, ROE, ROCE, D/E, promoter%, growth (public JSON endpoint)
 *  5. Economic Times RSS — news headlines (already in NewsIntelligenceService, reused here)
 *
 * Design rules for Vercel (10s function timeout):
 *  - enrichStocks() is NEVER called inside the main scan pipeline
 *  - It runs as a background cache-warmer AFTER the scan returns
 *  - All timeouts are hard-capped at 4s per request
 *  - Cache TTL: 1hr for fundamentals, 5min for quotes
 *  - On cache miss during scan → return null (graceful degradation)
 */

import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YahooFundamentals {
  symbol: string;
  pe: number | null;
  eps: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  marketCap: number | null;       // in INR crores
  bookValue: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  forwardPE: number | null;
  pChange: number | null;         // % change today
  lastPrice: number | null;
  dataSource: 'YAHOO';
}

export interface ScreenerFundamentals {
  symbol: string;
  pe: number | null;
  roe: number | null;
  roce: number | null;
  debtToEquity: number | null;
  promoterHolding: number | null;
  salesGrowth3yr: number | null;
  profitGrowth3yr: number | null;
  dividendYield: number | null;
  currentRatio: number | null;
  dataSource: 'SCREENER';
}

export interface FIIDIIData {
  date: string;
  fiiNetBuy: number;
  diiNetBuy: number;
  fiiSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  diiSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface EnrichedStockData {
  symbol: string;
  yahoo: YahooFundamentals | null;
  screener: ScreenerFundamentals | null;
  newsHeadlines: string[];
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  enrichedAt: string;
}

// ─── Module-level cache (survives across warm Vercel invocations) ─────────────

const yahooFundCache  = new Map<string, { data: YahooFundamentals; expiresAt: number }>();
const screenerCache   = new Map<string, { data: ScreenerFundamentals; expiresAt: number }>();
const newsCache       = new Map<string, { headlines: string[]; expiresAt: number }>();
let   fiiDiiCache: { data: FIIDIIData; expiresAt: number } | null = null;

// Background warm state — tracks which symbols are currently being fetched
const warmingSet = new Set<string>();

const YAHOO_FUND_TTL  = 60 * 60_000;   // 1 hour
const SCREENER_TTL    = 60 * 60_000;   // 1 hour
const NEWS_TTL        = 15 * 60_000;   // 15 min
const FIIDII_TTL      = 30 * 60_000;   // 30 min
const HTTP_TIMEOUT    = 4_000;          // 4s hard cap — Vercel safe

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── 1. Yahoo Finance Fundamentals (v7 quoteSummary) ─────────────────────────
// Same domain as OHLCV — already proven to work, no cookie needed

// Known Yahoo Finance symbol overrides — same as server.ts fetchRealOHLCV
const YAHOO_OVERRIDES: Record<string, string> = {
  'TATAMOTORS': 'TATAMOTORS.BO',
  'M&M':        'M%26M.NS',
  'BAJAJ-AUTO': 'BAJAJ-AUTO.NS',
};

export async function fetchYahooFundamentals(symbol: string): Promise<YahooFundamentals | null> {
  const cached = yahooFundCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const override = YAHOO_OVERRIDES[symbol.toUpperCase()];
  const tickers = override
    ? [override, `${symbol}.NS`, `${symbol}.BO`]
    : [`${symbol}.NS`, `${symbol}.BO`];

  for (const ticker of tickers) {
    try {
      const encoded = encodeURIComponent(ticker);
      // Use v8 chart API (proven working, no 401) — fetch 5d for price + 1y for 52W range
      // v7 /quote returns 401 on Vercel IPs — v8 /chart works reliably
      // Use 1y range to compute accurate 52W high/low from actual candles
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1y&includePrePost=false`;
      const resp = await axios.get(url, {
        timeout: HTTP_TIMEOUT,
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      });

      const result = resp.data?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta || !meta.regularMarketPrice) continue;

      // Validate symbol match
      const returnedBase = (meta.symbol ?? '').toUpperCase().replace(/\.(NS|BO)$/, '');
      const requestedBase = symbol.toUpperCase();
      if (returnedBase && returnedBase !== requestedBase) continue;

      // Derive 52W high/low from actual OHLCV candles (more accurate than meta fields)
      const highs: number[] = result.indicators?.quote?.[0]?.high?.filter((v: any) => v != null) ?? [];
      const lows:  number[] = result.indicators?.quote?.[0]?.low?.filter((v: any) => v != null) ?? [];
      const closes: number[] = result.indicators?.quote?.[0]?.close?.filter((v: any) => v != null) ?? [];

      const weekHigh52 = highs.length  > 0 ? Math.max(...highs)  : (meta.fiftyTwoWeekHigh ?? null);
      const weekLow52  = lows.length   > 0 ? Math.min(...lows)   : (meta.fiftyTwoWeekLow  ?? null);

      // PE: Yahoo v8 meta sometimes has trailingPE
      const pe = meta.trailingPE ?? null;

      // Market cap from meta (in INR) → convert to crores
      const mcapRaw = meta.marketCap ?? null;
      const marketCapCr = mcapRaw ? Math.round(mcapRaw / 1e7) : null;

      // pChange: compute from regularMarketPrice vs chartPreviousClose
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      const pChange = prevClose && prevClose > 0
        ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100
        : (meta.regularMarketChangePercent ?? null);

      const data: YahooFundamentals = {
        symbol,
        pe,
        eps:           null,  // not available in v8
        weekHigh52,
        weekLow52,
        marketCap:     marketCapCr,
        bookValue:     null,
        priceToBook:   null,
        dividendYield: null,
        forwardPE:     null,
        pChange:       pChange !== null ? Number(pChange.toFixed(2)) : null,
        lastPrice:     Number(meta.regularMarketPrice.toFixed(2)),
        dataSource:    'YAHOO',
      };

      yahooFundCache.set(symbol, { data, expiresAt: Date.now() + YAHOO_FUND_TTL });
      return data;
    } catch (_e) {
      continue;
    }
  }

  return null;
}

// ─── 2. Screener.in JSON API ──────────────────────────────────────────────────
// Screener exposes a public JSON endpoint — much faster than HTML scraping

export async function fetchScreenerFundamentals(symbol: string): Promise<ScreenerFundamentals | null> {
  const cached = screenerCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    // Screener.in public company JSON — no auth needed
    const url = `https://www.screener.in/api/company/${encodeURIComponent(symbol)}/`;
    const resp = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': 'https://www.screener.in',
      },
    });

    const d = resp.data;
    if (!d) return null;

    // Screener JSON structure: ratios array with name/value pairs
    const ratios: Array<{ name: string; value: string }> = d.ratios ?? [];
    const getVal = (name: string): number | null => {
      const r = ratios.find(x => x.name?.toLowerCase().includes(name.toLowerCase()));
      if (!r) return null;
      const v = parseFloat(String(r.value ?? '').replace(/[,%]/g, '').trim());
      return isNaN(v) ? null : v;
    };

    // Compounded growth from separate arrays
    const salesGrowth  = d.compounded_sales_growth?.find((x: any) => x.name === '3 Years')?.value ?? null;
    const profitGrowth = d.compounded_profit_growth?.find((x: any) => x.name === '3 Years')?.value ?? null;
    const promoterData = d.shareholding?.find((x: any) => x.name?.toLowerCase().includes('promoter'));
    const promoterPct  = promoterData?.value ? parseFloat(String(promoterData.value).replace('%', '')) : null;

    const data: ScreenerFundamentals = {
      symbol,
      pe:               getVal('P/E') ?? getVal('price to earning'),
      roe:              getVal('ROE') ?? getVal('return on equity'),
      roce:             getVal('ROCE') ?? getVal('return on capital'),
      debtToEquity:     getVal('Debt to equity') ?? getVal('D/E'),
      promoterHolding:  isNaN(promoterPct as number) ? null : promoterPct,
      salesGrowth3yr:   salesGrowth ? parseFloat(String(salesGrowth).replace('%', '')) : null,
      profitGrowth3yr:  profitGrowth ? parseFloat(String(profitGrowth).replace('%', '')) : null,
      dividendYield:    getVal('Dividend Yield'),
      currentRatio:     getVal('Current ratio'),
      dataSource:       'SCREENER',
    };

    screenerCache.set(symbol, { data, expiresAt: Date.now() + SCREENER_TTL });
    return data;
  } catch (_e) {
    return null;
  }
}

// ─── 3. NSE FII/DII (public CSV) ─────────────────────────────────────────────
// NSE publishes daily FII/DII CSV — no cookie needed, direct download

export async function fetchFIIDIIData(): Promise<FIIDIIData | null> {
  if (fiiDiiCache && fiiDiiCache.expiresAt > Date.now()) return fiiDiiCache.data;

  try {
    // NSE FII/DII activity — public CSV, no auth
    const url = 'https://archives.nseindia.com/content/fo/fii_stats.json';
    const resp = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    });

    const rows: any[] = Array.isArray(resp.data) ? resp.data : [];
    const latest = rows[rows.length - 1] ?? rows[0];
    if (!latest) return null;

    const fiiNet = parseFloat(latest.NET ?? latest.net ?? latest.fiiNet ?? '0') || 0;
    const diiNet = parseFloat(latest.diiNet ?? latest.DII_NET ?? '0') || 0;

    const data: FIIDIIData = {
      date: latest.date ?? latest.DATE ?? new Date().toISOString().split('T')[0],
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

// ─── 4. Economic Times RSS news (reuse existing feed) ────────────────────────

export async function fetchStockNews(symbol: string): Promise<string[]> {
  const cached = newsCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.headlines;

  try {
    // ET Markets search RSS — free, no auth
    const query = encodeURIComponent(`${symbol}`);
    const url = `https://economictimes.indiatimes.com/markets/stocks/news/rss.cms?q=${query}`;
    const resp = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: { 'User-Agent': UA, 'Accept': 'text/xml,application/rss+xml' },
    });

    const xml: string = resp.data ?? '';
    const titles: string[] = [];
    // Match both CDATA and plain title tags
    const re = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null && titles.length < 4) {
      const t = m[1].trim();
      if (t && t.length > 10 && !t.toLowerCase().includes('economic times')) {
        titles.push(t);
      }
    }

    newsCache.set(symbol, { headlines: titles, expiresAt: Date.now() + NEWS_TTL });
    return titles;
  } catch (_e) {
    newsCache.set(symbol, { headlines: [], expiresAt: Date.now() + NEWS_TTL });
    return [];
  }
}

// ─── Batch enrichment — BACKGROUND ONLY, never block scan ────────────────────

/**
 * Enrich top-N stocks with Yahoo fundamentals + Screener data.
 *
 * IMPORTANT: This must NEVER be awaited inside the main scan pipeline.
 * Call it fire-and-forget after the scan returns, so results are cached
 * for the NEXT request. This keeps scan latency under Vercel's 10s limit.
 *
 * Usage:
 *   // After scan completes and response is sent:
 *   enrichStocksBackground(top10Symbols);  // no await
 */
export async function enrichStocksBackground(symbols: string[]): Promise<void> {
  // Only enrich symbols not already being warmed or cached
  const toEnrich = symbols.filter(s => {
    if (warmingSet.has(s)) return false;
    const yc = yahooFundCache.get(s);
    if (yc && yc.expiresAt > Date.now()) return false;
    return true;
  });

  if (toEnrich.length === 0) return;

  toEnrich.forEach(s => warmingSet.add(s));

  // Process in small batches of 5 to avoid overwhelming free endpoints
  const BATCH = 5;
  for (let i = 0; i < toEnrich.length; i += BATCH) {
    const batch = toEnrich.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async (symbol) => {
      try {
        await Promise.allSettled([
          fetchYahooFundamentals(symbol),
          fetchScreenerFundamentals(symbol),
          fetchStockNews(symbol),
        ]);
      } finally {
        warmingSet.delete(symbol);
      }
    }));
    // Small gap between batches to be polite to free endpoints
    if (i + BATCH < toEnrich.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

/**
 * Get enriched data from cache only — never triggers a network fetch.
 * Returns whatever is cached; null fields mean not yet enriched.
 * Safe to call inside the scan pipeline.
 */
export function getEnrichedFromCache(symbol: string): EnrichedStockData {
  const yahoo   = yahooFundCache.get(symbol)?.data ?? null;
  const screener = screenerCache.get(symbol)?.data ?? null;
  const news    = newsCache.get(symbol)?.headlines ?? [];

  const dataQuality: EnrichedStockData['dataQuality'] =
    yahoo && screener ? 'HIGH' :
    yahoo ? 'MEDIUM' : 'LOW';

  return {
    symbol,
    yahoo,
    screener,
    newsHeadlines: news,
    dataQuality,
    enrichedAt: new Date().toISOString(),
  };
}

// ─── Fundamental quality score ────────────────────────────────────────────────

export function computeFundamentalScore(enriched: EnrichedStockData): number {
  let score = 50;

  const y = enriched.yahoo;
  const s = enriched.screener;

  // PE from Yahoo (most reliable)
  const pe = y?.pe ?? s?.pe ?? null;
  if (pe !== null && pe > 0) {
    if (pe <= 15) score += 8;
    else if (pe <= 25) score += 5;
    else if (pe <= 40) score += 0;
    else if (pe <= 60) score -= 5;
    else score -= 10;
  }

  if (s) {
    if (s.roe !== null) {
      if (s.roe >= 25) score += 10;
      else if (s.roe >= 15) score += 6;
      else if (s.roe >= 10) score += 2;
      else score -= 4;
    }
    if (s.roce !== null) {
      if (s.roce >= 20) score += 8;
      else if (s.roce >= 15) score += 4;
      else if (s.roce < 10) score -= 4;
    }
    if (s.debtToEquity !== null) {
      if (s.debtToEquity <= 0.3) score += 8;
      else if (s.debtToEquity <= 0.8) score += 4;
      else if (s.debtToEquity > 1.5) score -= 8;
    }
    if (s.promoterHolding !== null) {
      if (s.promoterHolding >= 65) score += 8;
      else if (s.promoterHolding >= 50) score += 4;
      else if (s.promoterHolding < 30) score -= 6;
    }
    if (s.profitGrowth3yr !== null) {
      if (s.profitGrowth3yr >= 25) score += 8;
      else if (s.profitGrowth3yr >= 15) score += 4;
      else if (s.profitGrowth3yr < 0) score -= 8;
    }
    if (s.salesGrowth3yr !== null) {
      if (s.salesGrowth3yr >= 20) score += 5;
      else if (s.salesGrowth3yr >= 10) score += 2;
      else if (s.salesGrowth3yr < 0) score -= 5;
    }
  }

  // Near 52W high = momentum confirmation
  if (y?.weekHigh52 && y?.lastPrice) {
    if ((y.lastPrice / y.weekHigh52) >= 0.95) score += 6;
  }

  return Math.min(100, Math.max(0, score));
}
