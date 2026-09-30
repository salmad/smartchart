/* The storyline: the deck as its titles, checked like a partner; a failed check fixes itself by a move or a prompt. */
import { test, expect } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const pick = (id: string) => (starters as { id: string; consulting: Record<string, unknown> }[]).find((s) => s.id === id)?.consulting ?? {}
const slides = [pick('cover'), { ...pick('chart-cagr'), title: 'Revenue grew [[4.5×]] in three years' }, { ...pick('table'), title: 'Option C is the only one that keeps the top customers' }, { ...pick('cards-icon'), title: 'Approve [[option C]] now' }]
const deck = { id: 'd_s', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: slides.map((slide, i) => ({ id: `s_${i}`, slide, status: 'ok', errors: [], warnings: [], checks: [] })) }

test('the storyline reads the titles in order, moves the answer first, and asks Occam for a rewrite', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify({ active: 'd_s', decks: { d_s: deck } })] as const)
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  const asked: string[] = []
  // Jev: the answer is on the "Approve" slide; slide 3 repeats a point; everything else passes.
  await page.route('**/api/jev', (r) => {
    const { state, questions } = r.request().postDataJSON() as { state: string; questions: Record<string, { criteria: Record<string, string> }> }
    if (!('D2' in questions)) return r.fulfill({ status: 503, json: { error: 'down' } })
    const approve = /(\S+) \[cards\] Approve/.exec(state)?.[1] ?? ''
    const answers = Object.fromEntries(Object.entries(questions).map(([id, q]) => {
      const choice = id === 'D1' ? approve : id === 'D3' ? 's_2' : Object.keys(q.criteria)[0]
      return [id, { choice, probabilities: { [choice]: 0.9 } }]
    }))
    asked.push(state)
    return r.fulfill({ json: { answers } })
  })
  await page.route('**/api/glm', (r) => r.fulfill({ status: 503, json: { error: 'down' } }))
  await page.goto('/d/d_s')
  await page.getByRole('button', { name: 'Storyline' }).click()

  const dialog = page.getByRole('dialog', { name: 'The storyline' })
  await expect(dialog.getByRole('list', { name: 'Storyline' }).getByRole('button')).toHaveText([/Revenue grew 4\.5× in three years/, /Option C is the only one/, /Approve option C now/])
  await expect(dialog).toContainText('2 to look at')
  await expect(dialog).toContainText('Slide 3 repeats an earlier point')
  await dialog.getByRole('button', { name: 'Move slide 4 first' }).click()
  await expect(dialog).toHaveCount(0)
  // After the cover, the answer leads, and it is the slide shown.
  await expect.poll(() => page.evaluate(() => window.__journey?.items.map((i) => i.id))).toEqual(['s_0', 's_3', 's_1', 's_2'])
  await expect.poll(() => page.evaluate(() => window.__journey?.current)).toBe(1)

  // The storyline changed, so it is read again; the repeat is sent to Occam as a prompt.
  await page.getByRole('button', { name: 'Storyline' }).click()
  await expect(dialog).toContainText('The answer comes first')
  expect(asked).toHaveLength(2)
  await dialog.getByRole('button', { name: 'Ask Occam' }).click()
  await expect(page.locator('aside')).toContainText('Slide 4 makes the same point as an earlier slide.')
})
