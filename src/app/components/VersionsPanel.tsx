/* The deck's versions, as an inspector down the right of the editor (like Look): newest first, grouped by day. Each
   says who wrote it, the request in the user's words, and what changed. A click previews it in the stage; nothing is
   written until Restore. */
import { useEffect, useState } from 'react'
import { Bot, Sparkles, User, X, type LucideIcon } from 'lucide-react'
import { describeDiff, diffTrees, type Version } from '@/engine/versions'
import { cn } from '@/app/lib/utils'
import type { VersionsApi } from '@/app/useVersions'
import { dayOf, timeOf } from '@/app/versions'

interface Props {
  api: VersionsApi
  /** Saves that landed this session: the list is read again after each. */
  saves: number
  /** The version being previewed. */
  selected: number | null
  onPreview: (v: Version, before: Version | null, current: boolean) => void
  onClose: () => void
}

const icon = (by: string): LucideIcon => (by === 'You' ? User : by === 'Occam' ? Sparkles : Bot)

export function VersionsPanel({ api, saves, selected, onPreview, onClose }: Props) {
  const [list, setList] = useState<Version[] | null>(null)
  useEffect(() => {
    let live = true
    api.list().then((l) => { if (live) setList(l) }, () => { if (live) setList([]) })
    return () => { live = false }
  }, [api, saves])

  const days: [string, { v: Version; before: Version | null }[]][] = []
  list?.forEach((v, i) => {
    const day = dayOf(v.at), row = { v, before: list[i + 1] ?? null }
    if (days.at(-1)?.[0] === day) days.at(-1)?.[1].push(row); else days.push([day, [row]])
  })

  return (
    <aside aria-label="Versions" className="flex w-[300px] min-h-0 flex-none flex-col border-l border-line bg-app-bg max-[900px]:order-2 max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-medium text-ink">Versions</h2>
          <p className="text-[12.5px] text-ink-3">Every change, by you or an agent. Restore any of them.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close versions"
          className="-mr-1 -mt-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {list === null && <p className="px-2 text-[13px] text-ink-3">Reading versions…</p>}
        {list?.length === 0 && <p className="px-2 text-[13px] text-ink-3">No versions yet. They appear as the deck is saved.</p>}
        {days.map(([day, rows]) => (
          <section key={day} className="grid gap-px pb-3">
            <h3 className="px-2 pb-1.5 pt-1 font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] text-ink-3">{day}</h3>
            {rows.map(({ v, before }) => {
              const Icon = icon(v.by), what = describeDiff(diffTrees(before?.tree ?? null, v.tree)), current = v.n === list?.[0]?.n
              return (
                <button key={v.n} type="button" aria-pressed={selected === v.n} onClick={() => onPreview(v, before, current)}
                  className={cn('grid cursor-pointer grid-cols-[16px_1fr_auto] items-start gap-x-2.5 gap-y-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel',
                    'aria-pressed:bg-panel aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]')}>
                  <Icon aria-hidden className="mt-[3px] size-3.5 text-ink-3" strokeWidth={1.75} />
                  <span className="min-w-0 text-[13px] text-ink">
                    <b className="font-medium">{v.by}</b>
                    {current && <i className="ml-2 rounded-full border border-line-2 px-1.5 py-px align-[1px] font-mono text-[10px] not-italic uppercase tracking-[.06em] text-ink-2">Current</i>}
                  </span>
                  <time className="whitespace-nowrap pt-px font-mono text-[11px] text-ink-3" dateTime={new Date(v.at).toISOString()}>{timeOf(v.at)}</time>
                  {/* An agent's label is the request in the user's words; yours says what you did (a restore, an undo). */}
                  {v.label && <span className="col-start-2 col-end-4 line-clamp-2 text-[12.5px] text-ink-2">{v.by === 'You' ? v.label : `“${v.label}”`}</span>}
                  {what && <span className="col-start-2 col-end-4 text-[12px] text-ink-3">{what}</span>}
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </aside>
  )
}
