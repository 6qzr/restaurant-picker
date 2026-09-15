/** Rasterize the app icon. Chrome's installability criteria and iOS both want
 *  real PNGs -- an SVG-only manifest means no install prompt and a screenshot
 *  for the home-screen icon. */
import fs from 'node:fs';

// sharp is NOT a project dependency. The generated icons are committed, so a
// deploy build has no reason to install a ~50MB native image library. Install
// it only when you actually need to regenerate them.
let sharp;
try {
    ({ default: sharp } = await import('sharp'));
} catch {
    console.error('This script needs sharp, which is not installed by default.');
    console.error('Run:  npm i -D --no-save sharp@0.33.5 && npm run icons');
    process.exit(1);
}

const pin = (stroke) => `
  <g transform="translate(6, 6) scale(0.8333)">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="10" r="3" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#23201f"/>${pin('#f7f4f1')}</svg>`;

/** Maskable art must survive a circular crop, so the glyph sits inside the
 *  ~80% safe zone on a full-bleed ground. */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#23201f"/>
  <g transform="translate(16,16) scale(0.72) translate(-16,-16)">${pin('#f7f4f1')}</g></svg>`;

fs.mkdirSync('public/icons', { recursive: true });

const jobs = [
    [square, 192, 'public/icons/icon-192.png'],
    [square, 512, 'public/icons/icon-512.png'],
    [maskable, 512, 'public/icons/icon-512-maskable.png'],
    [square, 180, 'public/icons/apple-touch-icon.png'],
];

for (const [svg, size, out] of jobs) {
    await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
    console.log('wrote', out, size + 'x' + size);
}
