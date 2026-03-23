// Directly test the scan by requiring the server module
// This bypasses HTTP and tests the actual function timing

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Load .env manually
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

// Now simulate a scan request
import http from 'http';
const server = http.createServer(app);
server.listen(3001, () => {
  console.log('Test server on :3001');
  
  const t2 = Date.now();
  const req = http.request({
    hostname: 'localhost', port: 3001,
    path: '/api/ultra-quant/scan', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      const elapsed = Date.now() - t2;
      console.log(`Scan response: ${res.statusCode} in ${elapsed}ms, ${body.length} bytes`);
      const total = Date.now() - t0;
      console.log(`Total from module load: ${total}ms`);
      console.log(elapsed < 8000 ? '✓ PASS - within Vercel limit' : '✗ FAIL - too slow');
      server.close();
      process.exit(0);
    });
  });
  req.on('error', e => { console.log('Request error:', e.message); server.close(); process.exit(1); });
  req.setTimeout(12000, () => { console.log('TIMEOUT'); server.close(); process.exit(1); });
  req.write('{}');
  req.end();
});
