// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { LINK, linkName, pageText } from '@/app/links'

it('a link on its own is a link; a sentence with one is not', () => {
  expect(LINK.test('https://example.com/report-2026.pdf')).toBe(true)
  expect(LINK.test('see https://example.com')).toBe(false)
  expect(linkName('https://www.ons.gov.uk/business/reports/sme%20lending.pdf')).toBe('ons.gov.uk · sme lending.pdf')
})

it('a page is its article: no menus, footers, scripts or forms, block by block', () => {
  const { title, text } = pageText(`<html><head><title>Tab</title><meta property="og:title" content="SME lending in 2026"></head><body>
    <nav><a>Home</a><a>Pricing</a></nav><header>Sign up</header>
    <article><h1>SME lending in 2026</h1><p>A third of <b>small firms</b> need revolving credit.</p><ul><li>Banks cap limits at £25k</li></ul>
    <script>track()</script><form><input></form></article><footer>© 2026</footer></body></html>`)
  expect(title).toBe('SME lending in 2026')
  expect(text).toBe('SME lending in 2026\nA third of small firms need revolving credit.\nBanks cap limits at £25k')
})

it('boilerplate goes by its name, never the page itself; citation markers go too', () => {
  const { text } = pageText(`<html class="feature-main-menu-enabled"><body class="has-sidebar"><main>
    <p>SMEs are 99% of businesses.<sup class="reference">[3]</sup></p><div class="catlinks">Categories: Business</div>
    <div id="cookie-consent">We use cookies</div></main></body></html>`)
  expect(text).toBe('SMEs are 99% of businesses.')
})
