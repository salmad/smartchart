/* The comments panel, on the right like Versions: the notes people left on the current slide, whole-slide or on a part,
   in one list, and a composer for the next. While it is open the stage lets you pick a part of the slide to comment on.
   Resolve or delete a note, or ask Occam to address them all (the agent makes each change, then resolves the
   comment with a reply). Resolved ones fold away, each with what was done. */
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, Sparkles, Trash2, X } from 'lucide-react'
import { openComments, pathLabel, type DeckComment } from '@/engine/comments'
import { cn } from '@/app/lib/utils'
import { timeOf } from '@/app/versions'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

interface Props {
  n: number
  /** The slide's own comments, oldest first. */
  comments: DeckComment[]
  /** Whether a part of the slide still exists, by path. */
  exists: (path: string) => boolean
  /** A turn runs or a slide is being edited: comments wait. Asking needs the models. */
  busy: boolean; canAsk: boolean
  /** The part the next note is about (from a click on the slide); null is the whole slide. */
  target: string | null
  onTarget: (path: string | null) => void
  /** The part a row points at, while the pointer is on it, so the stage can ring it. */
  onHover: (path: string | null) => void
  onAdd: (text: string) => void; onResolve: (id: string) => void; onDelete: (id: string) => void; onAsk: () => void
  onClose: () => void
}

export function CommentsPanel({ n, comments, exists, busy, canAsk, target, onTarget, onHover, onAdd, onResolve, onDelete, onAsk, onClose }: Props) {
  const [text, setText] = useState(''), [folded, setFolded] = useState(true)
  const open = openComments(comments), done = comments.filter((c) => c.done)
  const add = () => { if (text.trim() && !busy) { onAdd(text.trim()); setText('') } }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); add() }
    if (e.key === 'Escape' && target) { e.preventDefault(); e.stopPropagation(); onTarget(null) }
  }

  return (
    <aside aria-label={`Comments on slide ${n}`} data-tour="comments-panel"
      className="flex w-[320px] min-h-0 flex-none flex-col border-l border-line bg-app-bg max-[900px]:order-2 max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-medium text-ink">Comments on slide {n}</h2>
          <p className="text-[12.5px] text-ink-3">{open.length ? `${open.length} open · ` : ''}Click a part of the slide, or comment on the whole slide.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close comments"
          className="-mr-1 -mt-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 pb-4">
        {open.length > 0 && <ul className="grid gap-2">{open.map((c) => <Row key={c.id} c={c} gone={!!c.path && !exists(c.path)} busy={busy} onHover={onHover} onResolve={onResolve} onDelete={onDelete} />)}</ul>}
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            On
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-panel pl-2 pr-1 text-ink-2 shadow-[0_0_0_1px_theme(colors.line)]">
              {target ? pathLabel(target) : 'Whole slide'}
              {target && <button type="button" aria-label="Whole slide instead" onClick={() => onTarget(null)} className="grid size-4 cursor-pointer place-items-center rounded text-ink-3 hover:text-ink"><X className="size-3" /></button>}
            </span>
          </div>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} disabled={busy} aria-label="New comment"
            placeholder={busy ? 'Comments wait while Occam works.' : 'Leave a note: “This number is from Q2, update it”'} />
          <div className="flex items-center justify-between gap-2">
            {open.length > 0 && canAsk
              ? <Button size="sm" variant="outline" disabled={busy} onClick={onAsk} className="gap-1.5"><Sparkles className="size-3.5" /> Ask Occam to address {open.length === 1 ? 'it' : 'all'}</Button>
              : <span />}
            <Button size="sm" disabled={busy || !text.trim()} onClick={add}>Comment</Button>
          </div>
        </div>
        {done.length > 0 && (
          <div className="border-t border-line pt-2">
            <button type="button" aria-expanded={!folded} onClick={() => setFolded(!folded)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink">
              {done.length} resolved<span aria-hidden className={cn('text-ink-3 transition-transform', !folded && 'rotate-90')}>›</span>
            </button>
            {!folded && <ul className="mt-2 grid gap-2">{done.map((c) => <Row key={c.id} c={c} gone={!!c.path && !exists(c.path)} busy={busy} onHover={onHover} onResolve={onResolve} onDelete={onDelete} />)}</ul>}
          </div>
        )}
      </div>
    </aside>
  )
}

function Row({ c, gone, busy, onHover, onResolve, onDelete }: { c: DeckComment; gone: boolean; busy: boolean; onHover: (path: string | null) => void; onResolve: (id: string) => void; onDelete: (id: string) => void }) {
  const ring = c.path && !gone ? c.path : null
  return (
    <li onMouseEnter={() => onHover(ring)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(ring)} onBlur={() => onHover(null)}
      className={cn('group grid gap-1 rounded-lg border border-line bg-panel px-3 py-2.5', c.done && 'opacity-70')}>
      <div className="flex items-baseline gap-2 text-[12px]">
        <b className="font-medium text-ink">{c.by}</b>
        <time className="font-mono text-[11px] text-ink-3" dateTime={new Date(c.at).toISOString()}>{timeOf(c.at)}</time>
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {!c.done && <IconButton label="Resolve" disabled={busy} onClick={() => onResolve(c.id)}><Check className="size-3.5" /></IconButton>}
          <IconButton label="Delete" disabled={busy} onClick={() => onDelete(c.id)}><Trash2 className="size-3.5" /></IconButton>
        </span>
      </div>
      {c.path && (
        <p className={cn('truncate text-[11.5px]', gone ? 'text-ink-3' : 'text-ink-2')}>
          {pathLabel(c.path)}{gone && ' · gone'}{c.quote && <span className="text-ink-3"> · “{c.quote}”</span>}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[13px] text-ink">{c.text}</p>
      {c.done && <p className="text-[12.5px] text-ink-2"><span className="text-ink-3">{c.done.by}:</span> {c.done.reply || 'Resolved.'}</p>}
    </li>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="grid size-6 cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-raise hover:text-ink disabled:cursor-not-allowed disabled:opacity-45">
      {children}
    </button>
  )
}
