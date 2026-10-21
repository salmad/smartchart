import { test, expect } from 'vitest'
import { asyncCss } from '../../vite/async-css'

const run = (html: string) => {
  const t = asyncCss().transformIndexHtml
  const handler = typeof t === 'function' ? t : (t as { handler: (h: string) => string }).handler
  return (handler as (h: string) => string).call({}, html)
}
const page = (link: string) => `<head><script>var href = /*stylesheet*/null</script><script type="module" src="/assets/index-a.js"></script>${link}</head>`

test('the stylesheet’s link leaves the page and its file is named for the inline loader', () => {
  const out = run(page('<link rel="stylesheet" crossorigin href="/assets/index-B-Wp.css">\n'))
  expect(out).not.toContain('rel="stylesheet"')
  expect(out).toContain('var href = /*stylesheet*/"/assets/index-B-Wp.css"')
  expect(out).toContain('<script type="module" src="/assets/index-a.js"></script>')
})

test('a page with no stylesheet is left as it is', () => {
  const html = page('')
  expect(run(html)).toBe(html)
})
