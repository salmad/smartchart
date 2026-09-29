import { useCallback, useEffect, useRef, useState } from 'react'
import { upgrade } from '@/engine/slides/schema'
import type { Slide, Style, Theme } from '@/engine/types'
import { starterSlide, type Starter } from '@/engine/starters'
import { Editor } from './components/Editor'
import { AddSlide } from './components/AddSlide'
import { Present } from './components/Present'
import { TooltipProvider } from './components/ui/tooltip'
import { config } from './config'
import { installDebug } from './debug'
import { createMeasurer, type Measurer } from './measure'
import { chipsFor, refreshPills } from './pills'
import { deckOf, editKey, toSaved } from './state'
import { deckName, newDeckId, type DeckRepo, type Item, type SavedDeck } from './store'
import { recheckRules, sendTurn, type TurnRecord } from './turn'
import { useAppState } from './useAppState'
import { go, takePendingPrompt, type Route } from './route'
import type { Account } from './auth'
import { findDeck } from './remote'
import { Decks } from './components/Decks'

const WELCOME = 'Describe the slide you need and I’ll make it. Then ask for changes in your own words, or press Present.'
const CLEARED = 'Chat cleared. The deck is kept; the agent starts a new conversation.'
const notSaved = (why: string) => `Couldn’t save. ${why} Retrying; a copy is kept in this browser until it saves.`
const MISSING = 'That deck isn’t in your account.'
const DECKS_OPEN = 'smartchart.decksOpen'

interface Props {
  route: Route
  account: Account
  repo: DeckRepo
  /** Where a copy waits while saves fail; null when the decks already live in this browser (the dev account). */
  backup: DeckRepo | null
}

