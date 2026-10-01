/* Saving a hand edit (spec 5): the agent's write pipeline without shortening, the slide's checks as after a turn,
   and a note for the next turn's deck state. Returns null when saved, or why it was not. */
import { checkWrite } from '@/engine/agent/write'
import { jev as jevCall, type JevFn } from '@/engine/agent/llm'
import { judgmentChecks } from '@/engine/agent/checks'
import type { Slide } from '@/engine/types'
import { deckOf } from '../state'
import { runChecks, type TurnDeps } from '../turn'

export async function saveEdit(id: string, draft: Slide, deps: TurnDeps & { jev?: JevFn }): Promise<string | null> {
  const { measurer, dispatch, getState } = deps, s = getState(), i = s.items.findIndex((it) => it.id === id)
  if (i < 0) return 'This slide is no longer in the deck.'
  let w: Awaited<ReturnType<typeof checkWrite>>
  try {
    w = await checkWrite(draft, { style: s.style, jev: deps.jev ?? deps.models?.jev ?? jevCall, brief: '', strict: false,
      measure: (slide) => ({ issues: measurer.measure(slide, deckOf(s), i), lines: measurer.lines, warnings: measurer.warnings }) })
  } catch (e) { return `The slide could not be saved: ${e instanceof Error ? e.message : String(e)}` }
  if (!w.applied) return w.issues[0] ?? 'The slide could not be saved.'
  const items = getState().items.map((it) => (it.id === id ? { ...it, slide: w.slide, status: w.issues.length ? 'draft' as const : 'ok' as const, errors: w.issues, warnings: w.warnings, checks: [] } : it))
  dispatch({ type: 'items', items, focusId: id })
  dispatch({ type: 'set', patch: { edited: [...new Set([...getState().edited, id])] } })
  dispatch({ type: 'edit', id: null })
  void runChecks(id, deps, deps.judge ?? judgmentChecks)
  return null
}
