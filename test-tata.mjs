import axios from 'axios';
const UA = 'Mozilla/5.0';
const r = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/TATAMOTORS.NS?interval=1d&range=5d', {timeout:6000, headers:{'User-Agent':UA}});
const meta = r.data?.chart?.result?.[0]?.meta;
console.log('symbol:', meta?.symbol, 'price:', meta?.regularMarketPrice);
