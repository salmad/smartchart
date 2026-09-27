/* Pills: starter prompts on an empty deck; after that, next steps tailored to the current slide and the
   conversation (suggest), fetched in the background and kept per slide version. */
import { suggest, type Pill } from '@/engine/agent/suggest'
import type { Style } from '@/engine/types'
import type { AppStore } from './useAppState'
import type { AppState } from './state'

const STARTERS: Record<Style, string[]> = {
  consulting: [
    'Our SaaS revenue grew from £2.1m in 2022 to £9.4m in 2025 while monthly churn fell from 8% to 3%',
    'Compare our three pricing plans: Starter £29, Growth £99, Enterprise custom, by seats, support and SLA',
    'Plan for the next 18 months: pilot with 5 hospitals, certify, then roll out nationally',
  ],
  pitch: [
    'The problem: independent cafés lose 11 hours a week to supplier ordering',
    'Our traction: 40 paying cafés, £38k MRR, growing 22% a month',
    'Why we win: suppliers compete for orders instead of cafés chasing suppliers',
  ],
}

/** What the composer shows: starter prompts on an empty deck, then the current slide's pills once they are ready.
    Nothing while offline, busy or still fetching: pills appear when ready and never show a loading state. */
export function chipsFor(s: AppState): Pill[] | null {
  if (!s.live || s.busy) return null
  const it = s.items[s.current]
  if (!it) return STARTERS[s.style].map((p) => ({ label: p, prompt: p }))
  const got = s.pills[it.id]
  return got && !got.pending && got.key === JSON.stringify(it.slide) && got.pills.length ? got.pills : null
}

// One suggestion call at a time; a chat turn aborts it, so the two never compete for the model.
let inflight: { id: string; ctl: AbortController } | null = null

/** Fetches suggestions for the current slide when its version has none yet, only while no turn runs. */
export function refreshPills({ getState, dispatch }: AppStore): void {
  const s = getState(), it = s.items[s.current]
  if (s.busy && inflight) {
    // A turn started: drop the pending fetch so it is asked again, for the new version, once the turn ends.
    const { id } = inflight
    inflight.ctl.abort(); inflight = null
    const { [id]: _dropped, ...rest } = s.pills
    dispatch({ type: 'set', patch: { pills: rest } })
    return
  }
  if (!s.live || s.busy || !it) return
  const key = JSON.stringify(it.slide), got = s.pills[it.id]
  if (got && got.key === key) return
  inflight?.ctl.abort()
  const ctl = new AbortController(), entry = { key, pending: true, pills: [] }
  inflight = { id: it.id, ctl }
  dispatch({ type: 'set', patch: { pills: { ...s.pills, [it.id]: entry } } })
  void suggest({ slide: it.slide, style: s.style, history: s.history, checks: it.checks || [] }, ctl.signal).then(({ pills }) => {
    if (inflight?.ctl === ctl) inflight = null
    const now = getState().pills
    if (ctl.signal.aborted || now[it.id] !== entry) return // a turn started, or the slide changed, while we waited
    dispatch({ type: 'set', patch: { pills: { ...now, [it.id]: { key, pending: false, pills } } } })
  })
}
