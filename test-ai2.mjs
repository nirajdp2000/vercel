import https from 'https';

const candles = Array.from({length: 50}, (_, i) => ({
  fullTime: new Date(Date.now() - (50-i)*5*60000).toISOString(),
  open: 2800 + i*2,
  high: 2860 + i*2,
  low:  2780 + i*2,
  close: 2830 + i*2,
  volume: 100000 + i*1000
}));

const body = JSON.stringify({ symbol: 'RELIANCE', interval: '5minute', data: candles });

const req = https.request({
  hostname: 'nirajstock.vercel.app',
  path: '/api/ai/analyze',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log('provider:', j.provider);
      console.log('has hedgeFund:', !!j.hedgeFund);
      if (j.hedgeFund) {
        console.log('signal:', j.hedgeFund.signal);
        console.log('confidence:', j.hedgeFund.confidence);
        console.log('regime:', j.hedgeFund.marketRegime);
        console.log('summary:', j.hedgeFund.executiveSummary);
      } else {
        // Show first 600 chars to see what fallback says
        console.log('FULL RESPONSE (first 600):', d.slice(0, 600));
      }
    } catch(e) {
      console.log('PARSE ERROR:', e.message, 'RAW:', d.slice(0,300));
    }
  });
});
req.on('error', e => console.log('REQ_ERROR:', e.message));
req.write(body);
req.end();
