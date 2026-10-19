/* The doc's comments, in an inspector on the right like the deck's: grouped by section in doc order, open ones first and
   resolved ones folded away, and a composer. Anyone who can open the doc can comment; resolving is for editors and the
   author, deleting for the author. What a person can't use isn't shown. */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { MAX_COMMENT, type DocComment } from '@/engine/comments'
import { cn } from '@/app/lib/utils'
import { timeOf } from '@/app/versions'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { WHOLE_DOC, type Anchor } from './anchors'

/** What the next comment is about: an anchor, and the words selected there. */
export interface CommentTarget { anchor: string; quote?: string }

interface Props {
  comments: DocComment[]
  anchors: Anchor[]
  target: CommentTarget | null
  onTarget: (t: CommentTarget | null) => void
  canResolve: (c: DocComment) => boolean; canDelete: (c: DocComment) => boolean
  onAdd: (text: string) => void; onResolve: (id: string) => void; onDelete: (id: string) => void
  /** Scrolls to an anchor in the page; the pointer on a row rings its anchor. */
  onShow: (anchor: string) => void; onHover: (anchor: string | null) => void
  /** Why the last change failed, as a sentence. */
  error: string | null
  onClose: () => void
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)

export function DocComments({ comments, anchors, target, onTarget, canResolve, canDelete, onAdd, onResolve, onDelete, onShow, onHover, error, onClose }: Props) {
  const [text, setText] = useState(''), [folded, setFolded] = useState(true), box = useRef<HTMLTextAreaElement>(null)
  const open = comments.filter((c) => !c.done), done = comments.filter((c) => c.done)
  const byId = new Map(anchors.map((a) => [a.id, a]))
  // Picking words on the page brings the cursor here.
  useEffect(() => { if (target) { box.current?.focus(); box.current?.scrollIntoView({ block: 'nearest' }) } }, [target])

  // Groups in doc order: the doc itself, each section, then what is no longer in the doc.
  const groups = new Map<string, DocComment[]>()
  for (const c of open) {
    const key = byId.has(c.anchor) ? (byId.get(c.anchor) as Anchor).section : 'gone'
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const order = [...new Set([WHOLE_DOC, ...anchors.map((a) => a.section), 'gone'])].filter((k) => groups.has(k))
  const nameOf = (key: string) => (key === 'gone' ? 'No longer in the doc' : (byId.get(key) as Anchor).label)

  const add = () => { if (text.trim()) { onAdd(text.trim().slice(0, MAX_COMMENT)); setText('') } }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); add() }
    if (e.key === 'Escape' && target) { e.preventDefault(); e.stopPropagation(); onTarget(null) }
  }
  const on = target ? (byId.get(target.anchor)?.label ?? 'Whole doc') : 'Whole doc'
  const row = (c: DocComment) => <Row key={c.id} c={c} anchor={byId.get(c.anchor)} resolve={canResolve(c)} remove={canDelete(c)} onShow={onShow} onHover={onHover} onResolve={onResolve} onDelete={onDelete} />

  return (
    <aside aria-label="Comments" data-tour="comments-panel"
      className="flex w-[320px] min-h-0 flex-none flex-col border-l border-line bg-app-bg max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[70dvh] max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-medium text-ink">Comments</h2>
          <p className="text-[12.5px] text-ink-3">{open.length ? `${open.length} open · ` : ''}Select words, or hover a heading or figure, to comment.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close comments"
          className="-mr-1 -mt-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 pb-4">
        {order.map((k) => (
          <section key={k} className="grid gap-2">
            <h3 className="truncate pb-0.5 pt-1 text-[12px] font-medium text-ink-2">{k === WHOLE_DOC ? 'Whole doc' : nameOf(k)}</h3>
            <ul className="grid gap-2">{(groups.get(k) ?? []).map(row)}</ul>
          </section>
        ))}
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            On
            <span className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md bg-panel pl-2 pr-1 text-ink-2 shadow-[0_0_0_1px_theme(colors.line)]">
              <span className="truncate">{on}{target?.quote ? ` · “${cut(target.quote, 40)}”` : ''}</span>
              {target && <button type="button" aria-label="Whole doc instead" onClick={() => onTarget(null)} className="grid size-4 flex-none cursor-pointer place-items-center rounded text-ink-3 hover:text-ink"><X className="size-3" /></button>}
            </span>
          </div>
          <Textarea ref={box} rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} aria-label="New comment" placeholder="Leave a note" />
          {error && <p role="alert" className="text-[12.5px] text-warn">{error}</p>}
          <div className="flex justify-end"><Button size="sm" disabled={!text.trim()} onClick={add}>Comment</Button></div>
        </div>
        {done.length > 0 && (
          <div className="border-t border-line pt-2">
            <button type="button" aria-expanded={!folded} onClick={() => setFolded(!folded)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink">
              {done.length} resolved<span aria-hidden className={cn('text-ink-3 transition-transform', !folded && 'rotate-90')}>›</span>
            </button>
            {!folded && <ul className="mt-2 grid gap-2">{done.map(row)}</ul>}
          </div>
        )}
      </div>
    </aside>
  )
}

interface RowProps {
  c: DocComment; anchor: Anchor | undefined; resolve: boolean; remove: boolean
  onShow: (anchor: string) => void; onHover: (anchor: string | null) => void; onResolve: (id: string) => void; onDelete: (id: string) => void
}

function Row({ c, anchor, resolve, remove, onShow, onHover, onResolve, onDelete }: RowProps) {
  const ring = anchor && anchor.id !== WHOLE_DOC ? anchor.id : null
  return (
    <li onMouseEnter={() => onHover(ring)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(ring)} onBlur={() => onHover(null)}
      className={cn('group grid gap-1 rounded-lg border border-line bg-panel px-3 py-2.5', c.done && 'opacity-70')}>
      <div className="flex items-baseline gap-2 text-[12px]">
        <b className="font-medium text-ink">{c.by}</b>
        <time className="font-mono text-[11px] text-ink-3" dateTime={new Date(c.at).toISOString()}>{timeOf(c.at)}</time>
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {!c.done && resolve && <IconButton label="Resolve" onClick={() => onResolve(c.id)}><Check className="size-3.5" /></IconButton>}
          {remove && <IconButton label="Delete" onClick={() => onDelete(c.id)}><Trash2 className="size-3.5" /></IconButton>}
        </span>
      </div>
      {(anchor || c.quote) && (
        <p className="truncate text-[11.5px] text-ink-3">
          {anchor && anchor.id !== WHOLE_DOC && anchor.id !== anchor.section
            ? <button type="button" title="Show in doc" onClick={() => onShow(anchor.id)} className="cursor-pointer text-ink-2 hover:text-ink">{anchor.label}</button> : null}
          {c.quote && <span>{anchor && anchor.id !== anchor.section ? ' · ' : ''}“{c.quote}”</span>}
        </p>
      )}
      {!anchor && <p className="text-[11.5px] text-ink-3">gone</p>}
      <p className="whitespace-pre-wrap text-[13px] text-ink">{c.text}</p>
      {c.done && <p className="text-[12.5px] text-ink-2"><span className="text-ink-3">{c.done.by}:</span> {c.done.reply || 'Resolved.'}</p>}
    </li>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="grid size-6 cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-raise hover:text-ink">
      {children}
    </button>
  )
}
