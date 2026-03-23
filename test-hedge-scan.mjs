import { createRequire } from 'module';
const require = createRequire(import.meta.url);
process.env.VERCEL = '1';
import { readFileSync } from 'fs';
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

const mod = require('./server.cjs');
const app = await mod.startServerlessApp();

import http from 'http';
const server = http.createServer(app);
server.listen(3002, async () => {
  const req = http.request({
    hostname: 'localhost', port: 3002,
    path: '/api/ultra-quant/hedge-fund-ranking', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      const data = JSON.parse(body);
      if (Array.isArray(data)) {
        console.log('Response is array, length:', data.length);
      } else {
        console.log('Response keys:', Object.keys(data));
        console.log('summary:', JSON.stringify(data?.summary, null, 2));
      }
      server.close();
      process.exit(0);
    });
  });
  req.write('{}');
  req.end();
});
