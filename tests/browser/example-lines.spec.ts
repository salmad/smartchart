/* Line-count lock (spec 4.1): every leaf text element of every starter (locked from the 788f4d7 examples), in both styles on Ink, keeps its
   number of lines. WRITE_LINES=1 records tests/fixtures/example-lines.json; otherwise the test compares. */
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STARTERS } from '@/engine/starters'

const FILE = fileURLToPath(new URL('../fixtures/example-lines.json', import.meta.url))
type Lines = Record<string, number[]>[]
test.use({ viewport: { width: 1920, height: 1080 } })

test('example line counts are locked', async ({ page }) => {
  const got: Lines = []
  for (let i = 0; i < STARTERS.length; i++) {
    got[i] = {}
    for (const style of ['consulting', 'pitch']) {
      await page.goto(`/src/dev/review.html?style=${style}&full=1&only=${i}`)
      await page.waitForFunction(() => window.__fit)
      got[i][style] = await page.$eval('.frame .slide', (slide) => {
        const k = slide.getBoundingClientRect().width / 1920
        return [...slide.querySelectorAll('*')]
          .filter((el) => !el.children.length && el.textContent?.trim())
          .map((el) => Math.round(el.getBoundingClientRect().height / k / parseFloat(getComputedStyle(el).lineHeight)))
      })
    }
  }
  if (process.env.WRITE_LINES) { writeFileSync(FILE, JSON.stringify(got, null, 1)); return }
  expect(existsSync(FILE), 'run with WRITE_LINES=1 first').toBe(true)
  const locked = JSON.parse(readFileSync(FILE, 'utf8')) as Lines
  got.forEach((g, i) => expect(g, STARTERS[i].id).toEqual(locked[i]))
})
