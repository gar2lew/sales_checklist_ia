const { execSync } = require('child_process');
const fs = require('fs');
const path = 'C:/Users/great/AppData/Local/Temp/opencode/tools/poppler-26.07.0/Library/bin/';

function wordsFromXml(xml) {
  const out = [];
  for (const m of xml.matchAll(/(?:<word|>\s*-?[\d.]+\s*)/g)) {}
  for (const m of xml.matchAll(/<word[^>]*>([^<]+)<\/word>/g)) {
    const a = m[0].match(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/);
    if (a) out.push({ x1: +a[1], y1: +a[2], x2: +a[3], y2: +a[4], t: m[1] });
  }
  return out;
}

const origXml = execSync(`"${path}pdftotext.exe" -bbox templates/ASG-Disclosure-Waiver-2026.pdf -`, { encoding: 'latin1', maxBuffer: 1 << 26 });
const cleanXml = execSync(`"${path}pdftotext.exe" -bbox tmp/waiver-verify/sanitized.pdf -`, { encoding: 'latin1', maxBuffer: 1 << 26 });

const pageSplit = (xml) => {
  const pages = [];
  for (const m of xml.matchAll(/<page[^>]*>([\s\S]*?)<\/page>/g)) pages.push(m[1]);
  return pages;
};
const origPages = pageSplit(origXml);
const cleanPages = pageSplit(cleanXml);
console.log('pages orig', origPages.length, 'clean', cleanPages.length);

let mismatches = 0;
for (let i = 0; i < 6; i++) {
  const ow = wordsFromXml(origPages[i]);
  const cw = wordsFromXml(cleanPages[i]);
  const of = ow.filter((w) => !((w.y1 >= 800 && w.y2 <= 820)));
  const cf = cw.filter((w) => !((w.y1 >= 800 && w.y2 <= 820)));
  if (of.length !== cf.length) {
    console.log(`page ${i + 1}: word count differing body ${of.length} vs ${cf.length}`);
    mismatches++;
    continue;
  }
  let pageDiff = 0;
  for (let k = 0; k < of.length; k++) {
    const a = of[k], b = cf[k];
    if (a.t !== b.t) { pageDiff++; if (pageDiff <= 3) console.log(`  page${i + 1} word ${k} TEXT: '${a.t}' -> '${b.t}'`); continue; }
    const dx = Math.abs(a.x1 - b.x1), dy = Math.abs(a.y1 - b.y1);
    if (dx > 0.35 || dy > 0.35) { pageDiff++; if (pageDiff <= 3) console.log(`  page${i + 1} word ${k} POS: '${a.t}' (${a.x1},${a.y1}) -> (${b.x1},${b.y1}) d(${dx},${dy})`); }
  }
  console.log(`page ${i + 1}: body words ${of.length}, positional/text mismatches ${pageDiff}`);
  mismatches += pageDiff;
}
console.log('TOTAL mismatches:', mismatches);