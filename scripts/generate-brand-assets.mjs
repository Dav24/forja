// Genera los assets de marca (ícono, splash, adaptive) desde SVG con sharp.
// Uso: node scripts/generate-brand-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const CARBON = '#0C0A09';

const emberSvg = (s, { halo = true, bg = null } = {}) => `
<svg width="${s}" height="${s}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="coal" cx="50%" cy="55%" r="60%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="55%" stop-color="#F97316"/>
      <stop offset="100%" stop-color="#EA580C"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="#F97316" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${bg ? `<rect width="44" height="44" fill="${bg}"/>` : ''}
  ${halo ? '<circle cx="22" cy="22" r="21" fill="url(#halo)"/>' : ''}
  <circle cx="22" cy="22" r="13" fill="url(#coal)"/>
  <circle cx="22" cy="22" r="5.5" fill="${CARBON}"/>
</svg>`;

const monoSvg = (s) => `
<svg width="${s}" height="${s}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <circle cx="22" cy="22" r="13" fill="#FFFFFF"/>
  <circle cx="22" cy="22" r="5.5" fill="#000000"/>
</svg>`;

const solidSvg = (color) => `<svg width="108" height="108" xmlns="http://www.w3.org/2000/svg"><rect width="108" height="108" fill="${color}"/></svg>`;

mkdirSync('assets', { recursive: true });
const render = (svg, size, out) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(out).then(() => console.log('✓', out));

await render(emberSvg(1024, { bg: CARBON }), 1024, 'assets/icon.png');
await render(emberSvg(1024, { bg: null }), 1024, 'assets/splash-icon.png');
await render(emberSvg(1024, { halo: false }), 1024, 'assets/android-icon-foreground.png');
await render(solidSvg(CARBON), 1024, 'assets/android-icon-background.png');
await render(monoSvg(1024), 1024, 'assets/android-icon-monochrome.png');
