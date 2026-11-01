/** Renders public/og.png for link previews (X, iMessage, Slack). Run after landing copy changes. */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="2400" height="1260" viewBox="0 0 2400 1260" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="cut"><path d="M0 64V0h18L64 46v18z"/></clipPath>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F6F3EC"/>
      <stop offset="1" stop-color="#EDE8DC"/>
    </linearGradient>
  </defs>
  <rect width="2400" height="1260" fill="url(#glow)"/>
  <rect x="120" y="120" width="2160" height="1020" rx="48" fill="#0B0A09" opacity="0.04"/>
  <g transform="translate(160,148)">
    <rect x="1" y="1" width="62" height="62" rx="14" fill="#0B0A09" stroke="#D9D2C4" stroke-width="2"/>
    <circle cx="32" cy="32" r="19" fill="#E8B94A" clip-path="url(#cut)"/>
    <text x="88" y="46" fill="#0B0A09" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" letter-spacing="-0.02em">Occam</text>
  </g>
  <text x="160" y="420" fill="#0B0A09" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="400" letter-spacing="-0.03em">
    <tspan x="160" dy="0">Slides,</tspan>
    <tspan x="160" dy="120" font-style="italic" fill="#8A6220">scientifically precise.</tspan>
  </text>
  <text x="160" y="620" fill="#5C564C" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="400">
    <tspan x="160" dy="0">Laws, not vibes: every slide passes 57 checks</tspan>
    <tspan x="160" dy="56">for design, meaning and logic.</tspan>
  </text>
  <rect x="160" y="760" width="2080" height="360" rx="28" fill="#0B0A09"/>
  <rect x="160" y="760" width="1040" height="360" rx="28" fill="#FFFFFF" opacity="0.92"/>
  <text x="200" y="940" fill="#5C564C" font-family="system-ui, sans-serif" font-size="28">The same numbers, in your slide tool</text>
  <text x="1280" y="940" fill="#F3EEE4" font-family="system-ui, sans-serif" font-size="28">Occam</text>
  <text x="200" y="1040" fill="#0B0A09" font-family="system-ui, sans-serif" font-size="34" font-weight="600">Enterprise drove 64% of new revenue</text>
  <text x="1280" y="1040" fill="#F3EEE4" font-family="system-ui, sans-serif" font-size="34" font-weight="600">Enterprise drove 64% of new revenue</text>
  <text x="160" y="1180" fill="#8A8378" font-family="system-ui, sans-serif" font-size="32">occamslides.com · First slide free</text>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
console.log('wrote', out)
