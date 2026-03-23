import axios from 'axios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function parseScreener(symbol) {
  const url = `https://www.screener.in/company/${symbol}/`;
  const r = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Referer': 'https://www.screener.in' } });
  const html = r.data;
  
  // Extract top-ratios
  const ratioSection = html.match(/id="top-ratios"[^>]*>([\s\S]{0,5000})<\/ul>/)?.[1] ?? '';
  const items = [...ratioSection.matchAll(/<span class="name">\s*(.*?)\s*<\/span>[\s\S]*?<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,.-]+)<\/span>/g)];
  const ratios = {};
  items.forEach(m => { ratios[m[1].trim()] = m[2].replace(/,/g, ''); });
  
  // Promoter holding - look in shareholding section
  const promoterMatch = html.match(/class="[^"]*shareholding[^"]*"[\s\S]{0,2000}?Promoters?[\s\S]{0,500}?(\d+\.\d+)/i)
    ?? html.match(/Promoters?[\s\S]{0,100}?(\d+\.\d+)%/);
  
  // D/E - look in balance sheet or key ratios table
  // Screener shows it as "Debt / Equity" in the ratios section for leveraged companies
  const deMatch = html.match(/Debt\s*\/\s*Equity[\s\S]{0,100}?<span[^>]*>([\d.]+)<\/span>/i)
    ?? html.match(/data-source[^>]*>[\s\S]{0,50}Debt\s*\/\s*Equity[\s\S]{0,200}?number[^>]*>([\d.]+)/i);
  
  console.log(`${symbol}:`, { ...ratios, promoter: promoterMatch?.[1], de: deMatch?.[1] });
}

// Test with a leveraged company
await parseScreener('TATAMOTORS');
await parseScreener('ADANIENT');
