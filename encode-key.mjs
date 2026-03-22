// Encode the key to base64 cleanly
const key = [
  "sk-proj-d9XemQ3vqoREvzpq7k9Y3Xlgt",
  "E291qNajMXrnKvrZzWEUBxwg1hrk9mjIxg",
  "GAoZkWOBR5TAbEJT3BlbkFJ-6z3TNMTLQc",
  "lhem4DU-6Qlpq8n-5mU48imK4kUhZukMVr",
  "DxkO8l2VGoVfGW2NhJ5Cip1BfwkIA"
].join('');

const b64 = Buffer.from(key).toString('base64');
console.log('KEY LENGTH:', key.length);
console.log('B64:', b64);

// Verify round-trip
const decoded = Buffer.from(b64, 'base64').toString('utf8');
console.log('MATCH:', decoded === key);
console.log('DECODED STARTS:', decoded.slice(0, 20));
