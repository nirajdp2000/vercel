@echo off
echo === UltraQuant Scan Tab ===
curl -s --max-time 20 -X POST https://nirajstock.vercel.app/api/ultra-quant/scan -H "Content-Type: application/json" -d "{}" > scan_out.json
node -e "const j=JSON.parse(require('fs').readFileSync('scan_out.json','utf8')); console.log('Count:',j.length,'| First:',j[0]?.symbol,'price:',j[0]?.currentPrice,'src:',j[0]?.dataSource,'pChange:',j[0]?.pChange); const live=j.filter(x=>x.dataSource&&x.dataSource!=='synthetic').length; console.log('Non-synthetic:',live,'/',j.length);"
del scan_out.json

echo.
echo === Multibagger Scan Tab (cycle=90) ===
curl -s --max-time 20 "https://nirajstock.vercel.app/api/multibagger/scan?cycle=90" > mb_out.json
node -e "const j=JSON.parse(require('fs').readFileSync('mb_out.json','utf8')); const s=j.stocks||[]; console.log('Count:',s.length,'| First:',s[0]?.symbol,'price:',s[0]?.currentPrice,'src:',s[0]?.dataSource,'bullish:',s[0]?.bullishScore); const live=s.filter(x=>x.dataSource&&x.dataSource!=='synthetic').length; console.log('Non-synthetic:',live,'/',s.length);"
del mb_out.json
