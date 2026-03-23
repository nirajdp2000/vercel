// Directly test how long analyzeUltraQuantProfile takes for 100 stocks
// by loading the actual server module

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Time just the pure computation without server startup
const STOCKS = 100;
const DAYS = 1260;

function seededGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function symbolSeed(s) { return Array.from(s).reduce((sum, c) => sum + c.charCodeAt(0), 0); }
function average(arr) { return arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0; }
function buildEma(values, period) {
  if (!values.length) return [];
  const m = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) ema.push((values[i] - ema[i-1]) * m + ema[i-1]);
  return ema;
}

const symbols = Array.from({length: STOCKS}, (_, i) => `STOCK${i}`);

console.log(`Timing full analyzeUltraQuantProfile for ${STOCKS} stocks...`);
const start = Date.now();

for (const sym of symbols) {
  const random = seededGenerator(symbolSeed(sym));
  const candles = [];
  let close = 80 + random() * 1800;
  for (let d = 0; d < DAYS; d++) {
    const drift = 0.001 + Math.sin(d/31 + random()) * 0.006 + (random()-0.5)*0.05;
    close = Math.max(20, close * (1 + drift));
    const high = close * (1 + 0.002 + random() * 0.02);
    const low = close * (1 - 0.002 - random() * 0.018);
    candles.push({ open: close, high, low, close, volume: 1000000 * (0.85 + random() * 0.9) });
  }
  const closes = candles.map(c => c.close);
  // EMA calculations (the heavy part)
  const ema20 = buildEma(closes, 20);
  const ema50 = buildEma(closes, 50);
  const ema200 = buildEma(closes, 200);
  // Volume profile (iterates all candles)
  const vpMap = new Map();
  for (const c of candles) {
    const bin = Math.round(c.close / Math.max(1, c.close * 0.0025)) * Math.max(1, c.close * 0.0025);
    vpMap.set(bin, (vpMap.get(bin) ?? 0) + c.volume);
  }
  // Returns
  const returns = [];
  for (let i = 1; i < closes.length; i++) returns.push((closes[i]-closes[i-1])/closes[i-1]);
  const mean = average(returns);
  const vol = Math.sqrt(average(returns.map(r => (r-mean)**2)));
}

const elapsed = Date.now() - start;
console.log(`Done: ${elapsed}ms total, ${(elapsed/STOCKS).toFixed(1)}ms per stock`);
console.log(elapsed < 3000 ? 'FAST ENOUGH' : 'TOO SLOW - need optimization');
