import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
mkdirSync(new URL('./pdfs/templates/', import.meta.url), { recursive: true });
for (const key of ['perth', 'brisbane']) {
  const match = source.match(new RegExp(`${key}:\\s*'data:image/jpeg;base64,([^']+)'`));
  console.log(key, Boolean(match), match?.[1].length ?? 0);
  if (match) writeFileSync(new URL(`./pdfs/templates/${key}.jpg`, import.meta.url), Buffer.from(match[1], 'base64'));
}
