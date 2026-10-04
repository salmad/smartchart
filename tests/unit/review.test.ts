import { describe, expect, it } from 'vitest'
import { pageBySize, pptxPage, readPptx, unzip } from '@/app/deck-file'
import { codeNotes, deckText, kindOf, rebuildAsk, reviewDeck } from '@/engine/agent/review'
import { fakeJev } from './fakes'
import { makeZip, slideXml } from './zip-fixture'

describe('reading a deck made anywhere', () => {
  it('unzips stored and deflated entries, keeping only the wanted ones', async () => {
    for (const deflate of [false, true]) {
      const z = await makeZip({ 'a.txt': 'hello hello hello', 'b.txt': 'skip' }, deflate)
      const files = await unzip(z, (n) => n === 'a.txt')
      expect([...files.keys()]).toEqual(['a.txt'])
      expect(new TextDecoder().decode(files.get('a.txt'))).toBe('hello hello hello')
    }
  })
  it('reads PPTX slides in number order: title placeholder, then body; entities decoded', async () => {
    const z = await makeZip({
      'ppt/slides/slide10.xml': slideXml('Ten', ['x']),
      'ppt/slides/slide2.xml': slideXml('Revenue &amp; margin', ['Revenue grew 21%', 'Margin 66%']),
      'ppt/slides/slide1.xml': slideXml('Q3 review', []),
      'ppt/presentation.xml': '<p/>',
    }, true)
    expect(await readPptx(z)).toEqual([{ title: 'Q3 review', body: '' }, { title: 'Revenue & margin', body: 'Revenue grew 21%\nMargin 66%' }, { title: 'Ten', body: 'x' }])
  })
  it('a slide with no title placeholder takes its first text as the title; tables are read', () => {
    const xml = '<p:sld><p:sp><p:txBody><a:p><a:r><a:t>First</a:t></a:r></a:p></p:txBody></p:sp><a:tbl><a:tr><a:tc><a:p><a:r><a:t>A</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>1</a:t></a:r></a:p></a:tc></a:tr></a:tbl></p:sld>'
    expect(pptxPage(xml)).toEqual({ title: 'First', body: 'A\t1' })
  })
  it('a PDF page’s largest text is its title', () => {
    expect(pageBySize([{ str: 'Churn', size: 40 }, { str: 'halved', size: 39 }, { str: 'Q1 4.2%', size: 14, eol: true }, { str: 'Q3 2.4%', size: 14 }]))
      .toEqual({ title: 'Churn halved', body: 'Q1 4.2%\nQ3 2.4%' })
  })
})

describe('the red-pen review', () => {
  const pages = [
    { title: 'Acme Q3 review', body: 'Board, October' },
    { title: 'Revenue', body: 'Revenue grew from £4.2m to £5.1m, up 21% on new customers and expansion.' },
    { title: 'Revenue', body: 'More revenue detail £0.7m' },
    { title: 'Next steps', body: '' },
  ]
  it('finds covers and section dividers', () => {
    expect(pages.map(kindOf)).toEqual(['cover', 'content', 'content', 'section'])
  })
  it('code notes: no figure in a consulting title, repeated titles, long titles, walls of text', () => {
    const n = codeNotes([...pages, { title: 'A very long title that goes on and on about many many things in the business this quarter', body: 'word '.repeat(130) }], 'consulting')
    expect(n[1]).toEqual(['The slide has figures but the title quantifies nothing: put the so-what figure in it'])
    expect(n[2]).toContain('Same title as slide 2')
    expect(n[4].join(' ')).toMatch(/runs to 18 words.*130 words of body text/)
    expect(codeNotes(pages, 'pitch')[1]).toEqual([])
  })
  it('one Jev call adds topic titles and the deck checks; the verdict counts the notes; Rebuild carries them', async () => {
    const jev = fakeJev({ T2: ['topic', 0.9], T3: ['topic', 0.8], D3: ['p3', 0.85] })
    const r = await reviewDeck(pages, 'consulting', jev)
    expect(jev.calls).toHaveLength(1)
    expect(r.pages[1].notes[0]).toMatch(/names a topic/)
    expect(r.pages[2].notes).toContain('Slide 3 repeats an earlier point')
    expect(r.verdict).toMatch(/notes on 4 slides; most titles name topics/)
    expect(deckText(pages, r)).toMatch(/Review \(.*\)\n- .*\n[\s\S]*- Slide 2: The title names a topic/)
    expect(rebuildAsk('pitch')).toMatch(/as a pitch deck/)
    expect(deckText(pages)).toMatch(/^Slide 1: Acme Q3 review\nBoard, October/)
  })
})
