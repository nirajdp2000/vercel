import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

import { readFileSync } from 'fs';
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

console.log('Loading server module...');
const t0 = Date.now();
const mod = require('./server.cjs');
console.log(`Module loaded in ${Date.now() - t0}ms`);

const t1 = Date.now();
console.log('Calling startServerlessApp...');
const app = await mod.startServerlessApp();
console.log(`startServerlessApp done in ${Date.now() - t1}ms`);

import http from 'http';
const server = http.createServer(app);
server.listen(3001, async () => {
  console.log('Test server on :3001\n');

  const doScan = (label) => new Promise((resolve) => {
    const t = Date.now();
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: '/api/ultra-quant/scan', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const elapsed = Date.now() - t;
        try {
          const data = JSON.parse(body);
          const count = Array.isArray(data) ? data.length : '?';
          console.log(`[${label}] ${res.statusCode} | ${elapsed}ms | ${count} stocks returned | ${body.length} bytes`);
          resolve(elapsed);
        } catch {
          console.log(`[${label}] Parse error after ${elapsed}ms`);
          resolve(elapsed);
        }
      });
    });
    req.on('error', e => { console.log(`[${label}] ERROR: ${e.message}`); resolve(9999); });
    req.setTimeout(9000, () => { console.log(`[${label}] TIMEOUT`); req.destroy(); resolve(9999); });
    req.write('{}');
    req.end();
  });

  const doMBScan = (label) => new Promise((resolve) => {
    const t = Date.now();
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: '/api/multibagger/scan?cycle=90', method: 'GET',
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const elapsed = Date.now() - t;
        try {
          const data = JSON.parse(body);
          console.log(`[${label}] ${res.statusCode} | ${elapsed}ms | universe=${data.scannedUniverse} | returned=${data.returned}`);
          resolve(elapsed);
        } catch {
          console.log(`[${label}] Parse error after ${elapsed}ms`);
          resolve(elapsed);
        }
      });
    });
    req.on('error', e => { console.log(`[${label}] ERROR: ${e.message}`); resolve(9999); });
    req.setTimeout(9000, () => { console.log(`[${label}] TIMEOUT`); req.destroy(); resolve(9999); });
    req.end();
  });

  // Test 1: Cold scan (embedded universe, 434 stocks)
  const t1 = await doScan('UltraQuant cold');
  const t2 = await doMBScan('Multibagger cold');

  // Wait for Supabase background load
  console.log('\nWaiting 8s for Supabase background load...');
  await new Promise(r => setTimeout(r, 8000));

  // Test 2: Warm scan (should use 5000+ stocks now)
  const t3 = await doScan('UltraQuant warm');
  const t4 = await doMBScan('Multibagger warm');

  const total = Date.now() - t0;
  console.log(`\nTotal test time: ${total}ms`);
  const allPass = [t1, t2, t3, t4].every(t => t < 9000);
  console.log(allPass ? '\n✓ ALL PASS — no timeouts' : '\n✗ SOME FAILED — check above');

  server.close();
  process.exit(allPass ? 0 : 1);
});
