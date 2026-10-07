/* A link pasted on its own into the chat is read and attached like a dropped file; the agent gets the article's text. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const article = `<html><head><title>SME credit in 2026 · Example Research</title></head><body><nav>Menu</nav><article><h1>SME credit in 2026</h1>
  <p>${'A third of UK small firms need revolving credit, but banks cap card limits at £25k. '.repeat(6)}</p><p>Card spend by SMEs grows 13% a year to 2030.</p></article><footer>Cookies</footer></body></html>`

const paste = (text: string) => {
  const box = document.querySelector('textarea')
  const data = new DataTransfer()
  data.setData('text/plain', text)
  box?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
}

test('a pasted link becomes an attachment, read in the browser, and goes to the agent with the message', async ({ page }) => {
  const sent: string[] = []
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.route('**/api/read', (r) => r.fulfill({ body: article, headers: { 'content-type': 'text/html; charset=utf-8', 'x-final-url': 'https://research.example/sme-credit-2026' } }))
  await page.route('**/api/jev', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.route('**/api/glm', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.goto('/new')
  await page.evaluate(paste, 'https://research.example/sme-credit-2026')
  const chips = page.getByRole('list', { name: 'Attached files' })
  await expect(chips).toContainText('SME credit in 2026 · Example Research · research.example')
  await expect(chips).toContainText(/\d+ words/)
  await expect(page.locator('textarea')).toHaveValue('')
  await page.locator('textarea').fill('Make the market slide from this')
  await page.keyboard.press('Enter')
  await expect.poll(() => sent.join(' ')).toContain('Card spend by SMEs grows 13% a year to 2030.')
  expect(sent.join(' ')).not.toContain('Cookies')
})
