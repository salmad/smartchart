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

test('a table that wraps with equal columns but fits one line per row sizes its columns to fit (L1 fitted)', async ({ page }) => {
  const lint = await open(page)
  const places = ['Perast + Our Lady of the Rocks', 'Kotor old town', 'Kotor–Lovćen cable car', 'Porto Montenegro', 'Naval Heritage Museum', 'Plavi Horizonti beach']
  const why = ['Boat ride Charles will love; UNESCO town', 'Walkable, cats everywhere, cafés', 'Gondola up the mountain; coaster for you', 'Superyachts, playground, dinner', 'Climb inside a real submarine', 'Soft sand, very gentle slope']
  const rows = places.map((p, i) => ({ cells: [p, why[i], '~20 min', '[Open](https://maps.example/q)'] }))
  const fit = await lint({ template: 'table', title: 'Eight places cover the trip; Castel Savina and Perast are the two not to miss', table: { columns: [{ label: 'Place' }, { label: 'Why it fits you' }, { label: 'From Tivat' }, { label: 'Map' }], rows } })
  expect(fit.issues, JSON.stringify(fit)).toEqual([])
  const oneLine = await page.$eval('.tbl', (t) => t.classList.contains('fitted') && [...t.querySelectorAll('tbody td')].every((td) => td.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(td).lineHeight) * (td.closest('.slide') as HTMLElement).getBoundingClientRect().width / 1920 + 20))
  expect(oneLine).toBe(true)
})

test('a table whose prose must wrap anyway still gives short columns their one-line width, so the prose wraps less', async ({ page }) => {
  const lint = await open(page)
  const long = 'A long reason that cannot fit on one line in any column of this table, however the widths are split'
  const rows = Array.from({ length: 3 }, (_, i) => ({ cells: [`Place ${i + 1}`, long, '~20 min', '[Open](https://maps.example/q)'] }))
  const fit = await lint({ template: 'table', title, table: { columns: [{ label: 'Place' }, { label: 'Why' }, { label: 'From Tivat' }, { label: 'Map' }], rows } })
  expect(fit.issues, JSON.stringify(fit)).toEqual([])
  const widths = await page.$eval('.tbl', (t) => [t.classList.contains('fitted'), ...[...t.querySelectorAll('thead th')].map((th) => Math.round(th.getBoundingClientRect().width))])
  expect(widths[0]).toBe(true)
  // The prose column is wider than the time and link columns together.
  expect((widths[2] as number) > (widths[3] as number) + (widths[4] as number)).toBe(true)
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

test('a target line sits where a bar of its value would end, from under the header to the last row, with no fit issues', async ({ page }) => {
  const lint = await open(page)
  const { TABLE_FLOW } = await import('../fixtures/flow-slides')
  const r = await lint(TABLE_FLOW as unknown as Slide)
  expect(r.issues, JSON.stringify(r)).toEqual([])
  const m = await page.$eval('.tbl', (tbl) => {
    const line = tbl.querySelector('.tbl-target') as HTMLElement, L = line.getBoundingClientRect()
    const track = tbl.querySelector('tbody td.has-bar > .cbar') as HTMLElement, T = track.getBoundingClientRect()
    const head = (tbl.querySelector('thead') as HTMLElement).getBoundingClientRect(), last = (tbl.querySelector('tbody tr:last-child') as HTMLElement).getBoundingClientRect()
    return { x: L.left, want: T.left + T.width * 14 / 34, top: L.top - head.bottom, bottom: L.bottom - last.bottom, pass: tbl.querySelectorAll('td.has-bar.pass').length }
  })
  expect(Math.abs(m.x - m.want)).toBeLessThanOrEqual(2)
  expect(Math.abs(m.top)).toBeLessThanOrEqual(2)
  expect(Math.abs(m.bottom)).toBeLessThanOrEqual(2)
  expect(m.pass).toBe(4)
})

test('heat text contrast in both palettes: every shaded, best and struck cell reads at 4.5:1, with no fit issues', async ({ page }) => {
  await page.goto('/src/dev/fixture.html')
  await page.waitForFunction(() => window.ready)
  const { HEAT_GRID: slide } = await import('../fixtures/flow-slides')
  for (const theme of ['ink', 'paper'] as const) {
    const r = await page.evaluate(([s, t]) => (window.lint as (s: Slide, st: Style, t: 'ink' | 'paper') => Promise<LintResult>)(s, 'consulting', t), [slide as unknown as Slide, theme] as const)
    expect(r.issues, `${theme} ${JSON.stringify(r)}`).toEqual([])
    const low = await page.$$eval('.tbl td.heat, .tbl td.struck', (tds) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const lum = ([r, g, b]: number[]) => [r, g, b].map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0)
      const bgOf = (el: Element): string => { for (let e: Element | null = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b } return 'rgb(255,255,255)' }
      return tds.flatMap((td) => { const [a, b] = [lum(rgb(getComputedStyle(td).color)), lum(rgb(bgOf(td)))].sort((x, y) => y - x), c = (a + .05) / (b + .05); return c < 4.5 ? [`${td.textContent} ${c.toFixed(2)}`] : [] })
    })
    expect(low, theme).toEqual([])
  }
})

