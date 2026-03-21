const r = await fetch('https://nirajstock.vercel.app/api/stocks/universe');
const d = await r.json();
console.log('Live universe count:', d.length);
console.log('Sample:', d.slice(0,3).map(s => s.symbol).join(', '));

// Also check if it's the fallback (440) or real (5000+)
if (d.length < 500) {
  console.log('❌ Still returning fallback list!');
} else {
  console.log('✅ Full universe returned');
}
