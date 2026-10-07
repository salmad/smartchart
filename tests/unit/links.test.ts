import { describe, expect, it } from 'vitest'
import { md, mdLinked } from '../../src/engine/slides/render'
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
  it('links stay in source and footnote', () => {
    expect(validate(slide({ title: 'Read [this](https://x.com) now' })).errors.join(' ')).toMatch(/title: links go in source or footnote/)
    expect(validate(slide({ footnote: '[Method](https://x.com/m)' })).errors).toEqual([])
  })
  it('draws http(s) links in source and footnote as the words with an arrow, in a new tab with no opener; anything else stays text', () => {
    const a = (href: string, label: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}<svg class="ext"`
    expect(mdLinked('[ONS](https://ons.gov.uk/a?b=1&c=2)')).toContain(a('https://ons.gov.uk/a?b=1&amp;c=2', 'ONS'))
    expect(mdLinked('[x](javascript:alert(1))')).not.toContain('<a')
    expect(mdLinked('[x](https://e.com/"onmouseover="y)')).not.toContain('"onmouseover')
    expect(mdLinked('Revenue [[£9.4m]] [ONS](https://ons.gov.uk)')).toMatch(/^Revenue <span class="hl-focus">£9.4m<\/span> <a href="https:\/\/ons.gov.uk"/)
    // Elsewhere a link is never drawn (the validator keeps links out of other fields).
    expect(md('[ONS](https://ons.gov.uk)')).not.toContain('<a')
  })
})
