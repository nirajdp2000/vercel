-- Run this once in the Supabase SQL Editor (https://supabase.com/dashboard/project/xtnubimeoawyjkvkkxaz/sql)
-- Creates tables used to persist EOD data across Vercel cold starts

-- 1. fundamentals_cache — ROE/ROCE/PE/52W/Promoter% per symbol
CREATE TABLE IF NOT EXISTS fundamentals_cache (
  symbol            TEXT PRIMARY KEY,
  pe                NUMERIC,
  roe               NUMERIC,
  roce              NUMERIC,
  debt_to_equity    NUMERIC,
  promoter_holding  NUMERIC,
  week_high_52      NUMERIC,
  week_low_52       NUMERIC,
  last_price        NUMERIC,
  p_change          NUMERIC,
  market_cap        NUMERIC,
  book_value        NUMERIC,
  dividend_yield    NUMERIC,
  sales_growth_3yr  NUMERIC,
  profit_growth_3yr NUMERIC,
  fetched_at        BIGINT NOT NULL DEFAULT (extract(epoch from now())*1000)::BIGINT
);

ALTER TABLE fundamentals_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON fundamentals_cache FOR SELECT USING (true);
CREATE POLICY "service write" ON fundamentals_cache FOR ALL USING (auth.role() = 'service_role');

-- 2. ohlcv_cache — daily OHLCV candles (JSON array) per symbol
CREATE TABLE IF NOT EXISTS ohlcv_cache (
  symbol      TEXT PRIMARY KEY,
  candles     JSONB NOT NULL DEFAULT '[]',
  live_price  NUMERIC,
  change_pct  NUMERIC,
  fetched_at  BIGINT NOT NULL DEFAULT (extract(epoch from now())*1000)::BIGINT
);

ALTER TABLE ohlcv_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read ohlcv"   ON ohlcv_cache FOR SELECT USING (true);
CREATE POLICY "service write ohlcv" ON ohlcv_cache FOR ALL USING (auth.role() = 'service_role');
