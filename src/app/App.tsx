import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { upgrade } from '@/engine/slides/schema'
import type { Slide, Style, Theme } from '@/engine/types'
import { Editor } from './components/Editor'
import { Present } from './components/Present'
import { TooltipProvider } from './components/ui/tooltip'
import { config } from './config'
import { installDebug } from './debug'
import { createMeasurer, type Measurer } from './measure'
import { chipsFor, refreshPills } from './pills'
import { deckOf, toSaved } from './state'
import { deckList, deckName, localDeckRepo, type Item, type Store } from './store'
import { recheckRules, sendTurn, type TurnRecord } from './turn'
import { useAppState } from './useAppState'

const WELCOME = 'Describe a slide. The agent picks a template with Jev, writes the slide with GLM 5.3 Flash and fixes anything that does not fit. Then ask for changes, add slides, or press Present.'
const CLEARED = 'Chat cleared. The deck is kept; the agent starts a new conversation.'
const STORAGE_FULL = "This browser's storage is full, so this deck is not being saved. Delete a deck you no longer need."

/** Holds the state, loads and saves decks, and picks the screen. */
export function App() {
  const [s, app] = useAppState()
  const repo = useMemo(() => localDeckRepo(), [])
  const store = useRef<Store>({ active: null, decks: {} })
  const [, setSaved] = useState(0) // re-renders the deck list after a save
  const frame = useRef<HTMLDivElement>(null), measurerRef = useRef<Measurer | null>(null)
  const turns = useRef<TurnRecord[]>([]), warned = useRef(false), booted = useRef(false)
  const [presenting, setPresenting] = useState(false)
  const deck = deckOf(s)

  const measurer = useCallback((): Measurer => {
    if (!frame.current) throw new Error('the measuring frame is not mounted')
    return (measurerRef.current ??= createMeasurer(frame.current))
  }, [])
  const say = useCallback((text: string, sub?: string) => app.dispatch({ type: 'message', message: { kind: 'bot', text, sub } }), [app])

  const newDeck = useCallback(() => { app.dispatch({ type: 'new' }); turns.current = []; say(WELCOME) }, [app, say])
  const openDeck = useCallback((id: string) => {
    const d = store.current.decks[id]
    if (!d) return
    store.current.active = id; turns.current = []
    app.dispatch({ type: 'open', deck: d })
    // Rule checks re-run with the current code, on slides upgraded to the current schema.
    const opened = app.getState(), items = opened.items.map((it) => ({ ...it, slide: upgrade(it.slide) }))
    app.dispatch({ type: 'items', items: recheckRules({ ...opened, items }, measurer()) })
    if (!d.messages?.length && !d.thread) say(WELCOME)
  }, [app, measurer, say])

  // Boot: fonts (slides measure text), whether the models are reachable, then the last deck.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void (async () => {
      await document.fonts.ready
      let live = false
      try { live = !!((await (await fetch(config.healthUrl)).json()) as { live?: unknown }).live } catch { /* offline */ }
      app.dispatch({ type: 'set', patch: { live } })
      store.current = await repo.load()
      const last = store.current.decks[store.current.active ?? ''] ?? deckList(store.current)[0]
      if (last) openDeck(last.id)
      else newDeck()
    })()
  }, [app, repo, openDeck, newDeck])

  // Save 250 ms after the last change, never mid-turn; one chat warning if the browser refuses.
  useEffect(() => {
    if (s.busy || !s.deckId) return
    const t = setTimeout(() => {
      const saved = toSaved(app.getState())
      if (!saved) return
      store.current.decks[saved.id] = saved
      store.current.active = saved.id
      void repo.save(store.current).then((ok) => {
        if (!ok && !warned.current) { warned.current = true; app.dispatch({ type: 'message', message: { kind: 'error', text: STORAGE_FULL } }) }
        setSaved((n) => n + 1)
      })
    }, config.saveDelayMs)
    return () => clearTimeout(t)
  }, [s, app, repo])

  const { live, busy, current, items } = s
  useEffect(() => refreshPills(app), [live, busy, current, items, app])

  const send = useCallback(async (text: string) => {
    const r = await sendTurn(text, { measurer: measurer(), dispatch: app.dispatch, getState: app.getState })
    turns.current.push(r)
    return r
  }, [app, measurer])
  const setStyle = useCallback((style: Style) => app.dispatch({ type: 'set', patch: { style } }), [app])
  const load = useCallback((slides: Slide[], style: Style) => {
    turns.current = []
    const items: Item[] = slides.map((sl, i) => ({ id: `s_t${i}`, slide: upgrade(sl), status: 'ok', errors: [], warnings: [], checks: [], checksPending: false }))
    app.dispatch({ type: 'set', patch: { style, history: [], working: new Set(), items, current: 0, view: 'editor' } })
  }, [app])

  useEffect(() => installDebug({ live: s.live, items: s.items, current: s.current, turns: turns.current, send, setStyle, load }))

  const present = useCallback(() => { if (app.getState().items.length) setPresenting(true) }, [app])
  const deleteDeck = useCallback(() => {
    const cur = app.getState()
    if (cur.busy || !cur.deckId || !confirm(`Delete “${deckName({ items: cur.items })}”? This cannot be undone.`)) return
    delete store.current.decks[cur.deckId]
    store.current.active = null
    void repo.save(store.current)
    const next = deckList(store.current)[0]
    if (next) openDeck(next.id)
    else newDeck()
  }, [app, repo, openDeck, newDeck])

  // Saved decks, newest first, with the open deck's live slides; a new deck shows before its first save.
  const decks = deckList(store.current).map((d) => ({ id: d.id, items: d.id === s.deckId ? s.items : d.items }))
  if (s.deckId && !store.current.decks[s.deckId] && s.items.length) decks.unshift({ id: s.deckId, items: s.items })
  const bar = {
    decks: decks.map((d) => ({ id: d.id, label: `${deckName(d)} · ${d.items.length} slide${d.items.length === 1 ? '' : 's'}` })),
    onStyle: setStyle,
    onTheme: (theme: Theme) => app.dispatch({ type: 'set', patch: { theme } }),
    onAccent: (accent: string | null) => app.dispatch({ type: 'set', patch: { accent } }),
    onOpenDeck: (id: string) => { if (!app.getState().busy) openDeck(id) },
    onDelete: deleteDeck,
    onNew: () => { if (!app.getState().busy) newDeck() },
    onPresent: present,
  }

  const onClear = useCallback(() => {
    if (app.getState().busy) return
    app.dispatch({ type: 'set', patch: { history: [], working: new Set(), messages: [{ kind: 'bot', text: '', sub: CLEARED }], legacyThread: null } })
  }, [app])
  const onSelect = useCallback((index: number) => app.dispatch({ type: 'select', index }), [app])
  const onSend = useCallback((text: string) => { void send(text) }, [send])

  return (
    <TooltipProvider delayDuration={400}>
      {presenting
        ? <Present deck={deck} start={s.current} onExit={(i) => { app.dispatch({ type: 'select', index: i }); setPresenting(false) }} />
        : <Editor state={s} deck={deck} chips={chipsFor(s)} bar={bar} onSend={onSend} onClear={onClear} onSelect={onSelect} />}
      {/* Offscreen measuring frame: a real 1920×1080 slide, never shown. */}
      <div ref={frame} aria-hidden className="fixed left-[-10000px] top-0 h-[1080px] w-[1920px] overflow-hidden" />
    </TooltipProvider>
  )
}

