import { describe, expect, it } from 'vitest'
import { md } from '../../src/engine/slides/render'
import { plain, validate } from '../../src/engine/slides/schema'
import { STARTERS, starterSlide } from '../../src/engine/starters'

const chart = starterSlide(STARTERS.find((x) => x.consulting.template === 'chart') ?? STARTERS[0], 'consulting')
const slide = (extra: Record<string, unknown>) => ({ ...chart, ...extra })

describe('linked sources', () => {
  it('a source can link a page; only the label counts toward the limit', () => {
    const url = 'https://example.com/' + 'a'.repeat(200)
    expect(validate(slide({ source: `[Company accounts 2025](${url})` })).errors).toEqual([])
    expect(plain(`See [Company accounts](${url}) p. 4`)).toBe('See Company accounts p. 4')
  })
  it('links stay out of the title and the other fields that state the point', () => {
    expect(validate(slide({ title: 'Read [this](https://x.com) now' })).errors.join(' ')).toMatch(/title: no links here/)
    expect(validate(slide({ footnote: '[Method](https://x.com/m)' })).errors).toEqual([])
  })
  it('draws http(s) links as the words with an arrow kept on the last word, in a new tab with no opener; anything else stays text', () => {
    const a = (href: string, label: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer"><span class="nw">${label}<svg class="ext"`
    expect(md('[ONS](https://ons.gov.uk/a?b=1&c=2)')).toContain(a('https://ons.gov.uk/a?b=1&amp;c=2', 'ONS'))
    expect(md('[x](javascript:alert(1))')).not.toContain('<a')
    expect(md('[x](https://e.com/"onmouseover="y)')).not.toContain('"onmouseover')
    expect(md('Revenue [[£9.4m]] [ONS](https://ons.gov.uk)')).toMatch(/^Revenue <span class="hl-focus">£9.4m<\/span> <a href="https:\/\/ons.gov.uk"/)
    expect(md('[Castel Savina winery](https://maps.example/q)')).toContain('Castel Savina <span class="nw">winery<svg class="ext"')
  })
})
