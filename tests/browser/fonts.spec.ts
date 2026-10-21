/* Fonts are ours: no request to Google, every face the slides ask for loads from /fonts, and text paints in a fallback first. */
import { test, expect } from '@playwright/test'

const FACES = ['800 100px Archivo', '900 100px Archivo', '400 30px Geist', '600 30px Geist', "500 20px 'Geist Mono'", '400 30px "Instrument Serif"']

test('the faces are self-hosted and swap', async ({ page }) => {
  const outside: string[] = []
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) outside.push(r.url()) })
  await page.goto('/home')
  await page.evaluate((faces) => Promise.all(faces.map((f) => document.fonts.load(f, 'Aa Ж'))), FACES)
  await page.evaluate(() => document.fonts.ready)
  expect(outside).toEqual([])
  const loaded = await page.evaluate((faces) => faces.map((f) => ({ f, ok: document.fonts.check(f) })), FACES)
  for (const { f, ok } of loaded) expect(ok, f).toBe(true)
  const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))
  for (const name of ['Archivo', 'Geist', 'Geist Mono', 'Instrument Serif']) expect(families, name).toContain(name)
  const display = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules] } catch { return [] } })
    .filter((r): r is CSSFontFaceRule => r instanceof CSSFontFaceRule && !/Fallback/.test(r.style.getPropertyValue('font-family')))
    .map((r) => r.style.getPropertyValue('font-display')))
  expect(display.length).toBeGreaterThan(0)
  expect(new Set(display)).toEqual(new Set(['swap']))
})

test('Cyrillic text in the app font loads its own subset', async ({ page }) => {
  await page.goto('/home')
  await page.evaluate(() => document.fonts.load('400 30px Geist', 'Привет'))
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Geist') && f.status === 'loaded' && /U\+0?400-0?45F/i.test(f.unicodeRange)))).toBe(true)
})
