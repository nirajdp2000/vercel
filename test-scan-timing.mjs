import http from 'http';

const start = Date.now();

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ultra-quant/scan',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`Status: ${res.statusCode} | Time: ${elapsed}s | Size: ${body.length} bytes`);
    if (res.statusCode === 200) {
      const data = JSON.parse(body);
      console.log(`Results: ${Array.isArray(data) ? data.length : 'N/A'} stocks`);
      console.log('PASS - scan completed within timeout');
    } else {
      console.log('FAIL - non-200 response');
    }
  });
});

req.on('error', (e) => {
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`ERROR after ${elapsed}s: ${e.message}`);
});

req.setTimeout(12000, () => {
  console.log(`TIMEOUT after 12s - would fail on Vercel`);
  req.destroy();
});

req.write('{}');
req.end();
