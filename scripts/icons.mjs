// Rasterises public/icon.svg into the PNG icons required by PWA installers
// and the Open Graph preview image. Runs automatically before `npm run build`.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url));
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;

for (const size of [192, 512]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(`icon-${size}.png`));
}

const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1A1F3D"/><stop offset="1" stop-color="#05070F"/></radialGradient>
  <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#3CF0C5"/><stop offset=".5" stop-color="#36C9F5"/><stop offset="1" stop-color="#B57BFF"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="600" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="110" letter-spacing="8" fill="url(#t)">NEON SERPENT</text>
  <text x="600" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" letter-spacing="22" fill="#9AA3C7">COSMOS</text>
</svg>`);
await sharp(og).png().toFile(out('og.png'));
console.log('icons: generated icon-192.png, icon-512.png, og.png');
