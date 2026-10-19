/* The issues on a deck's slide in edit mode: limits from the schema, fit from the measurer, rules as counts. */
import { ruleChecks } from '@/engine/agent/checks'
import { validate } from '@/engine/slides/schema'
import { issuePath } from '@/engine/slides/edit'
import type { Deck, Slide, Style } from '@/engine/types'
import type { Measurer } from '../measure'
import type { Issue } from './useSlideEdit'

export function deckCheck(deck: Deck, index: number, style: Style, measurer: () => Measurer): (d: Slide) => Issue[] {
  return (d) => {
    const m = measurer()
    let fit: Issue[] = []
    try { m.measure(d, deck, index); fit = m.located } catch (e) { fit = [{ msg: `slide could not be rendered: ${e instanceof Error ? e.message : String(e)}` }] }
    const limits = validate(d, style).errors.map((msg) => ({ msg, path: issuePath(msg) }))
    const rules = ruleChecks(d, style, m.lines).filter((c) => !c.ok).map((c) => ({ msg: `${c.id}: ${c.msg}` }))
    return [...limits, ...fit, ...rules]
  }
}