test('the gallery flow slides (a flow beside a table, right and left) fit in both palettes, the flow level with the table', async ({ page }) => {
  const { TABLE_FLOW: S3, HEAT_GRID: S4 } = await import('../fixtures/flow-slides')
  await page.goto('/src/dev/fixture.html')
  await page.waitForFunction(() => window.ready)
  for (const [name, slide] of [['s3', S3], ['s4', S4]] as const) for (const theme of ['ink', 'paper'] as const) {
    const r = await page.evaluate(([s, t]) => (window.lint as (s: Slide, st: Style, t: 'ink' | 'paper') => Promise<LintResult>)(s, 'consulting', t), [slide as unknown as Slide, theme] as const)
    expect([...r.fit, ...r.issues], `${name} ${theme} ${JSON.stringify(r)}`).toEqual([])
    const m = await page.$eval('.split', (sp) => {
      const main = (sp.querySelector(':scope > .main') as HTMLElement).getBoundingClientRect(), flow = (sp.querySelector(':scope > .flow') as HTMLElement).getBoundingClientRect()
      return { top: Math.abs(main.top - flow.top), flowLeft: flow.left < main.left }
    })
    expect(m.top, `${name} ${theme}`).toBeLessThanOrEqual(2)
    expect(m.flowLeft, name).toBe(name === 's4')
  }
})

test('a chip too wide for its box is a fit issue', async ({ page }) => {
  const { TABLE_FLOW: S3 } = await import('../fixtures/flow-slides')
  const lint = await open(page)
  const tiers = S3.flow.tiers.map((t, i) => (i === 0 ? { ...t, boxes: [{ text: 'Wwwwwwwwwwwwww' }, ...t.boxes.slice(1)] } : t))
  const r = await lint({ ...S3, flow: { tiers } })
  expect(r.fit.some((m) => m.startsWith('fl-box') && /wider than its column/.test(m)), JSON.stringify(r)).toBe(true)
})

test('a table grows only as far as what follows it allows: a key under it never pushes the takeaway', async ({ page }) => {
  const lint = await open(page)
  const rows = ['£2.5k', '£5k', '£7.5k', '£10k', '£15k'].map((l, i) => ({ cells: [l, `£${10 + i}`, `£${20 + i}`, `[[£${30 + i}]]`] }))
  for (const notes of [false, true]) {
    const r = await lint({ template: 'table', title, caption: 'Profit · £', takeaway: 'The grid ends above this line.', ...(notes ? { notesTitle: 'Reading the grid', notes: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }] } : {}),
      table: { columns: [{ label: 'Limit' }, { label: 'A', heat: true }, { label: 'B', heat: true }, { label: 'C', heat: true }], rows, key: { focus: 'Our offer' } } })
    expect(r.fit, `notes ${notes} ${JSON.stringify(r)}`).toEqual([])
  }
})

test('the divider sits centred in the column gap over the exhibit; the arrow at its middle touches neither column', async ({ page }) => {
  const { TABLE_FLOW: S3, HEAT_GRID: S4 } = await import('../fixtures/flow-slides')
  const lint = await open(page)
  for (const [name, slide] of [['s3', S3], ['s4', S4]] as const) {
    await lint(slide)
    const m = await page.$eval('.split', (sp) => {
      const main = sp.querySelector(':scope > .main') as HTMLElement, side = sp.querySelector(':scope > .flow') as HTMLElement
      const M = main.getBoundingClientRect(), S = side.getBoundingClientRect(), line = getComputedStyle(main, '::after')
      const [l, r] = M.left < S.left ? [M, S] : [S, M], mid = (l.right + r.left) / 2, k = (sp.closest('.slide') as HTMLElement).getBoundingClientRect().width / 1920
      const lineX = M.left < S.left ? M.right + parseFloat(line.right) * -k : M.left + parseFloat(line.left) * k
      const a = sp.querySelector('.divider-arrow')?.getBoundingClientRect()
      return { off: Math.abs(lineX - mid), content: line.content, h: parseFloat(line.height) * k - M.height,
        arrow: a ? { cx: Math.abs((a.left + a.right) / 2 - mid), cy: Math.abs((a.top + a.bottom) / 2 - (M.top + M.bottom) / 2), clear: a.left > l.right && a.right < r.left } : null }
    })
    expect(m.content, name).toBe('""')
    expect(m.off, name).toBeLessThanOrEqual(2)
    expect(Math.abs(m.h), name).toBeLessThanOrEqual(2)
    if (name === 's4') { expect(m.arrow?.cx).toBeLessThanOrEqual(2); expect(m.arrow?.cy).toBeLessThanOrEqual(2); expect(m.arrow?.clear).toBe(true) }
    else expect(m.arrow).toBeNull()
  }
})
