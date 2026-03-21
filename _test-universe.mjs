import axios from 'axios';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

async function test() {
  console.log('Fetching NSE instrument list...');
  try {
    const r = await axios.get(
      'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz',
      { responseType: 'arraybuffer', timeout: 30000 }
    );
    const buf = await gunzip(Buffer.from(r.data));
    const data = JSON.parse(buf.toString('utf8'));
    const eq = data.filter(i => i.instrument_type === 'EQ' && i.segment === 'NSE_EQ');
    console.log('Total instruments in file:', data.length);
    console.log('NSE_EQ stocks:', eq.length);
    console.log('Sample:', JSON.stringify(eq[0]));
  } catch (e) {
    console.error('NSE fetch failed:', e.message);
  }

  console.log('\nFetching BSE instrument list...');
  try {
    const r2 = await axios.get(
      'https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz',
      { responseType: 'arraybuffer', timeout: 30000 }
    );
    const buf2 = await gunzip(Buffer.from(r2.data));
    const data2 = JSON.parse(buf2.toString('utf8'));
    const BSE_EQUITY_TYPES = new Set(['A','B','X','XT','T','M','MT','Z','ZP','P','MS','R']);
    const bseEq = data2.filter(i => i.segment === 'BSE_EQ' && BSE_EQUITY_TYPES.has(i.instrument_type));
    console.log('Total BSE instruments:', data2.length);
    console.log('BSE equity stocks:', bseEq.length);
    console.log('Sample:', JSON.stringify(bseEq[0]));
  } catch (e) {
    console.error('BSE fetch failed:', e.message);
  }
}

test();
