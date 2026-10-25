import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TourShow } from './tour'
import { upgrade } from '@/engine/slides/schema'
import type { Slide, Style, Theme } from '@/engine/types'
import { starterSlide, type Starter } from '@/engine/starters'
import { Editor } from './components/Editor'
import { AddSlide } from './components/AddSlide'
import { newLiveKey, openPresentation, usePublishDeck } from './presenter-channel'
import { pdfName } from './pdf-name'
import { TooltipProvider } from './components/ui/tooltip'
import { config } from './config'
import { installDebug } from './debug'
import { createMeasurer, type Measurer } from './measure'
import { chipsFor, refreshPills } from './pills'
import { deckOf, editKey, locked, toSaved } from './state'
import type { PageRef } from '@/engine/pages/tree'
import { saveEdit } from './edit/save'
import { deckName, newDeckId, type DeckRepo, type Item, type SaveMeta, type SavedDeck } from './store'
import { useVersions } from './useVersions'
import { authorOf, useComments } from './useComments'
import { useTour } from './useTour'
import { usePresence } from './usePresence'
import { Tour, TourNudge } from './components/Tour'
import { recheckRules, sendTurn, type TurnRecord } from './turn'
import { useAppState } from './useAppState'
import { go, parsePending, takePendingPrompt, type Route } from './route'
import type { Account } from './auth'
import { useLiveDeck } from './live'
import { usePersist } from './usePersist'
import type { Attached } from './files'
import { Sidebar } from './components/sidebar/Sidebar'
import { usePageCrumbs, usePageName } from './components/sidebar/usePageCrumbs'
import { DEV_ACCOUNT } from './dev-account'
import { bootDone } from './boot'
import { forgetCachedDeck, touchLastDeckInWorkspace } from './cached-decks'
import { keptDeck, openDeckFromServer, openKeptDeck } from './open-kept-deck'
import { findDeck } from './remote'
import { recheckInIdle } from './recheck'
import { useWorkspace } from './components/sidebar/useWorkspace'
import { useRowActions } from './components/sidebar/useRowActions'
import type { DocRepo } from './docs'
import type { PageRepo } from './pages'
import type { WorkspaceRepo } from './workspaces'
import { ROOMY, usePanel } from './panel'
import { lazyScreen, whenIdle } from './lazy-screen'

// Screens not needed for the first paint load when they are first shown; the doc screen also loads once the browser is idle
// after boot, so the first doc opened does not wait for it.
const docScreen = lazyScreen(() => import('./components/DocScreen').then((m) => m.DocScreen))
const ViewDeck = lazy(() => import('./components/ViewDeck').then((m) => ({ default: m.ViewDeck })))
const PrintDeck = lazy(() => import('./components/PrintDeck').then((m) => ({ default: m.PrintDeck })))

const WELCOME = 'Describe the slide you need and I’ll make it. Then ask for changes in your own words, or press Present.'
const CLEARED = 'Chat cleared. The deck is kept; the agent starts a new conversation.'
const MISSING = 'That deck isn’t in your account.'
const DECKS_OPEN = 'smartchart.decksOpen'
const CHAT_OPEN = 'smartchart.chatOpen'

interface Props {
  route: Route
  account: Account
  repo: DeckRepo
  /** Where a copy waits while saves fail; null when the decks already live in this browser (the dev account). */
  backup: DeckRepo | null
  workspaces: WorkspaceRepo
  docs: DocRepo
  /** The workspace's page tree: nesting and order. */
  pages: PageRepo
  /** Hears the workspace open in the app: a new deck is saved there. */
  onWorkspace: (id: string | null) => void
}