/** The editor for one deck: loads it and saves it. */
export function App({ route, account, repo, backup }: Props) {
  const [s, app] = useAppState()
  const frame = useRef<HTMLDivElement>(null), measurerRef = useRef<Measurer | null>(null)
  const sendRef = useRef<((text: string) => void) | null>(null)
  const turns = useRef<TurnRecord[]>([]), warned = useRef(false), bootStarted = useRef(false)
  const retry = useRef({ timer: 0, wait: 0 })
  const [presenting, setPresenting] = useState(false), [booted, setBooted] = useState(false), [loaded, setLoaded] = useState(false)
  // Your decks down the left, open unless hidden; the choice is remembered in this browser.
  const [decksOpen, setDecksOpen] = useState(() => { try { return localStorage.getItem(DECKS_OPEN) !== '0' } catch { return true } })
  const toggleDecks = useCallback(() => setDecksOpen((o) => { try { localStorage.setItem(DECKS_OPEN, o ? '0' : '1') } catch { /* storage blocked */ } return !o }), [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggleDecks() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [toggleDecks])
  const deck = deckOf(s)

  const measurer = useCallback((): Measurer => {
    if (!frame.current) throw new Error('the measuring frame is not mounted')
    return (measurerRef.current ??= createMeasurer(frame.current))
  }, [])
  const say = useCallback((text: string, sub?: string) => app.dispatch({ type: 'message', message: { kind: 'bot', text, sub } }), [app])

  // The deck as last saved (or opened): a save happens only when this changes, so opening a deck or selecting a
  // slide does not stamp it as edited and move it up the list.
  const savedKey = useRef<string | null>(null)
  const unsaved = (d: SavedDeck) => editKey(d) !== savedKey.current
  // A new deck asks its question in the chat, so the chat starts empty.
  const newDeck = useCallback(() => { app.dispatch({ type: 'new' }); turns.current = []; savedKey.current = null }, [app])
  const openDeck = useCallback((d: SavedDeck) => {
    turns.current = []
    app.dispatch({ type: 'open', deck: d })
    // Rule checks re-run with the current code, on slides upgraded to the current schema.
    const opened = app.getState(), items = opened.items.map((it) => ({ ...it, slide: upgrade(it.slide) }))
    app.dispatch({ type: 'items', items: recheckRules({ ...opened, items }, measurer()) })
    if (!d.messages?.length && !d.thread) say(WELCOME)
    const now = toSaved(app.getState())
    savedKey.current = now && editKey(now)
  }, [app, measurer, say])

  // Boot: the deck in the URL (nothing is saved before it is loaded, so an early pick cannot overwrite it),
  // then fonts (slides measure text) and whether the models are reachable.
  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true
    void (async () => {
      // Signed in, / is the editor on the deck worked on last; only that deck is read in full.
      const recent = route.name === 'home' ? (await repo.list().catch(() => []))[0] : undefined
      const id = route.name === 'deck' ? route.id : recent?.id
      const wanted = id ? await findDeck(id, repo, backup) : null
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
      // A prompt typed on the site sets the style picked there, and builds the first slide when the models are up.
      const pending = parsePending(takePendingPrompt())
      if (pending) app.dispatch({ type: 'set', patch: { style: pending.style } })
      if (pending && live) void sendRef.current?.(pending.text)
    })()
  }, [app, repo, backup, openDeck, newDeck, route, say])

  // A failed save keeps a copy in this browser and tries again, waiting longer each time; the copy goes once a
  // save succeeds. One chat warning per run of failures, saying why.
  const persist = useCallback(async (saved: SavedDeck) => {
    const r = retry.current
    clearTimeout(r.timer)
    const why = await repo.save(saved)
    if (!why) {
      savedKey.current = editKey(saved)
      if (r.wait) void backup?.remove(saved.id)
      r.wait = 0; warned.current = false
      return
    }
    if (!warned.current) { warned.current = true; app.dispatch({ type: 'message', message: { kind: 'error', text: backup ? notSaved(why) : `Couldn’t save. ${why}` } }) }
    if (!backup) return
    void backup.save(saved)
    r.wait = Math.min(config.saveRetryMaxMs, r.wait ? r.wait * 2 : config.saveRetryMs)
    r.timer = window.setTimeout(() => { const now = toSaved(app.getState()); if (now) void persist(now) }, r.wait)
  }, [app, repo, backup])
  useEffect(() => () => clearTimeout(retry.current.timer), [])

  // Save 250 ms after the last change, never mid-turn.
  useEffect(() => {
    if (!loaded || s.busy || !s.deckId) return
    const t = setTimeout(() => {
      const saved = toSaved(app.getState())
      if (!saved) return
      if (location.pathname !== `/d/${saved.id}`) go(`/d/${saved.id}`, { replace: true })
      if (unsaved(saved)) void persist(saved)
    }, config.saveDelayMs)
    return () => clearTimeout(t)
  }, [s, loaded, app, persist])

  // Another deck picked in the sidebar (or Back/Forward): open it, or start a new one at /new. Boot handles the
  // route the page opened on; a pick made while it runs is acted on as soon as boot is done, never dropped.
  // A new deck's own URL becoming /d/:id after its first save is the deck already open, and is left alone.
  const where = route.name === 'deck' ? route.id : route.name
  const shown = useRef(where)
  useEffect(() => {
    if (!booted || shown.current === where) return
    shown.current = where
    if (route.name === 'new') { if (app.getState().items.length || app.getState().history.length) newDeck(); return }
    if (route.name !== 'deck' || route.id === app.getState().deckId) return
    void findDeck(route.id, repo, backup).then((d) => { if (d) openDeck(d); else { newDeck(); say(MISSING) } })
  }, [route, where, booted, app, repo, backup, openDeck, newDeck, say])
  // Leaving a deck saves it now rather than after the usual pause.
  const leaveTo = useCallback((path: string) => {
    if (app.getState().busy) return
    const saved = toSaved(app.getState())
    if (saved && unsaved(saved)) void persist(saved)
    go(path)
  }, [app, persist])
  const onDeckDeleted = useCallback((id: string) => { if (id === app.getState().deckId) { newDeck(); go('/new') } }, [app, newDeck])

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
  const bar = {
    onStyle: setStyle,
    onTheme: (theme: Theme) => app.dispatch({ type: 'set', patch: { theme } }),
    onAccent: (accent: string | null) => app.dispatch({ type: 'set', patch: { accent } }),
    onPresent: present,
    onAdd: () => { if (!app.getState().busy && app.getState().items.length) app.dispatch({ type: 'set', patch: { view: 'add' } }) },
    decksOpen, onToggleDecks: toggleDecks,
    onSite: () => leaveTo('/home'),
  }

  const onClear = useCallback(() => {
    if (app.getState().busy) return
    app.dispatch({ type: 'set', patch: { history: [], working: new Set(), messages: [{ kind: 'bot', text: '', sub: CLEARED }], legacyThread: null } })
  }, [app])
  const onSelect = useCallback((index: number) => app.dispatch({ type: 'select', index }), [app])
  const onMove = useCallback((id: string, to: number) => app.dispatch({ type: 'moveSlide', id, to }), [app])
  const onRemove = useCallback((id: string) => app.dispatch({ type: 'removeSlide', id }), [app])
  const onRestore = useCallback(() => app.dispatch({ type: 'restoreSlide' }), [app])
  // A prompt from the landing (or Add slide) builds the slide in the editor.
  const onSend = useCallback((text: string) => {
    if (app.getState().view !== 'editor') app.dispatch({ type: 'set', patch: { view: 'editor' } })
    void send(text)
  }, [app, send])
  sendRef.current = onSend
  // A double click or a click while busy is ignored by the reducer: one deck, one slide (Review Focus 3).
  // Inserted after the current slide and selected; numbering follows from position (Review Focus 4).
  // A starter's checks run as it lands, so its check line is never empty.
  const recheck = useCallback(() => app.dispatch({ type: 'items', items: recheckRules(app.getState(), measurer()) }), [app, measurer])
  const onUse = useCallback((st: Starter) => { app.dispatch({ type: 'insertStarter', slide: starterSlide(st, app.getState().style), id: `s_${newDeckId()}` }); recheck() }, [app, recheck])
  const onCancelAdd = useCallback(() => app.dispatch({ type: 'set', patch: { view: 'editor' } }), [app])
  const onPick = useCallback((st: Starter) => { app.dispatch({ type: 'pickStarter', slide: starterSlide(st, app.getState().style), id: `s_${newDeckId()}` }); recheck() }, [app, recheck])
  const stage = s.view === 'landing'
    ? <AddSlide deck={deck} current={0} onUse={onPick} />
    : s.view === 'add'
      ? <AddSlide deck={deck} current={s.current} onUse={onUse} onCancel={onCancelAdd} />
      : undefined

  return (
    <TooltipProvider delayDuration={400}>
      {presenting
        ? <Present deck={deck} start={s.current} onExit={(i) => { app.dispatch({ type: 'select', index: i }); setPresenting(false) }} />
        : <Editor state={s} booted={booted} deck={deck} chips={chipsFor(s)} bar={bar} onSend={onSend} onClear={onClear} onSelect={onSelect} onMove={onMove} onRemove={onRemove} onRestore={onRestore} stage={stage}
            decks={decksOpen && <Decks repo={repo} account={account} current={{ id: s.deckId, name: deckName({ items: s.items }), hasSlides: s.items.length > 0 }} busy={s.busy}
              onOpen={(id) => leaveTo(`/d/${id}`)} onNew={() => leaveTo('/new')} onDeleted={onDeckDeleted} />} />}
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
