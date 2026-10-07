/* The starters' pictures, made through the same pipeline as add_image (api/_lib/images.ts) and bundled under
   public/starters/img/ with the name convention slides read kind and size from.

     npx vite-node scripts/starter-images/build.ts

   Logos: the SVGs in ./logos. The screenshot: ./acme-app.html, drawn by Playwright at 2×. Team photos: generated
   headshots of fictional people, kept outside git in docs/temp/starter-photos (the processed files are committed). */
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { prepare } from '../../api/_lib/images'
import type { ImageKind } from '../../src/engine/slides/images'

const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, '../..')
const out = path.join(root, 'public/starters/img'), photos = path.join(root, 'docs/temp/starter-photos')
mkdirSync(out, { recursive: true })
const made: Record<string, string> = {}

async function save(slug: string, bytes: Uint8Array, kind: ImageKind) {
  const p = await prepare(bytes, kind), file = `${slug}-${kind}-${p.w}x${p.h}.${p.ext}`
  for (const old of readdirSync(out)) if (old.startsWith(`${slug}-${kind}-`)) rmSync(path.join(out, old))
  writeFileSync(path.join(out, file), p.bytes)
  made[slug] = `/starters/img/${file}`
}

for (const f of readdirSync(path.join(here, 'logos')).filter((f) => f.endsWith('.svg')).sort())
  await save(f.replace(/\.svg$/, ''), readFileSync(path.join(here, 'logos', f)), 'logo')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 2 })
await page.goto(`file://${path.join(here, 'acme-app.html')}`)
await page.evaluate(() => document.fonts.ready)
await save('acme-app', await page.screenshot({ type: 'png' }), 'screenshot')
await browser.close()

if (existsSync(photos)) for (const f of readdirSync(photos).filter((f) => /\.(png|jpe?g|webp)$/.test(f)).sort())
  await save(f.replace(/\.\w+$/, ''), readFileSync(path.join(photos, f)), 'photo')

console.log(JSON.stringify(made, null, 2))
