import { useEffect, useState, type ReactNode } from 'react'
import type { TourShow } from '@/app/tour'
import { diffTrees, type TreeDiff, type Version } from '@/engine/versions'
import type { VersionsApi } from '@/app/useVersions'
import type { CommentActions } from '@/app/useComments'
import { openComments, quoteOf } from '@/engine/comments'
import { getAt } from '@/engine/slides/edit'
import type { Item } from '@/app/store'
import type { Pill } from '@/engine/agent/suggest'
import type { Deck, Slide, Style, Theme } from '@/engine/types'
import { locked, type AppState } from '@/app/state'
import type { Measurer } from '@/app/measure'
import { EditMode } from '@/app/edit/EditMode'
import type { Attached } from '@/app/files'
import { deckName } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { phaseLinesOf } from '@/app/phase'
import { useRoomy } from '@/app/panel'
import { Bar, type BarProps, type DeckView } from './Bar'
import { Chat } from './Chat'
import { Checks } from './Checks'
import { CommentsPanel } from './Comments'
import { SlideActions } from './SlideActions'
import { Composer } from './Composer'
import { LookPanel } from './LookPanel'
import { SLIDE_W, Stage, UNDER_SLIDE } from './Stage'
import { Storyline } from './Storyline'
import { Strip } from './Strip'
import { VersionPreview } from './VersionPreview'
import { VersionsPanel } from './VersionsPanel'
import { ReviewDeck } from './ReviewDeck'
import type { Attached as File } from '@/app/files'

export interface EditorProps {
  state: AppState; booted: boolean; deck: Deck; chips: Pill[] | null
  bar: Omit<BarProps, 'title' | 'hasSlides' | 'busy' | 'live' | 'view' | 'onView' | 'onLook' | 'onVersions'> & {
    onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void; onAdd: () => void
  }
  onSend: (text: string, files?: Attached[]) => void; onClear: () => void; onSelect: (index: number) => void
  onMove: (id: string, to: number) => void; onTalk: (id: string, talk: string) => void; onRemove: (id: string) => void; onRestore: () => void
  /** Replaces the slide, checks and strip: the starter picker (a new deck, or Add slide). */
  stage?: ReactNode
  /** Your decks, down the left; null while hidden. */
  decks: ReactNode
  edit: { measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null> }
  onEdit: (id: string | null) => void
  /** Null when the decks' store keeps no versions; `saves` counts saves that landed. */
  versions: { api: VersionsApi; saves: number } | null
  onUndo: ((turn: string) => void) | null
  comments: CommentActions
  /** What the tour has the editor show right now. */
  tourShow: TourShow | null
  /** Rebuild in Occam: a new deck, written from a reviewed deck's text. */
  onRebuild: (brief: string, file: File, style: Style) => void
}

type Preview = { v: Version; diff: TreeDiff; current: boolean; items: Item[] | null | 'missing' }

/** The editor screen: the bar, the chat, and the deck in one of three views (one slide, every slide, the storyline),
    with the deck's look as an inspector on the right while it is open. */
