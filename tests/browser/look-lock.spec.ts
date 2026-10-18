/* Look lock, for refactors that must not change a pixel: every starter and stress slide, in both styles and both
   themes, screenshotted at full size from the review page. LOOK=write records docs/temp/look/ (gitignored, local);
   LOOK=1 compares and writes <name>.after.png beside each one that changed. Skipped without LOOK.
   The fitters measure in design pixels: a table fits the same at any size (always runs). */
import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STARTERS } from '@/engine/starters'
import { stressFor } from '../fixtures/stress'

const DIR = fileURLToPath(new URL('../../docs/temp/look/', import.meta.url))
const MODE = process.env.LOOK
test.use({ viewport: { width: 1920, height: 1080 } })

const SETS = [{ name: 'starter', query: '', count: STARTERS.length }, { name: 'stress', query: '&stress=1', count: stressFor('consulting').length }]

for (const set of SETS) for (const style of ['consulting', 'pitch']) for (const theme of ['ink', 'paper']) {
  test(`${set.name} slides look as locked: ${style}, ${theme}`, async ({ page }) => {
    test.skip(!MODE, 'set LOOK=write to record or LOOK=1 to compare')
    test.setTimeout(300_000)
    mkdirSync(DIR, { recursive: true })
    const changed: string[] = []
    for (let i = 0; i < set.count; i++) {
      const name = `${set.name}-${i}-${style}-${theme}`
      await page.goto(`/src/dev/review.html?style=${style}&theme=${theme}&full=1&only=${i}${set.query}`)
      await page.waitForFunction(() => window.__fit)
      await page.evaluate(() => document.fonts.ready)
      const png = await page.locator('.frame .slide').screenshot({ animations: 'disabled' })
      const file = `${DIR}${name}.png`
      if (MODE === 'write') { writeFileSync(file, png); continue }
      if (!existsSync(file)) { changed.push(`${name} (no baseline)`); continue }
      if (!png.equals(readFileSync(file))) { writeFileSync(`${DIR}${name}.after.png`, png); changed.push(name) }
    }
    expect(changed).toEqual([])
  })
}

test('a table fits the same at half and full size', async ({ page }) => {
  await page.goto('/src/dev/fixture.html')
  await page.waitForFunction(() => window.ready)
  const at = (slide: unknown, style: string, width: number) => page.evaluate(([s, st, w]) => window.cols?.(s as never, st as never, w), [slide, style, width] as const)
  let fitted = 0
  for (const s of STARTERS.filter((x) => x.consulting.template === 'table')) for (const style of ['consulting', 'pitch'] as const) {
    const full = await at(s[style], style, 1920), half = await at(s[style], style, 960)
    fitted += full?.filter((w) => w !== '').length ?? 0
    expect(half, `${s.id} ${style}`).toEqual(full)
  }
  expect(fitted).toBeGreaterThan(0)
})
