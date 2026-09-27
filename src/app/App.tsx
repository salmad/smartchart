import { useCallback, useEffect, useRef, useState } from 'react'
import { upgrade } from '@/engine/slides/schema'
import type { Slide, Style, Theme } from '@/engine/types'
import { starterSlide, type Starter } from '@/engine/starters'
import { Editor } from './components/Editor'
import { Gallery } from './components/Gallery'
import { AddSlide } from './components/AddSlide'
import { Present } from './components/Present'
import { TooltipProvider } from './components/ui/tooltip'
import { config } from './config'
import { installDebug } from './debug'
import { createMeasurer, type Measurer } from './measure'
import { chipsFor, refreshPills } from './pills'
import { deckOf, toSaved } from './state'
import { localDeckRepo, newDeckId, type DeckRepo, type Item, type SavedDeck } from './store'
import { recheckRules, sendTurn, type TurnRecord } from './turn'
import { useAppState } from './useAppState'
import { go, takePendingPrompt, type Route } from './route'
import type { Account } from './auth'
import { SignIn } from './components/SignIn'
import { findDeck } from './remote'

const WELCOME = 'Describe the slide you need and I’ll make it. Then ask for changes in your own words, or press Present.'
const LANDING = 'Pick a ready-made slide, or describe your own. Paste numbers, a table or notes and say what the slide should argue.'
const CLEARED = 'Chat cleared. The deck is kept; the agent starts a new conversation.'
const STORAGE_FULL = "This browser's storage is full, so this deck is not being saved. Delete a deck you no longer need."
const NOT_SAVED = 'Couldn’t save. Retrying. A copy is kept in this browser until it saves.'
const MISSING = 'That deck isn’t in your account.'

interface Props {
  route: Route
  /** Null for a visitor: their deck lives in this browser and one turn is free before they sign in. */
  account: Account | null
  repo: DeckRepo
}

