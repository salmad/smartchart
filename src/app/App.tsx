import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { deckList, deckName, localDeckRepo, newDeckId, type Item, type Store } from './store'
import { recheckRules, sendTurn, type TurnRecord } from './turn'
import { useAppState } from './useAppState'
import { go, takePendingPrompt, type Route } from './route'

const WELCOME = 'Describe the slide you need and I’ll make it. Then ask for changes in your own words, or press Present.'
const LANDING = 'Pick a ready-made slide, or describe your own. Paste numbers, a table or notes and say what the slide should argue.'
const CLEARED = 'Chat cleared. The deck is kept; the agent starts a new conversation.'
const STORAGE_FULL = "This browser's storage is full, so this deck is not being saved. Delete a deck you no longer need."

/** Holds the state, loads and saves decks, and picks the screen. */
export function App({ route }: { route: Route }) {
  const [s, app] = useAppState()
  const repo = useMemo(() => localDeckRepo(), [])
  const store = useRef<Store>({ active: null, decks: {} })
  const [, setSaved] = useState(0) // re-renders the deck list after a save
  const frame = useRef<HTMLDivElement>(null), measurerRef = useRef<Measurer | null>(null)
  const sendRef = useRef<((text: string) => void) | null>(null)
  const turns = useRef<TurnRecord[]>([]), warned = useRef(false), bootStarted = useRef(false)
  const [presenting, setPresenting] = useState(false), [booted, setBooted] = useState(false), [loaded, setLoaded] = useState(false)
  const deck = deckOf(s)

  const measurer = useCallback((): Measurer => {
    if (!frame.current) throw new Error('the measuring frame is not mounted')
    return (measurerRef.current ??= createMeasurer(frame.current))
  }, [])
  const say = useCallback((text: string, sub?: string) => app.dispatch({ type: 'message', message: { kind: 'bot', text, sub } }), [app])

  const newDeck = useCallback(() => { app.dispatch({ type: 'new' }); turns.current = []; say(LANDING) }, [app, say])
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

  // Boot: the saved decks first (nothing is saved before they are in memory, so an early pick cannot overwrite
  // them), then fonts (slides measure text), whether the models are reachable, then the last deck.
  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true
    void (async () => {
      store.current = await repo.load()
      setLoaded(true)
      await document.fonts.ready
      let live = false
      try { live = !!((await (await fetch(config.healthUrl, { signal: AbortSignal.timeout(3000) })).json()) as { live?: unknown }).live } catch { /* offline */ }
      app.dispatch({ type: 'set', patch: { live } })
      setBooted(true)
      // A tile picked while this loaded already started a deck: it wins over reopening the last one.
      if (app.getState().deckId) return
      const wanted = route.name === 'deck' ? store.current.decks[route.id] : undefined
      if (wanted) { openDeck(wanted.id); return }
      newDeck()
      // A prompt typed on the site builds the first slide, in the style picked there.
      const pending = parsePending(takePendingPrompt())
      if (pending && live) { app.dispatch({ type: 'set', patch: { style: pending.style } }); void sendRef.current?.(pending.text) }
    })()
  }, [app, repo, openDeck, newDeck, route])

  // Save 250 ms after the last change, never mid-turn; one chat warning if the browser refuses.
  useEffect(() => {
    if (!loaded || s.busy || !s.deckId) return
    const t = setTimeout(() => {
      const saved = toSaved(app.getState())
      if (!saved) return
      store.current.decks[saved.id] = saved
      store.current.active = saved.id
      if (location.pathname !== `/d/${saved.id}`) go(`/d/${saved.id}`, { replace: true })
      void repo.save(store.current).then((ok) => {
        if (!ok && !warned.current) { warned.current = true; app.dispatch({ type: 'message', message: { kind: 'error', text: STORAGE_FULL } }) }
        setSaved((n) => n + 1)
      })
    }, config.saveDelayMs)
    return () => clearTimeout(t)
  }, [s, loaded, app, repo])

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

  // Saved decks, newest first, with the open deck's live slides; a new deck shows (as "Untitled deck") before its first save.
  const decks = deckList(store.current).map((d) => ({ id: d.id, items: d.id === s.deckId ? s.items : d.items }))
  if (s.deckId && !store.current.decks[s.deckId]) decks.unshift({ id: s.deckId, items: s.items })
  const bar = {
    canDelete: !!s.deckId && !!store.current.decks[s.deckId],
    decks: decks.map((d) => ({ id: d.id, label: `${deckName(d)} · ${d.items.length} slide${d.items.length === 1 ? '' : 's'}` })),
    onStyle: setStyle,
    onTheme: (theme: Theme) => app.dispatch({ type: 'set', patch: { theme } }),
    onAccent: (accent: string | null) => app.dispatch({ type: 'set', patch: { accent } }),
    onOpenDeck: (id: string) => { if (!app.getState().busy) openDeck(id) },
    onDelete: deleteDeck,
    onNew: () => { if (!app.getState().busy) newDeck() },
    onPresent: present,
    onAdd: () => { if (!app.getState().busy && app.getState().items.length) app.dispatch({ type: 'set', patch: { view: 'add' } }) },
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
        : <Editor state={s} booted={booted} deck={deck} chips={chipsFor(s)} bar={bar} onSend={onSend} onClear={onClear} onSelect={onSelect} stage={stage} />}
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
