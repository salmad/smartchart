/* One brand, one set of numbers. The app's chrome and the site's Ink look read --brand-* (src/index.css). Two places
   cannot read a CSS variable of the app's: the slides' and docs' Ink theme (the engine's own stylesheet, used unchanged)
   and the boot frame in index.html (painted before any stylesheet). This holds them to the same values. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const hex = (channels: string) => `#${channels.trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`

const css = read('src/index.css')
const brand = (name: string) => {
  const m = css.match(new RegExp(`--brand-${name}:\\s*([\\d ]+);`))
  if (!m) throw new Error(`--brand-${name} is not in src/index.css`)
  return hex(m[1])
}

describe('the brand palette', () => {
  it('is the Ink theme the slides and docs draw in', () => {
    const ink = read('src/engine/components/components.css').match(/\.theme-ink\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(ink.match(/--bg:\s*(#[0-9A-Fa-f]{6})/)?.[1].toUpperCase()).toBe(brand('black'))
    expect(ink.match(/--surface:\s*(#[0-9A-Fa-f]{6})/)?.[1].toUpperCase()).toBe(brand('black-2'))
  })

  it('is the boot frame painted before the stylesheet loads', () => {
    const html = read('index.html')
    expect(html).toContain(`html, body { background: ${brand('black')} }`)
    expect(html).toContain(`#boot .chat { width: 360px; background: ${brand('black')} }`)
  })

  it('is written out nowhere else in the app chrome', () => {
    const config = read('tailwind.config.js')
    for (const name of ['black', 'black-2', 'black-3', 'cream', 'cream-2', 'cream-3', 'gold']) expect(config).not.toContain(brand(name))
    // The site's Ink look points at the brand, it does not repeat it.
    const ink = css.match(/\.site\[data-look="ink"\]\s*\{([^}]*)\}/)?.[1] ?? ''
    for (const token of ['paper', 'paper-2', 'card', 'type', 'type-3', 'focus', 'night']) expect(ink).toMatch(new RegExp(`--site-${token}:\\s*var\\(--brand-`))
  })
})