/** The editor for one deck: loads it and saves it. */
export function App({ route, account, repo, backup, workspaces, docs, pages, onWorkspace }: Props) {
  const [s, app] = useAppState()
  const frame = useRef<HTMLDivElement>(null), measurerRef = useRef<Measurer | null>(null)
  const cacheId = account.id === DEV_ACCOUNT.id ? undefined : account.id
  const sendRef = useRef<((text: string) => void) | null>(null)
  const turns = useRef<TurnRecord[]>([]), bootStarted = useRef(false)
  // Who wrote the next save, for its version: the agent right after a turn, or a restore. Kept until a save lands.
  const author = useRef<SaveMeta | null>(null)
  // Counts saves that landed, so the Versions panel knows to read the list again.
  const [saves, setSaves] = useState(0)
  // The deck last opened from the URL (or found missing there).
  const [opened, setOpened] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false), [booted, setBooted] = useState(false), [healthKnown, setHealthKnown] = useState(false), [loaded, setLoaded] = useState(false)
  // The frame index.html painted stays until boot has put the deck on screen (or started a new one), not the gallery in between.
  useEffect(() => {
    if (!booted) return
    bootDone()
    whenIdle(() => void docScreen.preload())
  }, [booted])
  // Your decks (⌘\) and the chat (⌘L) down the left. The chat is open unless hidden; the decks start hidden on a
  // laptop-width window, where the slide needs the room, until the maker opens them.
  const [decksOpen, toggleDecks] = usePanel(DECKS_OPEN, '\\', () => matchMedia(ROOMY).matches)
  const [chatOpen, toggleChat] = usePanel(CHAT_OPEN, 'l')
  // The workspace open in the app: the most recently used, until another is picked in the sidebar.
  const ws = useWorkspace(workspaces, (w) => { onWorkspace(w?.id ?? null); app.dispatch({ type: 'set', patch: { workspaceId: w?.id ?? null, role: w?.role ?? null } }) }, account.id === DEV_ACCOUNT.id ? undefined : account.id)
  // What the tour step on screen has the editor show (the chat, the grid, Versions, the comments).
  const [tourShow, setTourShow] = useState<TourShow | null>(null)
  useEffect(() => { if (tourShow === 'chat' && !chatOpen) toggleChat() }, [tourShow, chatOpen, toggleChat])
  // The same deck object until a slide or the look changes: it is what the presentation tab follows.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deckOf reads only these four
  const deck = useMemo(() => deckOf(s), [s.items, s.style, s.theme, s.accent])
  const liveKey = useMemo(newLiveKey, [])
  usePublishDeck(deck.slides.length ? deck : null, liveKey)

  const measurer = useCallback((): Measurer => {
    if (!frame.current) throw new Error('the measuring frame is not mounted')
    return (measurerRef.current ??= createMeasurer(frame.current))
  }, [])
  const say = useCallback((text: string, sub?: string) => app.dispatch({ type: 'message', message: { kind: 'bot', text, sub } }), [app])
  const recheck = useCallback(() => app.dispatch({ type: 'items', items: recheckRules(app.getState(), measurer()) }), [app, measurer])
  const tour = useTour(app, recheck)
  const offerTour = tour.offer

  // The deck as last saved (or opened): a save happens only when this changes, so opening a deck or selecting a
  // slide does not stamp it as edited and move it up the list.
  const savedKey = useRef<string | null>(null)
  const unsaved = (d: SavedDeck) => editKey(d) !== savedKey.current
  // A deck opened by a viewer of its workspace is read, never written: no chat, no edits, no saves. A viewer with nothing open gets the same page, empty.
  const [viewOnly, setViewOnly] = useState(false)
  const readOnly = viewOnly || (booted && s.role === 'viewer' && !s.items.length)
  // Where the next new deck goes (Add subpage → Deck): read by the route's `newDeck`, which a pick from a deck in progress reaches later.
  const wantParent = useRef<PageRef | null>(null)
  const newDeck = useCallback(() => {
    app.dispatch({ type: 'new', parent: wantParent.current ?? undefined }); wantParent.current = null
    turns.current = []; savedKey.current = null; setViewOnly(false)
  }, [app])
  const openDeck = useCallback((d: SavedDeck) => {
    turns.current = []
    setViewOnly(repo.role?.(d.id) === 'viewer')
    app.dispatch({ type: 'open', deck: d })
    // Rule checks re-run with the current code, on slides upgraded to the current schema. The slide that opens (a link with
    // ?slide=<id> opens on that slide) is measured at once and shows; the others keep their stored checks until the
    // browser is idle, so the page is not held up by measuring slides nobody is looking at yet.
    const opened = app.getState(), items = opened.items.map((it) => ({ ...it, slide: upgrade(it.slide) }))
    const want = new URLSearchParams(location.search).get('slide'), at = items.findIndex((it) => it.id === want)
    const first = at >= 0 ? at : Math.min(Math.max(opened.current, 0), items.length - 1)
    app.dispatch({ type: 'items', items: recheckRules({ ...opened, items }, measurer(), new Set([first])) })
    if (at >= 0) app.dispatch({ type: 'select', index: at })
    recheckInIdle({ app, measurer, deckId: app.getState().deckId, skip: items[first]?.id ?? null })
    if (!d.messages?.length) say(WELCOME)
    const now = toSaved(app.getState())
    savedKey.current = now && editKey(now)
    const wsId = app.getState().workspaceId
    if (cacheId && wsId) touchLastDeckInWorkspace(cacheId, wsId, d.id)
  }, [app, measurer, say, repo, cacheId])

  const readKept = useCallback((id: string | undefined) => keptDeck(repo, cacheId, id, backup), [cacheId, backup, repo])

  // After a deck opens from this browser's copy: read the server's, merge what changed by slide id (as when another
  // writer changed it), take its role, and if the deck is gone and nothing was edited meanwhile, start a new one.
  const syncRef = useRef<((force?: boolean) => Promise<'gone' | undefined>) | null>(null)
  const refreshKept = useCallback(async (id: string) => {
    try {
      const gone = await syncRef.current?.(true)
      if (app.getState().deckId !== id) return
      setViewOnly(repo.role?.(id) === 'viewer')
      const now = toSaved(app.getState())
      if (gone === 'gone' && (!now || editKey(now) === savedKey.current)) {
        void forgetCachedDeck(account.id, id)
        newDeck()
        if (route.name === 'deck') say(MISSING)
      }
    } catch { /* offline or refused: the copy stays, and the next save finds out */ }
  }, [app, repo, account.id, newDeck, route, say])
  const afterKeptOpen = useCallback((id: string) => { void refreshKept(id) }, [refreshKept])
  const openKept = useCallback(
    (id: string) => openKeptDeck(repo, cacheId, backup, id, openDeck, afterKeptOpen),
    [repo, cacheId, backup, openDeck, afterKeptOpen],
  )

  // Boot: the deck in the URL (nothing is saved before it is loaded, so an early pick cannot overwrite it),
  // then fonts (slides measure text) and whether the models are reachable.
  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true
    void (async () => {
      // The copy of the deck kept in this browser opens at once; the server is asked what changed after it is on screen.
      const fromCache = route.name === 'deck' || route.name === 'home' ? await readKept(route.name === 'deck' ? route.id : undefined) : null
      // Signed in, / is the editor on the deck worked on last in the open workspace; only that deck is read in full.
      const recent = fromCache || route.name !== 'home' ? undefined : (await repo.list((await ws.ready)?.id).catch(() => []))[0]
      const id = route.name === 'deck' ? route.id : recent?.id
      const wanted = fromCache ? fromCache.deck : id ? await findDeck(id, repo, backup) : null
      setLoaded(true)
      // Whether the models are up does not hold the deck back: the composer waits for the answer, the slides do not.
      const health = fetch(config.healthUrl, { signal: AbortSignal.timeout(3000) }).then((r) => r.json()).then((j: { live?: unknown }) => !!j.live).catch(() => false)
      void health.then((live) => { app.dispatch({ type: 'set', patch: { live } }); setHealthKnown(true) })
      if (route.name === 'deck') setOpened(route.id)
      // A tile picked while this loaded already started a deck: it wins over reopening the last one.
      if (app.getState().deckId) { setBooted(true); return }
      if (wanted && fromCache) {
        setBooted(true)
        openDeck(wanted)
        void refreshKept(wanted.id)
        void document.fonts.ready
        return
      }
      await document.fonts.ready
      setBooted(true)
      if (wanted) { openDeck(wanted); return }
      newDeck()
      if (route.name === 'deck') say(MISSING)
      // A prompt typed on the site sets the style picked there, and builds the first slide when the models are up.
      const pending = parsePending(takePendingPrompt())
      if (pending) app.dispatch({ type: 'set', patch: { style: pending.style } })
      // Only a prompt waiting to be sent needs the answer first.
      if (pending && (await health) && app.getState().role !== 'viewer') void sendRef.current?.(pending.text)
    })()
  }, [app, repo, backup, openDeck, newDeck, route, say, ws.ready, readKept, refreshKept])

  // Writes made elsewhere (an agent, another tab) are merged in by slide id; the agent hears which slides changed.
  const onMerged = useCallback((changed: string[], by: string[]) => {
    app.dispatch({ type: 'items', items: recheckRules(app.getState(), measurer()) })
    if (!changed.length) return
    app.dispatch({ type: 'set', patch: { edited: [...new Set([...app.getState().edited, ...changed])] } })
    if (by.length) say(`${by.join(', ')} updated ${changed.length === 1 ? 'a slide' : `${changed.length} slides`}.`)
  }, [app, measurer, say])
  const syncNow = useLiveDeck({ app, repo, onMerged })
  syncRef.current = syncNow

  const persist = usePersist({ app, repo, backup, syncNow, author, savedKey, onSaved: () => setSaves((n) => n + 1) })

  // While the deck in the URL is still opening, the URL is left alone, and the doc it was picked from stays on screen rather
  // than the deck held behind it.
  const switching = route.name === 'deck' && booted && route.id !== s.deckId && opened !== route.id
  const [lastDoc, setLastDoc] = useState<string | null>(null)
  const docOnScreen = route.name === 'doc' ? route.id : switching ? lastDoc : null
  if (docOnScreen !== lastDoc) setLastDoc(docOnScreen)

  // Save 250 ms after the last change, never mid-turn.
  useEffect(() => {
    if (!loaded || s.busy || !s.deckId || viewOnly) return
    const t = setTimeout(() => {
      const saved = toSaved(app.getState())
      if (!saved) return
      // A doc on screen keeps its URL; the deck held behind it still saves.
      if (location.pathname !== `/d/${saved.id}` && route.name !== 'doc' && !switching) go(`/d/${saved.id}`, { replace: true })
      if (unsaved(saved)) void persist(saved)
    }, config.saveDelayMs)
    return () => clearTimeout(t)
  }, [s, loaded, app, persist, route.name, viewOnly, switching])

  usePresence(repo, s.deckId, s.busy, s.editing)

  // Another deck picked in the sidebar (or Back/Forward): open it, or start a new one at /new. Boot handles the
  // route the page opened on; a pick made while it runs is acted on as soon as boot is done, never dropped.
  // A new deck's own URL becoming /d/:id after its first save is the deck already open, and is left alone.
  const where = route.name === 'deck' ? route.id : route.name
  const shown = useRef(where)
  useEffect(() => {
    if (!booted || shown.current === where) return
    // A slide is being edited: history navigation (Back, a pasted link) must not drop the draft. The URL goes back.
    if (app.getState().editing) { const id = app.getState().deckId; if (id) go(`/d/${id}`, { replace: true }); return }
    shown.current = where
    if (route.name === 'new') { if (app.getState().items.length || app.getState().history.length) newDeck(); return }
    if (route.name !== 'deck' || route.id === app.getState().deckId) return
    const id = route.id
    void (async () => {
      if (await openKept(id)) return
      if (await openDeckFromServer(id, repo, backup, openDeck)) return
      newDeck(); say(MISSING)
    })().finally(() => setOpened(id))
  }, [route, where, booted, app, repo, backup, openDeck, newDeck, say, openKept])
  // Leaving a deck saves it now rather than after the usual pause.
  const leaveTo = useCallback((path: string) => {
    if (locked(app.getState())) return
    const saved = toSaved(app.getState())
    if (saved && unsaved(saved)) void persist(saved)
    go(path)
  }, [app, persist])
  // A new deck: at the top, or under `parent`. An empty deck held in the editor is reused, so only its parent changes.
  const startDeck = useCallback((parent: PageRef | null) => {
    const st = app.getState()
    if (locked(st)) return
    if (!st.items.length && !st.history.length) { app.dispatch({ type: 'set', patch: { pendingParent: parent } }); if (route.name !== 'new') leaveTo('/new'); return }
    wantParent.current = parent
    leaveTo('/new')
  }, [app, route.name, leaveTo])
  const onDeckDeleted = useCallback((id: string) => { if (id === app.getState().deckId) { newDeck(); go('/new') } }, [app, newDeck])
  // A doc saved or renamed: the sidebar lists it again, and the doc on screen is read again.
  const [docTick, setDocTick] = useState(0)
  // Rename, delete and new doc in the sidebar show at once and are sent behind the scenes (see useRowActions).
  const rows = useRowActions({
    repos: { decks: repo, docs }, wsId: ws.current?.id ?? null, onDeckDeleted, onOpenDoc: (id) => leaveTo(`/doc/${id}`), onDocRenamed: () => setDocTick((t) => t + 1),
    onDocDeleted: (id) => { if (route.name === 'doc' && route.id === id) leaveTo('/') },
  })
  // Delete from the deck menu: the open deck goes at once, and a new one starts in its place.
  const deleteDeck = useCallback(() => {
    const id = app.getState().deckId
    if (!id || locked(app.getState())) return
    const st = app.getState()
    rows.remove({ ref: { kind: 'deck', id }, name: deckName({ name: st.name, items: st.items }) })
  }, [app, rows])

  const { live, busy, current, items } = s
  useEffect(() => refreshPills(app), [live, busy, current, items, app])

  const send = useCallback(async (text: string, files: Attached[] = []) => {
    const r = await sendTurn(text, { measurer: measurer(), dispatch: app.dispatch, getState: app.getState }, files)
    // The save after the turn is the agent's: its version carries the turn and the request in the user's words.
    if (r.turn) author.current = { by: 'agent', turn: r.turn, label: text.trim().slice(0, 300) || 'Files' }
    if (r.written?.length) offerTour()
    turns.current.push(r)
    return r
  }, [app, measurer, offerTour])
  const setStyle = useCallback((style: Style) => app.dispatch({ type: 'set', patch: { style } }), [app])
  const load = useCallback((slides: Slide[], style: Style) => {
    turns.current = []
    const items: Item[] = slides.map((sl, i) => ({ id: `s_t${i}`, slide: upgrade(sl), status: 'ok', errors: [], warnings: [], checks: [], checksPending: false }))
    app.dispatch({ type: 'set', patch: { style, history: [], working: new Set(), items, current: 0, view: 'editor' } })
  }, [app])

  useEffect(() => installDebug({ booted, live: s.live, items: s.items, current: s.current, turns: turns.current, send, setStyle, load }))

  // The presentation opens in its own tab and follows this deck as it is edited.
  const present = useCallback(() => { if (!locked(app.getState()) && app.getState().items.length) openPresentation(liveKey, app.getState().current) }, [app, liveKey])
  // The pages above the open one, for the header (read from the same list as the sidebar).
  const crumbs = usePageCrumbs({ repo: pages, workspaceId: ws.current?.id ?? null, account: account.id === DEV_ACCOUNT.id ? undefined : account.id, tick: docTick, saved: s.items.length > 0,
    open: docOnScreen ? { kind: 'doc', id: docOnScreen } : s.deckId ? { kind: 'deck', id: s.deckId } : null })
  const docName = usePageName({ repo: pages, workspaceId: ws.current?.id ?? null, account: account.id === DEV_ACCOUNT.id ? undefined : account.id, open: docOnScreen ? { kind: 'doc', id: docOnScreen } : null })
  const openPage = (ref: { kind: 'deck' | 'doc'; id: string }) => leaveTo(ref.kind === 'deck' ? `/d/${ref.id}` : `/doc/${ref.id}`)
  const bar = {
    onStyle: (style: Style) => { if (!locked(app.getState())) setStyle(style) },
    onTheme: (theme: Theme) => !locked(app.getState()) && app.dispatch({ type: 'set', patch: { theme } }),
    onAccent: (accent: string | null) => !locked(app.getState()) && app.dispatch({ type: 'set', patch: { accent } }),
    onPresent: present,
    onAdd: () => { if (!locked(app.getState()) && app.getState().items.length) app.dispatch({ type: 'set', patch: { view: 'add' } }) },
    decksOpen, onToggleDecks: toggleDecks, chatOpen, onToggleChat: toggleChat,
    onSite: () => leaveTo('/home'),
    onTour: tour.start,
    // A share link lives on the server copy: the dev account keeps its decks in this browser.
    shareId: backup ? s.deckId : null,
    onPdf: () => { if (app.getState().items.length) setPrinting(true) },
    onRename: (name: string) => { if (!locked(app.getState())) app.dispatch({ type: 'set', patch: { name } }) },
    // Only a deck that has been saved can be deleted: one with slides.
    crumbs, onOpenPage: openPage,
    onDelete: s.deckId && s.items.length ? deleteDeck : null,
    // Deleting a deck takes the pages under it too, so the dialog first asks how many there are.
    subpages: async () => { try { return await pages.subpages({ kind: 'deck', id: app.getState().deckId ?? '' }) } catch { say('Couldn’t check for subpages.'); return null } },
    account,
  }

  const flush = useCallback(async () => {
    const saved = toSaved(app.getState())
    if (saved && unsaved(saved)) await persist(saved)
  }, [app, persist])
  const { versions, undoTurn } = useVersions({ app, repo, author, flush, recheck, say })

  const onClear = useCallback(() => {
    if (locked(app.getState())) return
    app.dispatch({ type: 'set', patch: { history: [], working: new Set(), messages: [{ kind: 'bot', text: '', sub: CLEARED }] } })
  }, [app])
  const onEdit = useCallback((id: string | null) => app.dispatch({ type: 'edit', id }), [app])
  const edit = useMemo(() => ({ measurer, save: (id: string, draft: Slide) => saveEdit(id, draft, { measurer: measurer(), dispatch: app.dispatch, getState: app.getState }) }), [app, measurer])
  const onSelect = useCallback((index: number) => app.dispatch({ type: 'select', index }), [app])
  const onMove = useCallback((id: string, to: number) => app.dispatch({ type: 'moveSlide', id, to }), [app])
  // Speaker notes change nothing on the slide, so they are written straight to it: no checks or measuring to rerun.
  const onTalk = useCallback((id: string, talk: string) => app.dispatch({ type: 'items', items: app.getState().items.map((it) => (it.id === id && it.slide ? { ...it, slide: { ...it.slide, talk } } : it)) }), [app])
  const onRemove = useCallback((id: string) => app.dispatch({ type: 'removeSlide', id }), [app])
  const onRestore = useCallback(() => app.dispatch({ type: 'restoreSlide' }), [app])
  // A prompt from the landing (or Add slide) builds the slide in the editor.
  const onSend = useCallback((text: string, files?: Attached[]) => {
    if (app.getState().view !== 'editor') app.dispatch({ type: 'set', patch: { view: 'editor' } })
    void send(text, files)
  }, [app, send])
  sendRef.current = onSend
  const commentActions = useComments(app, authorOf(account), onSend)
  // Rebuild in Occam: a new deck in the reviewed deck's style, written by the agent from its text and the review.
  const rebuild = useCallback((brief: string, file: Attached, style: Style) => {
    if (locked(app.getState())) return
    newDeck(); app.dispatch({ type: 'set', patch: { style } }); onSend(brief, [file])
  }, [app, newDeck, onSend])
  // A double click or a click while busy is ignored by the reducer: one deck, one slide (Review Focus 3).
  // Inserted after the current slide and selected; numbering follows from position (Review Focus 4).
  // A starter's checks run as it lands, so its check line is never empty.
  const onUse = useCallback((st: Starter) => { app.dispatch({ type: 'insertStarter', slide: starterSlide(st, app.getState().style), id: `s_${newDeckId()}` }); recheck() }, [app, recheck])
  const onCancelAdd = useCallback(() => app.dispatch({ type: 'set', patch: { view: 'editor' } }), [app])
  const onPick = useCallback((st: Starter) => { app.dispatch({ type: 'pickStarter', slide: starterSlide(st, app.getState().style), id: `s_${newDeckId()}` }); recheck() }, [app, recheck])
  // The gallery is for an empty deck. On a route that opens a deck it waits for boot, so a deck about to open is not
  // preceded by thirty slide tiles measured and drawn for nothing.
  const opening = !booted && (route.name === 'deck' || route.name === 'home')
  const stage = s.view === 'landing'
    ? (opening ? undefined : <AddSlide deck={deck} current={0} onUse={onPick} />)
    : s.view === 'add'
      ? <AddSlide deck={deck} current={s.current} onUse={onUse} onCancel={onCancelAdd} />
      : undefined

  // The workspace down the left (⌘\), beside the editor or a doc.
  const sidebar = decksOpen && <Sidebar ws={ws} repos={{ decks: repo, docs, pages, workspaces }} rows={rows} busy={locked(s)}
    open={{ deck: { id: s.deckId, name: deckName({ name: s.name, items: s.items }), slides: s.items.length, parent: s.pendingParent }, doc: route.name === 'doc' ? route.id : null, docTick }}
    onOpenDeck={(id) => leaveTo(`/d/${id}`)} onNewDeck={startDeck}
    onOpenDoc={(id) => leaveTo(`/doc/${id}`)} onRenameOpenDeck={bar.onRename} me={account.id} />

  const DocScreen = docScreen.get()
  return (
    <TooltipProvider delayDuration={400}>
      {!docOnScreen && readOnly
        ? <Suspense fallback={<div className="h-full bg-app-bg" />}><ViewDeck deck={deck} name={deckName({ name: s.name, items: s.items })} ids={s.items.map((it) => it.id)} sidebar={sidebar} sidebarOpen={decksOpen} onToggleSidebar={toggleDecks}
          onPresent={(from) => openPresentation(liveKey, from)} onSite={() => leaveTo('/home')} account={account} crumbs={crumbs} onOpenPage={openPage} /></Suspense>
        : docOnScreen
        ? <Suspense fallback={<div className="h-full bg-app-bg" />}><DocScreen id={docOnScreen} docs={docs} canEdit={s.role !== 'viewer'} tick={docTick} onSaved={() => setDocTick((t) => t + 1)} sidebar={sidebar} sidebarOpen={decksOpen} onToggleSidebar={toggleDecks} onSite={() => leaveTo('/home')} account={account} crumbs={crumbs} onOpenPage={openPage} name={docName} /></Suspense>
        : <Editor state={s} healthKnown={healthKnown} deck={deck} chips={chipsFor(s)} bar={bar} onSend={onSend} onClear={onClear} onSelect={onSelect} onMove={onMove} onTalk={onTalk} onRemove={onRemove} onRestore={onRestore} stage={stage} edit={edit} onEdit={onEdit} versions={versions && { api: versions, saves }} onUndo={undoTurn} comments={commentActions} tourShow={tourShow} onRebuild={rebuild} decks={sidebar} />}
      {tour.touring && <Tour onClose={tour.stop} onShow={setTourShow} />}
      {tour.nudge && !tour.touring && <TourNudge onStart={tour.start} onDismiss={tour.dismiss} />}
      {printing && <Suspense fallback={null}><PrintDeck deck={deck} name={pdfName(deckName({ name: s.name, items: s.items }))} onDone={() => setPrinting(false)} /></Suspense>}
      {/* Offscreen measuring frame: a real 1920×1080 slide, never shown. */}
      <div ref={frame} aria-hidden className="fixed left-[-10000px] top-0 h-[1080px] w-[1920px] overflow-hidden" />
    </TooltipProvider>
  )
}
