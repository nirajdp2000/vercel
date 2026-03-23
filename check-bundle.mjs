import { readFileSync } from 'fs';
const lines = readFileSync('server.cjs', 'utf8').split('\n');
// Find buildApp function definition
const idx = lines.findIndex(l => l.includes('function buildApp'));
console.log('buildApp at line:', idx + 1, '|', lines[idx]);
// Show a few lines before it
for (let i = Math.max(0, idx - 3); i <= idx + 3; i++) {
  console.log(i + 1, lines[i]);
}
// Also check what's just before line 49430 (where NSE_STOCK_UNIVERSE ends)
console.log('\nLines 49420-49445:');
for (let i = 49420; i <= 49445; i++) {
  console.log(i + 1, lines[i]);
}


