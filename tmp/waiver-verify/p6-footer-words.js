const fs = require('fs');
const xml = fs.readFileSync('tmp/waiver-verify/p6bbox.xml', 'latin1');
const words = [];
for (const m of xml.matchAll(/<word[^>]*>([^<]+)<\/word>/g)) {
  const attrs = m[0].match(/xMin="([\d.]+)"[^>]*yMin="([\d.]+)"[^>]*xMax="([\d.]+)"[^>]*yMax="([\d.]+)"/);
  if (attrs) words.push({ xMin: +attrs[1], yMin: +attrs[2], xMax: +attrs[3], yMax: +attrs[4], w: m[1] });
}
console.log('footer band words (yMin 780-820):');
for (const w of words.filter((x) => x.yMin > 780 && x.yMin < 820)) {
  console.log(JSON.stringify(w));
}