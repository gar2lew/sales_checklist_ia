import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8766/', { waitUntil:'domcontentloaded' });
const r = await page.evaluate(async () => {
  const load = src => new Promise(res => {
    const img = new Image();
    const t = setTimeout(() => res({src, state:'timeout'}), 15000);
    img.onload = () => { clearTimeout(t); res({src, state:'ok', w:img.naturalWidth, h:img.naturalHeight}); };
    img.onerror = () => { clearTimeout(t); res({src, state:'err'}); };
    img.src = src;
  });
  const a = await load('icons/asg_logo.png');
  const b = await load('templates/rendered/waiver-page-6.jpg');
  return { a, b };
});
console.log(JSON.stringify(r));
await browser.close();
