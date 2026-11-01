/** Renders public/og.png for link previews (X, iMessage, Slack). Run after landing copy changes. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'og.png')

const server = await createServer({
  configFile: path.join(root, 'vite.config.ts'),
  server: { port: 0, strictPort: true, host: '127.0.0.1' },
  logLevel: 'error',
})
await server.listen()
const base = server.resolvedUrls?.local[0]
if (!base) throw new Error('vite did not publish a local URL')

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 2400, height: 1260 } })
  await page.goto(new URL('src/dev/og-capture.html', base).href, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForSelector('.ba .slide', { timeout: 60_000 })
  await page.waitForTimeout(400)
  await page.locator('#og').screenshot({ path: out, type: 'png', animations: 'disabled' })
  console.log('wrote', out)
} finally {
  await browser.close()
  await server.close()
}
