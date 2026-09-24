import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';
async function diff(a, b) {
  const ia = await loadImage(a); const ib = await loadImage(b);
  const W = Math.max(ia.width, ib.width), H = Math.max(ia.height, ib.height);
  if (ia.width !== ib.width || ia.height !== ib.height) return { mismatch: `${a}=${ia.width}x${ia.height} ${b}=${ib.width}x${ib.height}` };
  const ca = createCanvas(W, H), cb = createCanvas(W, H);
  const xa = ca.getContext('2d').drawImage(ia, 0, 0);
  const da = ca.getContext('2d').getImageData(0, 0, W, H).data;
  const xb = cb.getContext('2d').drawImage(ib, 0, 0);
  const db = cb.getContext('2d').getImageData(0, 0, W, H).data;
  let changed = 0, sum = 0, max = 0; const n = da.length / 4;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]);
    if (d > 84) changed++; sum += d; if (d > max) max = d;
  }
  return { dims: `${W}x${H}`, changedPct: +(100*changed/n).toFixed(3), meanAbs: +(sum/n).toFixed(2), max };
}
const [out, tpl] = process.argv.slice(2);
const results = {};
for (let n = 1; n <= 5; n++) {
  results[`page${n}`] = await diff(`${out}-p${n}.png`, `${tpl}${n}.jpg`);
}
console.log(JSON.stringify(results, null, 1));
let fail = 0;
for (const k in results) { if (results[k].mismatch || results[k].changedPct > 0.5 || results[k].meanAbs > 2) { console.log('FAIL', k); fail = 1; } }
process.exit(fail);
