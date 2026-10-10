/* Layout lints on known-good and known-bad slides, measured at 1920×1080 in the dev fixture. */
import { test, expect, type Page } from '@playwright/test'
import type { Slide, Style } from '@/engine/types'
import type { LintResult } from '@/dev/fixture'

test.use({ viewport: { width: 1920, height: 1080 } })
const title = 'Revolvers carry the margin while transactors earn theirs on interchange alone'
const plan = [{ when: '0–6 mo', title: 'Build', text: 'First 100 cards.' }, { when: '6–18 mo', title: 'Prove', text: '£10m book.' }]

async function open(page: Page) {
  await page.goto('/src/dev/fixture.html')
  await page.waitForFunction(() => window.ready)
  return (slide: object, style: Style = 'consulting') =>
    page.evaluate(([s, st]) => (window.lint as (s: Slide, st: Style) => Promise<LintResult>)(s, st), [slide as Slide, style] as const)
}

test('a 2-row table with no notes leaves the body mostly empty: L5 warns, no issues', async ({ page }) => {
  const lint = await open(page)
  const sparse = await lint({ template: 'table', title, table: { columns: [{ label: 'Plan' }, { label: 'Price' }, { label: 'Margin' }], rows: [{ cells: ['Starter', '£0', '42%'] }, { cells: ['Growth', '£49', '61%'] }] } })
  expect(sparse.warnings.some((m) => m.startsWith('body:') && m.endsWith('(L5)')), JSON.stringify(sparse)).toBe(true)
  expect(sparse.issues).toEqual([])
})

test('a full 7-row table: equal columns (L1), gap right (L3), fills the body (L5)', async ({ page }) => {
  const lint = await open(page)
  const rows = Array.from({ length: 7 }, (_, i) => ({ cells: [`Line item ${i + 1}`, '(1,234)', '12,345', '(34)'] }))
  const full = await lint({ template: 'table', title, table: { columns: [{ label: '£ per customer per month' }, { label: 'Revolver' }, { label: 'Transactor' }, { label: 'Super' }], rows } })
  expect([...full.issues, ...full.warnings]).toEqual([])
})

test('a table that wraps with equal columns but fits one line per row sizes its columns to fit (L1 one-line)', async ({ page }) => {
  const lint = await open(page)
  const places = ['Perast + Our Lady of the Rocks', 'Kotor old town', 'Kotor–Lovćen cable car', 'Porto Montenegro', 'Naval Heritage Museum', 'Plavi Horizonti beach']
  const why = ['Boat ride Charles will love; UNESCO town', 'Walkable, cats everywhere, cafés', 'Gondola up the mountain; coaster for you', 'Superyachts, playground, dinner', 'Climb inside a real submarine', 'Soft sand, very gentle slope']
  const rows = places.map((p, i) => ({ cells: [p, why[i], '~20 min', '[Open](https://maps.example/q)'] }))
  const fit = await lint({ template: 'table', title: 'Eight places cover the trip; Castel Savina and Perast are the two not to miss', table: { columns: [{ label: 'Place' }, { label: 'Why it fits you' }, { label: 'From Tivat' }, { label: 'Map' }], rows } })
  expect(fit.issues, JSON.stringify(fit)).toEqual([])
  const oneLine = await page.$eval('.tbl', (t) => t.classList.contains('one-line') && [...t.querySelectorAll('tbody td')].every((td) => td.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(td).lineHeight) * (td.closest('.slide') as HTMLElement).getBoundingClientRect().width / 1920 + 20))
  expect(oneLine).toBe(true)
})

test('pitch gap is 72 px: no L3 issue', async ({ page }) => {
  const lint = await open(page)
  const pitch = await lint({ template: 'steps', title: 'The plan', subtitle: 'Five million to a funded book.', steps: [
    { when: '0–6 mo', title: 'Build', text: 'First 100 cards.' }, { when: '6–18 mo', title: 'Prove', text: '£10m book.' }, { when: 'Year 2', title: 'Scale', text: '£120m book.' }] }, 'pitch')
  expect(pitch.issues.some((m) => m.endsWith('(L3)')), JSON.stringify(pitch)).toBe(false)
})

test('L3: the body starts on the same line whatever the title, kicker or subtitle length', async ({ page }) => {
  const lint = await open(page)
  const tops = async (style: Style, heads: object[]) => {
    const ys: (number | null)[] = []
    for (const h of heads) ys.push((await lint({ template: 'steps', ...h, steps: plan }, style)).bodyTop)
    expect(ys.every(Number.isFinite), JSON.stringify(ys)).toBe(true)
    return new Set(ys)
  }
  expect((await tops('consulting', [{ title }, { title: 'Revolvers carry the margin' }, { title: 'Revolvers carry the margin', kicker: '02 · Economics' }])).size).toBe(1)
  expect((await tops('pitch', [{ title: 'The plan', subtitle: 'Five million to a funded book.' },
    { title: 'The plan', subtitle: 'Five million pounds gets us to a funded book by 2027.' }])).size).toBe(1)
})
