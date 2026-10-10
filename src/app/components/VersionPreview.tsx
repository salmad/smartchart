/* A version, previewed in the stage: its slides as a read-only grid in its own look, the slides it changed marked,
   and a bar to restore it or go back to the deck as it is. */
import { contexts } from '@/engine/slides/render'
import { plain } from '@/engine/slides/schema'
import { describeDiff, type TreeDiff, type Version } from '@/engine/versions'
import type { Item } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { timeOf, dayOf } from '@/app/versions'
import { Button } from './ui/button'
import { SlideView } from './SlideView'

interface Props {
  version: Version
  /** Null while its slides load, or when the server no longer has one of them. */
  items: Item[] | null | 'missing'
  diff: TreeDiff
  current: boolean; busy: boolean
  onRestore: () => void; onBack: () => void
}

export function VersionPreview({ version: v, items, diff, current, busy, onRestore, onBack }: Props) {
  const slides = Array.isArray(items) ? items : []
  const cover = slides.find((it) => it.slide.template === 'cover')
  const ctx = contexts({ footer: cover ? plain(cover.slide.title) : '', slides: slides.map((it) => it.slide), ids: slides.map((it) => it.id) })
  const marked = new Set([...diff.added, ...diff.changed]), what = describeDiff(diff)
  const day = dayOf(v.at)

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div role="status" className="flex flex-none items-center gap-4 border-b border-line px-8 py-3 max-[900px]:flex-wrap max-[900px]:px-4">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate text-[13.5px] text-ink">
            <b className="font-medium">{current ? 'Current version' : `Version from ${day === 'Today' ? '' : `${day}, `}${timeOf(v.at)}`}</b>
            <span className="text-ink-3"> · {v.by}{v.label ? ` · ${v.by === 'You' ? v.label : `“${v.label}”`}` : ''}</span>
          </p>
          {what && <p className="text-[12.5px] text-ink-3">{what}{marked.size ? '. Changed slides are marked.' : '.'}</p>}
        </div>
        <Button variant="outline" onClick={onBack}>Back to current</Button>
        {!current && <Button onClick={onRestore} disabled={busy || !Array.isArray(items)}>Restore this version</Button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8 max-[900px]:px-4">
        {items === null && <p className="text-[13px] text-ink-3">Loading its slides…</p>}
        {items === 'missing' && <p className="text-[13px] text-ink-3">This version’s slides are no longer stored.</p>}
        {Array.isArray(items) && !items.length && <p className="text-[13px] text-ink-3">The deck had no slides at this point.</p>}
        <div aria-label="Slides in this version" role="group" className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-x-6 gap-y-6 p-0.5">
          {slides.map((it, i) => (
            <figure key={it.id} className="grid gap-2">
              <SlideView slide={it.slide} deck={v.tree} ctx={ctx[i]}
                className={cn('pointer-events-none relative aspect-video w-full overflow-hidden rounded-md shadow-[0_0_0_1px_theme(colors.line)]',
                  marked.has(it.id) && 'shadow-[0_0_0_2px_theme(colors.gold)]')} />
              <figcaption className="flex gap-2 font-mono text-[11px] font-medium leading-none text-ink-3">
                <b className="font-medium text-ink-2">{String(i + 1).padStart(2, '0')}</b>
                {diff.added.includes(it.id) ? <span className="text-gold">added</span> : diff.changed.includes(it.id) && <span className="text-gold">changed</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}
