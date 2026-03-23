// Test how long the pure CPU scoring takes for the embedded universe
// This simulates what buildUltraQuantDashboard does in Pass 1

const NSE_COUNT = 440; // approximate embedded universe size
const DAYS = 1260; // 5 years * 252 days

console.log(`Simulating synthetic scoring for ${NSE_COUNT} stocks × ${DAYS} days...`);

const start = Date.now();

// Simulate the seeded candle generation + basic math per stock
let total = 0;
for (let s = 0; s < NSE_COUNT; s++) {
  let close = 100 + (s * 7.3);
  const closes = [];
  for (let d = 0; d < DAYS; d++) {
    close = close * (1 + 0.001 + (Math.random() - 0.5) * 0.05);
    closes.push(close);
  }
  // Simulate EMA, returns, drawdown calculations
  let peak = closes[0], maxDD = 0;
  for (const p of closes) {
    peak = Math.max(peak, p);
    maxDD = Math.max(maxDD, (peak - p) / peak);
  }
  total += maxDD;
}

const elapsed = Date.now() - start;
console.log(`Done in ${elapsed}ms (${(elapsed/NSE_COUNT).toFixed(1)}ms per stock)`);
console.log(total > 0 ? 'PASS' : 'FAIL');
