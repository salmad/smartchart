/* Doc readability checks D4–D7: walls of prose without exhibits. Code only; they warn and never rewrite. */
import { plain } from '../slides/schema.js'
import { identify } from './ops.js'
import type { DocCheck } from './checks.js'
import type { Block, Doc } from './types.js'

export const LONG_PARAGRAPH = 90
export const PROSE_RUN = 250
export const SECTION_WORDS = 150
export const PROSE_SHARE = 0.7

const wordsIn = (text: string) => {
  const t = plain(text).trim()
  return t ? t.split(/\s+/).filter(Boolean).length : 0
}

const isExhibit = (b: Block) => b.type === 'figure' && b.kind !== 'callout'
const breaksRun = (b: Block) => b.type === 'figure' || b.type === 'bullets' || b.type === 'numbered' || b.type === 'quote'

function sectionBodies(blocks: Block[], start: number): Block[] {
  const end = blocks.findIndex((b, i) => i > start && b.type === 'heading' && b.level === 2)
  return blocks.slice(start + 1, end < 0 ? undefined : end)
}

/** D4–D7 for the whole doc. Paragraph and run checks use identify ids for text blocks. */
export function readabilityChecks(doc: Doc): DocCheck[] {
  const out: DocCheck[] = []
  const ids = identify(doc)

  ids.forEach(({ id, block }) => {
    if (block.type === 'paragraph') {
      const n = wordsIn(block.text)
      if (n > LONG_PARAGRAPH) out.push({ blockId: id, id: 'D4', ok: false, msg: `This paragraph has ${n} words; shorten it or break it into bullets (max ${LONG_PARAGRAPH})` })
    }
  })

  let run = 0, runStart: string | null = null
  const flushRun = () => {
    if (run > PROSE_RUN && runStart) out.push({ blockId: runStart, id: 'D5', ok: false, msg: `${run} words of prose in a row with nothing to skim; add a figure, list or callout` })
    run = 0; runStart = null
  }
  for (const { id, block } of ids) {
    if (block.type === 'paragraph') {
      const n = wordsIn(block.text)
      run += n
      if (!runStart) runStart = id
    } else if (breaksRun(block)) flushRun()
  }
  flushRun()

  doc.blocks.forEach((b, i) => {
    if (b.type !== 'heading' || b.level !== 2) return
    const body = sectionBodies(doc.blocks, i)
    const prose = body.filter((x) => x.type === 'paragraph').reduce((n, p) => n + wordsIn(p.text), 0)
    const exhibits = body.filter(isExhibit).length
    if (prose > SECTION_WORDS && !exhibits) {
      out.push({ blockId: b.id, id: 'D6', ok: false, msg: `The section “${plain(b.text)}” has ${prose} words and no exhibit: add a chart, table or cards` })
    }
  })

  let proseWords = 0, allWords = 0, exhibits = 0, h2 = 0, bare = 0
  for (let i = 0; i < doc.blocks.length; i++) {
    const b = doc.blocks[i]
    if (b.type === 'heading' && b.level === 2) {
      h2++
      const body = sectionBodies(doc.blocks, i)
      if (!body.some(isExhibit)) bare++
    }
    if (b.type === 'paragraph') {
      const n = wordsIn(b.text)
      proseWords += n; allWords += n
    } else if (b.type === 'bullets' || b.type === 'numbered' || b.type === 'quote') {
      const t = b.type === 'quote' ? b.text : (b as { items: string[] }).items.join(' ')
      const n = wordsIn(t)
      allWords += n
    } else if (isExhibit(b)) {
      exhibits++
      const cap = plain(String((b as { body: { caption?: string } }).body.caption ?? ''))
      allWords += wordsIn(cap)
    }
  }
  const share = allWords ? proseWords / allWords : 1
  const need = Math.ceil(h2 / 2)
  const ok = !(share > PROSE_SHARE && exhibits < need)
  out.push({
    blockId: 'doc', id: 'D7', ok,
    msg: ok ? 'The doc reads through its exhibits' : `${proseWords} words, ${exhibits} exhibits, ${bare} of ${h2} sections have none`,
  })
  return out
}
