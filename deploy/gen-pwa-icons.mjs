// Genera le icone PNG della PWA in app/web/public/pwa/.
// Uso: npm i sharp in una cartella qualsiasi, poi SHARP_DIR=<quella cartella> node deploy/gen-pwa-icons.mjs
import { createRequire } from 'node:module';
const sharp = createRequire((process.env.SHARP_DIR || process.cwd()) + '/')('sharp');
import { readFileSync, mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const out = root + '/app/web/public/pwa/';
mkdirSync(out, { recursive: true });
const icon = readFileSync(root + '/brand/icons/level-1.svg', 'utf8');
const fav = readFileSync(root + '/brand/favicon.svg', 'utf8');

// Versione "a tutto campo": sfondo pieno senza angoli arrotondati, pittogramma scalato.
function fullBleed(svg, scale) {
  const defs = svg.match(/<defs>.*?<\/defs>/s)[0];
  const rect = svg.match(/<rect[^>]*\/>/)[0];
  const bg = rect.replace(/\s*rx="[^"]*"/, '');
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(defs, '').replace(rect, '');
  const off = 60 * (1 - scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${defs}${bg}<g transform="translate(${off} ${off}) scale(${scale})">${inner}</g></svg>`;
}
const png = (svg, size, name) => sharp(Buffer.from(svg), { density: 72 * size / 120 * 2 }).resize(size, size).png().toFile(out + name);
await png(icon, 192, 'icon-192.png');
await png(icon, 512, 'icon-512.png');
await png(fullBleed(icon, 0.72), 512, 'icon-maskable-512.png');
await png(fullBleed(icon, 0.9), 180, 'apple-touch-icon.png');
await png(fav, 32, 'favicon-32.png');
console.log('ok');
