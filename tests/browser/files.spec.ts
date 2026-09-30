/* Files dropped on the chat are read in the browser and go with the message: PDF, Word, Excel and CSV. */
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()

test('a PDF, a Word doc, a spreadsheet and a CSV are read in the browser and go with the message', async ({ page, browser }) => {
  // A real PDF, made by Chromium from a page of text.
  const maker = await browser.newPage()
  await maker.setContent('<h1>Q3 board pack</h1><p>Gross margin rose to 38% on interchange.</p>')
  const pdf = await maker.pdf()
  await maker.close()

  const sent: string[] = []
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.route('**/api/jev', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.route('**/api/glm', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.goto('/new')

  await page.locator('input[type=file]').setInputFiles([
    { name: 'board-pack.pdf', mimeType: 'application/pdf', buffer: pdf },
    { name: 'board-memo.docx', mimeType: 'application/octet-stream', buffer: readFileSync('tests/fixtures/files/board-memo.docx') },
    { name: 'revenue.xlsx', mimeType: 'application/octet-stream', buffer: readFileSync('tests/fixtures/files/revenue.xlsx') },
    { name: 'segments.csv', mimeType: 'text/csv', buffer: Buffer.from('Segment,Share\nSME,62\nCorporate,38\n') },
  ])
  const chips = page.getByRole('list', { name: 'Attached files' })
  await expect(chips).toContainText('board-pack.pdf1 page')
  await expect(chips).toContainText('board-memo.docx13 words')
  await expect(chips).toContainText('revenue.xlsx1 sheet')
  await expect(chips).toContainText('segments.csv3 rows')

  await page.getByRole('textbox').fill('Make the Q3 case')
  await page.getByRole('button', { name: /Make slides/ }).click()
  await expect(chips).toHaveCount(0)
  await expect.poll(() => sent.length).toBeGreaterThan(0)
  const body = sent.join('\n')
  for (const said of ['Make the Q3 case', 'Gross margin rose to 38% on interchange.', 'churn fell to 2.1% in Q3', 'Sheet: Plan', '2025\\t9.4', 'Corporate,38'])
    expect(body).toContain(said)
  // The chat shows the files as chips on the message, not their text.
  await expect(page.getByText('Make the Q3 case')).toBeVisible()
  await expect(page.getByText('revenue.xlsx')).toBeVisible()
  await expect(page.getByText('Net revenue retention reached 118%.')).toHaveCount(0)
})

test('a file Occam cannot read says why, and can be removed', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.goto('/new')
  await page.locator('input[type=file]').setInputFiles({ name: 'deck.pptx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
  await expect(page.getByText('Couldn’t read')).toBeVisible()
  await expect(page.getByRole('button', { name: /Make a slide/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Remove deck.pptx' }).click()
  await expect(page.getByRole('list', { name: 'Attached files' })).toHaveCount(0)
})

test('a file dropped anywhere on the editor joins the message, and the page stays', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.goto('/new')
  await expect(page.getByRole('textbox')).toBeEnabled() // the models answered: sending is open
  const dt = await page.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['Segment,Share\nSME,62\n'], 'mix.csv')); return d })
  await page.locator('main').dispatchEvent('dragover', { dataTransfer: dt })
  await expect(page.getByText('Drop to add to your message')).toBeVisible()
  await page.locator('main').dispatchEvent('drop', { dataTransfer: dt })
  await expect(page.getByRole('list', { name: 'Attached files' })).toContainText('mix.csv2 rows')
  await expect(page.getByText('Drop to add to your message')).toHaveCount(0)
  await expect(page).toHaveURL(/\/new$/)
})
