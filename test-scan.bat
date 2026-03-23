@echo off
curl -s --max-time 20 -X POST https://nirajstock.vercel.app/api/ultra-quant/scan -H "Content-Type: application/json" -d "{}" > scan_result.json
node -e "const d=require('fs').readFileSync('scan_result.json','utf8'); try{const j=JSON.parse(d); const first=j[0]; console.log('Count:',j.length); console.log('First symbol:',first?.symbol); console.log('currentPrice:',first?.currentPrice); console.log('dataSource:',first?.dataSource); console.log('pChange:',first?.pChange); const live=j.filter(x=>x.dataSource==='live'||x.dataSource==='LIVE'); const sim=j.filter(x=>x.dataSource==='synthetic'||x.dataSource==='simulated'); console.log('LIVE:',live.length,'SIM:',sim.length);}catch(e){console.log('Parse error:',e.message,d.substring(0,300));}"
del scan_result.json
