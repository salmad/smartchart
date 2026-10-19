/* A version of the doc previewed in the read view: a strip above the page says which one, with Back to current and
   Restore. It is app state, so it takes the app's colours, not the page's. Esc goes back. */
import { useEffect } from 'react'
import { Button } from '@/app/components/ui/button'
import { dayOf, timeOf } from '@/app/versions'
import type { DocVersionRow } from '@/app/docs'

interface Props { version: DocVersionRow; current: boolean; /** Null while its blocks load; 'missing' when the server no longer has one. */ ready: boolean | 'missing'; busy: boolean; what: string; onRestore: () => void; onBack: () => void }

export function DocPreview({ version: v, current, ready, busy, what, onRestore, onBack }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onBack])
  const day = dayOf(v.at)
  return (
    <div role="status" className="sticky top-0 z-10 flex flex-none items-center gap-4 border-b border-line bg-app-bg px-8 py-3 max-[900px]:flex-wrap max-[900px]:px-4">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate text-[13.5px] text-ink">
          <b className="font-medium">{current ? 'Current version' : `Version from ${day === 'Today' ? '' : `${day}, `}${timeOf(v.at)}`}</b>
          <span className="text-ink-3"> · {v.by}{v.label ? ` · ${v.label}` : ''}</span>
        </p>
        {ready === 'missing' ? <p className="text-[12.5px] text-ink-3">Occam no longer has this version’s text.</p> : what && <p className="text-[12.5px] text-ink-3">{what}.</p>}
      </div>
      <Button variant="outline" onClick={onBack}>Back to current</Button>
      {!current && <Button onClick={onRestore} disabled={busy || ready !== true}>Restore this version</Button>}
    </div>
  )
}
