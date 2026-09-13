// توليد أيقونات PWA (192/512) — تشغيل: node scripts/gen-pwa-icons.cjs
const sharp = require("sharp");
const path = require("path");

const SVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d4a853"/>
      <stop offset="1" stop-color="#a87a2b"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#171310"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.34}" fill="url(#g)"/>
  <rect x="${size * 0.40}" y="${size * 0.30}" width="${size * 0.085}" height="${size * 0.32}" rx="${size * 0.03}" fill="#171310"/>
  <rect x="${size * 0.515}" y="${size * 0.30}" width="${size * 0.085}" height="${size * 0.32}" rx="${size * 0.03}" fill="#171310"/>
  <rect x="${size * 0.40}" y="${size * 0.545}" width="${size * 0.20}" height="${size * 0.09}" rx="${size * 0.04}" fill="#171310"/>
  <rect x="${size * 0.456}" y="${size * 0.605}" width="${size * 0.088}" height="${size * 0.15}" rx="${size * 0.04}" fill="#171310"/>
</svg>`;

async function main() {
  for (const size of [192, 512]) {
    const buf = Buffer.from(SVG(size));
    await sharp(buf).png().toFile(path.join(__dirname, "..", "public", `icon-${size}.png`));
    console.log(`icon-${size}.png ✓`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});