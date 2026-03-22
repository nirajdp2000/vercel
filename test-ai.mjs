import https from 'https';

const candles = Array.from({length: 50}, (_, i) => ({
  fullTime: new Date(Date.now() - (50-i)*5*60000).toISOString(),
  open: 2800 + Math.random()*50,
  high: 2850 + Math.random()*50,
  low:  2780 + Math.random()*50,
  close: 2820 + Math.random()*50,
  volume: 100000 + Math.random()*50000
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
      if (j.hedgeFund) {
        console.log('✅ SUCCESS — provider:', j.provider);
        console.log('   signal:', j.hedgeFund.signal, '| confidence:', j.hedgeFund.confidence);
        console.log('   regime:', j.hedgeFund.marketRegime);
        console.log('   summary:', j.hedgeFund.executiveSummary?.slice(0, 150));
        console.log('   keyLevels:', JSON.stringify(j.hedgeFund.keyLevels));
        console.log('   riskReward:', JSON.stringify(j.hedgeFund.riskReward));
      } else if (j.analysis && j.analysis.includes('fallback')) {
        console.log('⚠️  FALLBACK triggered — reason in analysis');
        console.log(j.analysis.slice(0, 400));
      } else {
        console.log('❓ UNEXPECTED response:', d.slice(0, 500));
      }
    } catch(e) {
      console.log('❌ PARSE ERROR:', e.message);
      console.log('RAW:', d.slice(0, 500));
    }
  });
});
req.on('error', e => console.log('❌ REQ_ERROR:', e.message));
req.write(body);
req.end();
