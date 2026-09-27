/* One agent turn and the checks after it, as plain functions: the UI only dispatches and renders.
   The agent works on its own copy of the deck; every applied write shows at once. Judgment checks run
   after the reply, on the slides written this turn (spec 9.4). */
import { runTurn, type AgentDeck, type MeasureFn, type TraceStep } from '@/engine/agent/agent'
import { judgmentChecks, ruleChecks } from '@/engine/agent/checks'
import type { Slide } from '@/engine/types'
import type { createMeasurer } from './measure'
import { deckOf, type Action, type AppState } from './state'
import type { Item, Message } from './store'

export interface TurnDeps {
  measurer: ReturnType<typeof createMeasurer>; dispatch: (a: Action) => void; getState: () => AppState
  models?: Parameters<typeof runTurn>[0]['models']; judge?: typeof judgmentChecks
}
export interface TurnRecord { request: string; reply?: string; error?: string; trace: TraceStep[]; modelCalls?: number; toolCalls?: number; ms: number; pre?: { intent: string; p: number }; written?: string[]; items: Item[] }

/** The bot message's sub line while the turn runs. */
export const WORKING = 'Working…'
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export async function sendTurn(input: string, deps: TurnDeps): Promise<TurnRecord> {
  const { measurer, dispatch, getState, models, judge = judgmentChecks } = deps
  const text = input.trim(), start = getState(), t0 = performance.now(), trace: TraceStep[] = []
  // The agent mutates its history and working set; it gets copies, and the state takes them back at the end.
  const history = structuredClone(start.history), working = new Set(start.working)

  dispatch({ type: 'set', patch: { busy: true } })
  dispatch({ type: 'message', message: { kind: 'user', text } })
  dispatch({ type: 'message', message: { kind: 'bot', text: '', sub: WORKING, trace: [] } })
  const botAt = getState().messages.length - 1
  const setBot = (m: Message) => { const messages = getState().messages.slice(); messages[botAt] = m; dispatch({ type: 'set', patch: { messages } }) }
  const log = (step: TraceStep) => { trace.push(step); setBot({ kind: 'bot', text: '', sub: WORKING, trace: trace.slice() }) }

  const adeck: AgentDeck = { style: start.style, theme: start.theme, slides: start.items.map((it) => ({ id: it.id, slide: it.slide, issues: it.errors || [], warnings: it.warnings || [], checks: it.checks || [] })) }
  const cur = start.items[start.current]
  const sync = (d: AgentDeck, focusId?: string) => {
    const items: Item[] = d.slides.filter((s): s is typeof s & { slide: Slide } => !!s.slide)
      .map((s) => ({ id: s.id, slide: s.slide, status: s.issues.length ? 'draft' : 'ok', errors: s.issues, warnings: s.warnings, checks: s.checks || [], checksPending: false }))
    dispatch({ type: 'items', items, focusId })
  }
  // The agent's deck may hold a reserved slide with no JSON yet: measure within the slides that exist.
  const measure: MeasureFn = Object.assign((slide: Slide, index: number) => {
    const list = adeck.slides.map((s, i) => (i === index ? slide : s.slide))
    const d = { ...deckOf(getState()), slides: list.filter((s): s is Slide => !!s) }, at = list.slice(0, index).filter(Boolean).length
    const issues = measurer.measure(slide, d, at)
    measure.lines = measurer.lines; measure.warnings = measurer.warnings
    return issues
  }, { lines: 1, warnings: [] as string[] })

  try {
    const r = await runTurn({ text, deck: adeck, history, working, selection: cur ? { slideId: cur.id } : null, measure, log, onChange: sync, models })
    sync(adeck, r.written.at(-1) || getState().items[getState().current]?.id)
    const secs = ((performance.now() - t0) / 1000).toFixed(1)
    setBot({ kind: 'bot', text: r.reply, sub: `${plural(r.modelCalls, 'model call')} · ${plural(r.toolCalls, 'tool call')} · ${secs}s`, trace })
    dispatch({ type: 'items', items: recheckRules(getState(), measurer) })
    dispatch({ type: 'set', patch: { busy: false, history, working } })
    await Promise.all(r.written.map((id) => runChecks(id, deps, judge)))
    return { request: text, reply: r.reply, trace, modelCalls: r.modelCalls, toolCalls: r.toolCalls, ms: Math.round(performance.now() - t0),
      pre: { intent: r.pre.intent, p: r.pre.p }, written: r.written, items: structuredClone(getState().items) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setBot({ kind: 'error', text: `Something went wrong: ${msg}`, trace })
    dispatch({ type: 'set', patch: { busy: false, history, working } })
    return { request: text, error: msg, trace, ms: Math.round(performance.now() - t0), items: structuredClone(getState().items) }
  }
}

/** Rule checks for every slide with the current code; judgment checks already made are kept. */
export function recheckRules(s: AppState, measurer: TurnDeps['measurer']): Item[] {
  const d = deckOf(s)
  return s.items.map((it, i) => {
    measurer.measure(it.slide, d, i)
    return { ...it, checks: [...ruleChecks(it.slide, s.style, measurer.lines), ...(it.checks || []).filter((c) => c.id.startsWith('J'))], checksPending: false }
  })
}

/** Rule checks at once, then judgment checks (one Jev call) for one slide. */
async function runChecks(id: string, { measurer, dispatch, getState }: TurnDeps, judge: typeof judgmentChecks) {
  const update = (patch: Partial<Item>) => dispatch({ type: 'items', items: getState().items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })
  const s = getState(), i = s.items.findIndex((it) => it.id === id), item = s.items[i]
  if (!item) return
  measurer.measure(item.slide, deckOf(s), i)
  const rules = ruleChecks(item.slide, s.style, measurer.lines)
  update({ checks: rules, checksPending: true })
  try { update({ checks: [...rules, ...(await judge(item.slide, s.style)).checks], checksPending: false }) }
  catch (e) { update({ checks: [...rules, { id: 'J', ok: false, msg: `judgment checks failed: ${e instanceof Error ? e.message : String(e)}` }], checksPending: false }) }
}
