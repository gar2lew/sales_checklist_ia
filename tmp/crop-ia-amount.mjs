import { readFileSync } from 'node:fs';
// Coordinate note only; cropping is performed by the bundled image runtime.
console.log(readFileSync(new URL('./pdfs/templates/perth.jpg', import.meta.url)).length);