export function Editor({ state: s, booted, deck, chips, bar, onSend, onClear, onSelect, onMove, onTalk, onRemove, onRestore, stage, decks, edit, onEdit, versions, onUndo, comments, tourShow, onRebuild }: EditorProps) {
  const { items, current } = s
  const lock = locked(s), editing = s.editing !== null && items[current]?.id === s.editing
  const [view, setView] = useState<DeckView>('slide')
  // The right inspector: the deck's look, or its versions (one at a time).
  const [side, setSide] = useState<'look' | 'versions' | 'comments' | null>(null)
  // Comments: the part of the slide the next note is about, and the part a row points at while the pointer is on it.
  const [target, setTarget] = useState<string | null>(null), [ring, setRing] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null), [reviewing, setReviewing] = useState(false)
  // Look is an inspector on the right. Where the window is too narrow for it, the decks and the chat beside the slide,
  // the decks step aside while it is open; their button brings them back and closes it.
  const roomy = useRoomy(), decksAside = side === 'look' && !roomy && bar.decksOpen
  useEffect(() => {
    if (!decksAside) return
    // ⌘\ does what the decks button does here: it closes Look, rather than hiding decks that are already out of sight.
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); e.stopPropagation(); setSide(null) } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [decksAside])
  const closeVersions = () => { setSide(null); setPreview(null) }
  // A note's target belongs to one slide.
  useEffect(() => { setTarget(null); setRing(null) }, [items[current]?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const closeComments = () => { setSide(null); setTarget(null); setRing(null) }
  const toggleComments = () => { if (side === 'comments') closeComments(); else { setPreview(null); setSide('comments') } }
  const showVersion = (v: Version, before: Version | null, current: boolean) => {
    const p: Preview = { v, diff: diffTrees(before?.tree ?? null, v.tree), current, items: null }
    setPreview(p)
    versions?.api.items(v).then((items) => setPreview((now) => (now?.v.n === v.n ? { ...now, items: items ?? 'missing' } : now)), () => setPreview((now) => (now?.v.n === v.n ? { ...now, items: 'missing' } : now)))
  }
  // The tour's step shows its part of the editor, and puts it back when the step ends.
  useEffect(() => {
    if (tourShow === 'grid') setView('grid')
    if (tourShow === 'comments') setSide('comments')
    return () => { setView('slide'); if (tourShow === 'comments') closeComments() }
  }, [tourShow])
  // The view switch only applies when the stage shows the deck.
  const shown = items.length && !stage && !editing && !preview ? view : null
  const open = (i: number) => { onSelect(i); setView('slide') }
  // Open comments per slide, for the strip's badges.
  const noted = Object.fromEntries(items.map((it) => [it.id, openComments(s.comments, it.id).length]))

  // F presents; the arrows move through the deck. Typing in a field is left alone.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (stage || preview || s.editing || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return
      if (e.key === 'e' && items[current] && !lock) { e.preventDefault(); onEdit(items[current].id) }
      if (e.key === 'c' && items[current] && !lock && !editing) { e.preventDefault(); toggleComments() }
      if (e.key === 'f') bar.onPresent()
      if (e.key === 'ArrowRight' && current < items.length - 1) onSelect(current + 1)
      if (e.key === 'ArrowLeft' && current > 0) onSelect(current - 1)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar, current, items, onSelect, onEdit, stage, preview, s.editing, lock, side])

  const strip = (layout: 'row' | 'grid') => (
    <Strip items={items} current={current} deck={deck} busy={lock} noted={noted} onSelect={onSelect} onAdd={bar.onAdd} layout={layout}
      onOpen={layout === 'grid' ? open : undefined} onMove={onMove} onRemove={onRemove} removed={s.removed?.item ?? null} onRestore={onRestore} />
  )

  return (
    <>
      <Bar {...bar} decksOpen={bar.decksOpen && !decksAside} onToggleDecks={decksAside ? () => setSide(null) : bar.onToggleDecks} title={deckName({ name: s.name, items })} hasSlides={items.length > 0} busy={lock} live={s.live}
        view={shown || null} onView={setView} onLook={() => { setPreview(null); setSide('look') }} onVersions={versions && (() => setSide('versions'))} onReview={() => setReviewing(true)} />
      <div className="flex h-[calc(100%-56px)] max-[900px]:h-auto max-[900px]:flex-col">
        {!decksAside && decks}
        {/* Hidden, not unmounted: a half-written message survives. On a phone the chat always shows, under the deck. */}
        <aside aria-label="Chat" data-tour="chat" className={cn('flex w-[368px] min-h-0 flex-none flex-col border-r border-line bg-panel max-[900px]:order-3 max-[900px]:w-auto max-[900px]:border-r-0 max-[900px]:border-t max-[900px]:bg-transparent', !bar.chatOpen && 'min-[901px]:hidden')}>
          <Chat messages={s.messages} offline={booted && !s.live} onUndo={onUndo} busy={lock} onReview={() => setReviewing(true)} />
          <Composer chips={chips} canSend={s.live && !lock} busy={s.busy} hint={s.editing ? 'Save or discard to keep chatting' : undefined} onSend={onSend} onClear={onClear}
            start={items.length ? undefined : { style: s.style, onStyle: bar.onStyle }} />
        </aside>
        {preview
          ? <main className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] max-[900px]:contents">
              <VersionPreview version={preview.v} items={preview.items} diff={preview.diff} current={preview.current} busy={lock} onBack={() => setPreview(null)}
                onRestore={() => { if (Array.isArray(preview.items)) { versions?.api.restore(preview.v, preview.items); setPreview(null) } }} />
            </main>
          : stage
          ? <main className="grid min-h-0 min-w-0 flex-1 max-[900px]:contents">{stage}</main>
          : editing
          ? <main className="flex min-h-0 min-w-0 flex-1 flex-col justify-center max-[900px]:contents">
              <EditMode key={items[current].id} item={items[current]} index={current} deck={deck} deckStyle={s.style} measurer={edit.measurer} save={edit.save} onDone={() => onEdit(null)} />
            </main>
          : shown === 'grid'
          ? <main data-tour="grid" className="min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-8 max-[900px]:contents">{strip('grid')}</main>
          : shown === 'story'
          ? <main className="grid min-h-0 min-w-0 flex-1 max-[900px]:contents">
              <Storyline items={items} deckStyle={s.style} live={s.live} busy={lock} onOpen={open}
                onMove={(id, to) => { onMove(id, to); onSelect(to) }} onAsk={(prompt) => onSend(prompt)} onTalk={onTalk} />
            </main>
          : <main className="flex min-h-0 min-w-0 flex-1 flex-col justify-center max-[900px]:contents">
              <Stage deck={deck} current={current} pick={side === 'comments' && !lock && items[current] ? { target, ring, onPick: setTarget } : undefined} slideId={items[current]?.id} phase={s.busy ? phaseLinesOf(s.messages.at(-1)?.trace) : null} onPresent={bar.onPresent} />
              {/* Under the slide and as wide as it: how its checks stand, then the deck as a filmstrip. */}
              <section className={`mx-auto flex min-w-0 max-w-[calc(100%-4rem)] flex-col gap-2 pb-5 max-[900px]:contents ${SLIDE_W} ${UNDER_SLIDE}`}>
                <div className="flex h-7 items-center justify-between gap-4 max-[900px]:order-4 max-[900px]:px-4">
                  <div data-tour="checks"><Checks item={items[current]} /></div>
                  {items[current] && <SlideActions disabled={lock} commenting={side === 'comments'} open={openComments(s.comments, items[current].id).length}
                    onEdit={() => onEdit(items[current].id)} onComment={toggleComments} />}
                </div>
                {strip('row')}
              </section>
            </main>}
        {side === 'versions' && versions && <VersionsPanel api={versions.api} saves={versions.saves} selected={preview?.v.n ?? null}
          onPreview={showVersion} onClose={closeVersions} />}
        {side === 'comments' && items[current] && !editing && !preview && (
          <CommentsPanel key={items[current].id} n={current + 1} comments={s.comments.filter((c) => c.slideId === items[current].id)} busy={lock} canAsk={s.live}
            exists={(p) => getAt(items[current].slide, p) !== undefined} target={target} onTarget={setTarget} onHover={setRing} onClose={closeComments}
            onAdd={(t) => { comments.add(items[current].id, t, target, target ? quoteOf(getAt(items[current].slide, target)) : undefined); setTarget(null) }}
            onResolve={comments.resolve} onDelete={comments.remove} onAsk={() => comments.ask(items[current].id)} />
        )}
        <ReviewDeck open={reviewing} onOpenChange={setReviewing} live={s.live} onRebuild={onRebuild} />
        {side === 'look' && <LookPanel deckStyle={s.style} theme={s.theme} accent={s.accent} styleLocked={items.length > 0}
          onStyle={bar.onStyle} onTheme={bar.onTheme} onAccent={bar.onAccent} onClose={() => setSide(null)} />}
      </div>
    </>
  )
}
