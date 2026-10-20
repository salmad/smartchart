import type { PageRef } from '@/engine/pages/tree'
import type { Crumb } from './sidebar/usePageCrumbs'

const hrefOf = (r: PageRef) => (r.kind === 'deck' ? `/d/${r.id}` : `/doc/${r.id}`)
/** Past three pages above the title, the middle ones fold into an ellipsis: the first and the last two stay. */
const SHOWN = 3

/** The pages above the open one, each a link, between the site name and the title: `Occam / Research / Competitors / Revolut`.
    Renders nothing for a page at the top. Read-only; the sidebar is where pages move. */
export function Crumbs({ crumbs, onOpen }: { crumbs?: Crumb[]; onOpen: (ref: PageRef) => void }) {
  if (!crumbs?.length) return null
  const folded = crumbs.length > SHOWN
  const items: (Crumb | 'fold')[] = folded ? [crumbs[0], 'fold', ...crumbs.slice(-2)] : crumbs
  const hidden = folded ? crumbs.slice(1, -2).map((c) => c.name).join(' / ') : ''
  return (
    <ol data-print-hide className="contents">
      {items.map((c) => (
        <li key={c === 'fold' ? 'fold' : `${c.ref.kind}:${c.ref.id}`} className="contents">
          {c === 'fold'
            ? <span title={hidden} className="flex-none text-ink-3">…</span>
            : <a href={hrefOf(c.ref)} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onOpen(c.ref) }}
                className="min-w-0 max-w-[16ch] truncate text-ink-3 hover:text-ink-2 focus-visible:outline-none focus-visible:underline">{c.name}</a>}
          <span aria-hidden className="flex-none text-ink-3">/</span>
        </li>
      ))}
    </ol>
  )
}