/** The editor for one deck: loads it, saves it, and gates a visitor after their first slide. */
export function App({ route, account, repo }: Props) {
  const [s, app] = useAppState()
  const [gate, setGate] = useState(false), [gateOpen, setGateOpen] = useState(false)
  const frame = useRef<HTMLDivElement>(null), measurerRef = useRef<Measurer | null>(null)
  const sendRef = useRef<((text: string) => void) | null>(null)
  const turns = useRef<TurnRecord[]>([]), warned = useRef(false), bootStarted = useRef(false)
  const retry = useRef({ timer: 0, wait: 0 })
  const [presenting, setPresenting] = useState(false), [booted, setBooted] = useState(false), [loaded, setLoaded] = useState(false)
  const deck = deckOf(s)

  const measurer = useCallback((): Measurer => {
    if (!frame.current) throw new Error('the measuring frame is not mounted')
    return (measurerRef.current ??= createMeasurer(frame.current))
  }, [])
  const say = useCallback((text: string, sub?: string) => app.dispatch({ type: 'message', message: { kind: 'bot', text, sub } }), [app])

  const newDeck = useCallback(() => { app.dispatch({ type: 'new' }); turns.current = []; say(LANDING) }, [app, say])
  const openDeck = useCallback((d: SavedDeck) => {
    turns.current = []
    app.dispatch({ type: 'open', deck: d })
    // Rule checks re-run with the current code, on slides upgraded to the current schema.
    const opened = app.getState(), items = opened.items.map((it) => ({ ...it, slide: upgrade(it.slide) }))
    app.dispatch({ type: 'items', items: recheckRules({ ...opened, items }, measurer()) })
    if (!d.messages?.length && !d.thread) say(WELCOME)
  }, [app, measurer, say])

  // Boot: the deck in the URL (nothing is saved before it is loaded, so an early pick cannot overwrite it),
  // then fonts (slides measure text) and whether the models are reachable.
  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true
    void (async () => {
      const wanted = route.name === 'deck' ? await findDeck(route.id, repo, account) : null
      setLoaded(true)
      await document.fonts.ready
      let live = false
      try { live = !!((await (await fetch(config.healthUrl, { signal: AbortSignal.timeout(3000) })).json()) as { live?: unknown }).live } catch { /* offline */ }
      app.dispatch({ type: 'set', patch: { live } })
      setBooted(true)
      // A tile picked while this loaded already started a deck: it wins over reopening the last one.
      if (app.getState().deckId) return
      if (wanted) { openDeck(wanted); return }
      newDeck()
      if (route.name === 'deck') say(MISSING)
      // A prompt typed on the site builds the first slide, in the style picked there.
      const pending = parsePending(takePendingPrompt())
      if (pending && live) { app.dispatch({ type: 'set', patch: { style: pending.style } }); void sendRef.current?.(pending.text) }
    })()
  }, [app, repo, openDeck, newDeck, route, account, say])

  // Signed in, a failed save keeps a copy in this browser and tries again, waiting longer each time;
  // the copy goes once a save succeeds. One chat warning per run of failures.
  const persist = useCallback(async (saved: SavedDeck) => {
    const r = retry.current
    clearTimeout(r.timer)
    if (await repo.save(saved)) {
      if (r.wait) void localDeckRepo().remove(saved.id)
      r.wait = 0; warned.current = false
      return
    }
    const warn = (text: string) => { if (!warned.current) { warned.current = true; app.dispatch({ type: 'message', message: { kind: 'error', text } }) } }
    if (!account) { warn(STORAGE_FULL); return }
    void localDeckRepo().save(saved)
    warn(NOT_SAVED)
    r.wait = Math.min(config.saveRetryMaxMs, r.wait ? r.wait * 2 : config.saveRetryMs)
    r.timer = window.setTimeout(() => { const now = toSaved(app.getState()); if (now) void persist(now) }, r.wait)
  }, [app, repo, account])
  useEffect(() => () => clearTimeout(retry.current.timer), [])

  // Save 250 ms after the last change, never mid-turn.
  useEffect(() => {
    if (!loaded || s.busy || !s.deckId) return
    const t = setTimeout(() => {
      const saved = toSaved(app.getState())
      if (!saved) return
      if (location.pathname !== `/d/${saved.id}`) go(`/d/${saved.id}`, { replace: true })
      void persist(saved)
    }, config.saveDelayMs)
    return () => clearTimeout(t)
  }, [s, loaded, app, persist])

  const { live, busy, current, items } = s
  useEffect(() => refreshPills(app), [live, busy, current, items, app])

  const send = useCallback(async (text: string) => {
    const r = await sendTurn(text, { measurer: measurer(), dispatch: app.dispatch, getState: app.getState })
    turns.current.push(r)
    // A visitor's first slide is free; keeping it and going on needs an account.
    if (!account) { setGate(true); setGateOpen(true) }
    return r
  }, [app, measurer, account])
  const setStyle = useCallback((style: Style) => app.dispatch({ type: 'set', patch: { style } }), [app])
  const load = useCallback((slides: Slide[], style: Style) => {
    turns.current = []
    const items: Item[] = slides.map((sl, i) => ({ id: `s_t${i}`, slide: upgrade(sl), status: 'ok', errors: [], warnings: [], checks: [], checksPending: false }))
    app.dispatch({ type: 'set', patch: { style, history: [], working: new Set(), items, current: 0, view: 'editor' } })
  }, [app])

  useEffect(() => installDebug({ live: s.live, items: s.items, current: s.current, turns: turns.current, send, setStyle, load }))

  const present = useCallback(() => { if (app.getState().items.length) setPresenting(true) }, [app])
  const bar = {
    onStyle: setStyle,
    onTheme: (theme: Theme) => app.dispatch({ type: 'set', patch: { theme } }),
    onAccent: (accent: string | null) => app.dispatch({ type: 'set', patch: { accent } }),
    onPresent: present,
    onAdd: () => { if (!app.getState().busy && app.getState().items.length) app.dispatch({ type: 'set', patch: { view: 'add' } }) },
    onSignIn: account ? undefined : () => setGateOpen(true),
  }

  const onClear = useCallback(() => {
    if (app.getState().busy) return
    app.dispatch({ type: 'set', patch: { history: [], working: new Set(), messages: [{ kind: 'bot', text: '', sub: CLEARED }], legacyThread: null } })
  }, [app])
  const onSelect = useCallback((index: number) => app.dispatch({ type: 'select', index }), [app])
  // A prompt from the landing (or Add slide) builds the slide in the editor.
  const onSend = useCallback((text: string) => {
    if (app.getState().view !== 'editor') app.dispatch({ type: 'set', patch: { view: 'editor' } })
    void send(text)
  }, [app, send])
  sendRef.current = onSend
  // A double click or a click while busy is ignored by the reducer: one deck, one slide (Review Focus 3).
  // Inserted after the current slide and selected; numbering follows from position (Review Focus 4).
  const onUse = useCallback((st: Starter) => app.dispatch({ type: 'insertStarter', slide: starterSlide(st, app.getState().style), id: `s_${newDeckId()}` }), [app])
  const onCancelAdd = useCallback(() => app.dispatch({ type: 'set', patch: { view: 'editor' } }), [app])
  const onPick = useCallback((st: Starter) => app.dispatch({ type: 'pickStarter', slide: starterSlide(st, app.getState().style), id: `s_${newDeckId()}` }), [app])
  const stage = s.view === 'landing'
    ? <Gallery deckStyle={s.style} theme={s.theme} accent={s.accent} onStyle={setStyle} onPick={onPick} />
    : s.view === 'add'
      ? <AddSlide deck={deck} current={s.current} onUse={onUse} onCancel={onCancelAdd} />
      : undefined

  return (
    <TooltipProvider delayDuration={400}>
      {presenting
        ? <Present deck={deck} start={s.current} onExit={(i) => { app.dispatch({ type: 'select', index: i }); setPresenting(false) }} />
        : <Editor state={s} booted={booted} deck={deck} chips={chipsFor(s)} bar={bar} onSend={onSend} onClear={onClear} onSelect={onSelect} stage={stage}
            locked={gate ? { text: 'Sign in to keep this deck and keep going.', action: 'Keep this deck', onAction: () => setGateOpen(true) } : undefined} />}
      {!account && (
        <SignIn open={gateOpen} onOpenChange={setGateOpen} returnTo={s.deckId ? `/d/${s.deckId}` : '/new'}
          title={gate ? 'Keep this deck' : undefined}
          lede={gate ? 'Your slide is ready. Sign in to save it to your account and keep editing.' : undefined} />
      )}
      {/* Offscreen measuring frame: a real 1920×1080 slide, never shown. */}
      <div ref={frame} aria-hidden className="fixed left-[-10000px] top-0 h-[1080px] w-[1920px] overflow-hidden" />
    </TooltipProvider>
  )
}

function parsePending(raw: string | null): { text: string; style: Style } | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as { text?: unknown; style?: unknown }
    if (typeof p.text === 'string' && p.text.trim()) return { text: p.text, style: p.style === 'pitch' ? 'pitch' : 'consulting' }
  } catch { /* a bare string from an older page */ }
  return { text: raw, style: 'consulting' }
}
