/* Rehearse, under the storyline: the room's questions per slide; an answer goes into the slide's speaker notes, and a
   question the deck cannot answer becomes a request for a backup slide. */
import { test, expect } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const pick = (id: string) => (starters as { id: string; consulting: Record<string, unknown> }[]).find((s) => s.id === id)?.consulting ?? {}
const slides = [pick('cover'), pick('chart-notes'), pick('table')]
const deck = { id: 'd_r', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: slides.map((slide, i) => ({ id: `s_${i}`, slide, status: 'ok', errors: [], warnings: [], checks: [] })) }
const room = { slides: [
  { n: 2, questions: [{ q: 'What if interchange rates are capped?', answer: 'The UK cap is 0.3% on business cards; the model already uses it.', gap: false }] },
  { n: 3, questions: [{ q: 'How many revolvers do you need?', answer: 'The deck does not say; a mix sensitivity table would.', gap: true }] },
] }

test('the room asks; an answer goes into the speaker notes; a gap asks for a backup slide', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify({ active: 'd_r', decks: { d_r: deck } })] as const)
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  const sent: string[] = []
  await page.route('**/api/jev', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.route('**/api/glm', (r) => {
    const body = r.request().postData() ?? ''
    sent.push(body)
    return /You are the room/.test(body) ? r.fulfill({ json: { choices: [{ message: { content: JSON.stringify(room) } }] } }) : r.fulfill({ status: 503, json: { error: 'down' } })
  })
  await page.goto('/d/d_r')
  await page.getByRole('button', { name: 'Storyline' }).click()
  const view = page.getByRole('region', { name: 'Rehearse' })
  await view.getByRole('button', { name: 'Ask me the room’s questions' }).click()
  await expect(view.getByText('“What if interchange rates are capped?”')).toBeVisible()
  await expect(view.getByText(/Not in the deck: The deck does not say/)).toBeVisible()
  await view.getByRole('button', { name: 'Add the answer to my notes' }).click()
  await expect(view.getByText('In your speaker notes')).toBeVisible()
  expect(await page.evaluate(() => (window.__journey?.items[1].slide as { talk?: string }).talk)).toBe('If asked "What if interchange rates are capped?": The UK cap is 0.3% on business cards; the model already uses it.')
  await view.getByRole('button', { name: 'Ask for a backup slide' }).click()
  await expect.poll(() => sent.some((b) => b.includes('Add a backup slide after slide 3'))).toBe(true)
})
