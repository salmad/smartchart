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

/** What the composer shows: nothing while offline or busy, 'pending' while suggestions load. */
export function chipsFor(s: AppState): Pill[] | 'pending' | null {
  if (!s.live || s.busy) return null
  const it = s.items[s.current]
  if (!it) return STARTERS[s.style].map((p) => ({ label: p, prompt: p }))
  const got = s.pills[it.id]
  return !got || got.pending || got.key !== JSON.stringify(it.slide) ? 'pending' : got.pills
}

/** Fetches suggestions for the current slide when its version has none yet. */
export function refreshPills({ getState, dispatch }: AppStore): void {
  const s = getState(), it = s.items[s.current]
  if (!s.live || s.busy || !it) return
  const key = JSON.stringify(it.slide), got = s.pills[it.id]
  if (got && got.key === key) return
  const entry = { key, pending: true, pills: [] }
  dispatch({ type: 'set', patch: { pills: { ...s.pills, [it.id]: entry } } })
  void suggest({ slide: it.slide, style: s.style, history: s.history, checks: it.checks || [] }).then(({ pills }) => {
    const now = getState().pills
    if (now[it.id] !== entry) return // the slide changed while we waited
    dispatch({ type: 'set', patch: { pills: { ...now, [it.id]: { key, pending: false, pills } } } })
  })
}
