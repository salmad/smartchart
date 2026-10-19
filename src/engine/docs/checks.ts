/* A doc's checks: the slide checks that are about content, run per figure with its caption as the title, and two of the
   doc's own (a figure with no caption, an empty section). They report and never change the doc. Layout checks (titles
   in 1920 px, density, takeaway against title, fit) stay with slides. */
import { focusCount, judgmentChecks, ruleChecks } from '../agent/checks.js'
import { softChecks } from '../agent/soft.js'
import type { JevFn } from '../agent/llm.js'
import { plain } from '../slides/schema.js'
import type { Slide } from '../types.js'
import { asSlide } from './figure.js'
import type { Doc, FigureBlock } from './types.js'

/** `id` is a slide check's own (R4 R5 R8 R9 R11 R13 R14 R15 S2 S3 J9 J10) or the doc's: D1 a figure has no caption,
    D2 a section is empty, D3 a figure could not be read. */
export interface DocCheck { blockId: string; id: string; ok: boolean; msg: string }

const CARRIED = new Set(['R5', 'R8', 'R9', 'R11', 'R13', 'R14', 'R15'])

/** The figure as the slide the checks read: its caption is the title. */
function asChecked(f: FigureBlock): Slide | null {
  const s = asSlide(f)
  if (!s) return null
  // The caption moves to the title: left in the body it would count as figures the figure shows.
  const { caption, ...rest } = s as Slide & { caption?: string }
  return { ...rest, title: caption ?? '' }
}
const captionOf = (f: FigureBlock) => (f.body.caption ?? (f.kind === 'number' ? f.body.number?.caption : undefined) ?? '').trim()

/** Code checks for one figure: the carried rules and the soft checks. A callout has none. */
export function figureChecks(f: FigureBlock): DocCheck[] {
  const s = asChecked(f)
  if (!s) return []
  const at = (c: { id: string; ok: boolean; msg: string }): DocCheck => ({ blockId: f.id, id: c.id, ok: c.ok, msg: c.msg })
  const rules = ruleChecks(s, 'consulting', 0).filter((c) => CARRIED.has(c.id)).map(at)
  // R4, as a doc has it: at most one element stands out. There is no title to carry the highlight.
  const fc = focusCount(s), r4: DocCheck[] = fc === null ? [] : [{ blockId: f.id, id: 'R4', ok: fc <= 1, msg: fc <= 1 ? 'At most one focus element' : `${fc} focus elements; one should stand out` }]
  return [...r4, ...rules, ...softChecks(s).map((c) => at({ id: c.id, ok: false, msg: c.msg }))]
}

/** Every check a doc has. Judgment checks (J9, J10, for tables) need `jev`; without one they are left out. Never throws. */
export async function checkDoc(doc: Doc, jev?: JevFn): Promise<DocCheck[]> {
  const out: DocCheck[] = []
  doc.blocks.forEach((b, i) => {
    if (b.type === 'heading' && b.level === 2) {
      const next = doc.blocks.slice(i + 1).findIndex((x) => x.type === 'heading' && x.level === 2), body = next < 0 ? doc.blocks.length - i - 1 : next
      if (!body) out.push({ blockId: b.id, id: 'D2', ok: false, msg: `The section “${plain(b.text)}” is empty: write it, or remove the heading` })
    }
  })
  for (const b of doc.blocks) {
    if (b.type !== 'figure' || b.kind === 'callout') continue
    try {
      if (!captionOf(b)) out.push({ blockId: b.id, id: 'D1', ok: false, msg: 'The figure has no caption: say what it shows' })
      out.push(...figureChecks(b))
      const s = asChecked(b)
      if (jev && s && b.kind === 'table') for (const c of (await judgmentChecks(s, 'consulting', jev, ['J9', 'J10'])).checks) out.push({ blockId: b.id, id: c.id, ok: c.ok, msg: c.msg })
    } catch {
      out.push({ blockId: b.id, id: 'D3', ok: false, msg: 'The figure could not be read: check each value against its card (get_template)' })
    }
  }
  return out
}

