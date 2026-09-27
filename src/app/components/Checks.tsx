import type { Item } from '@/app/store'
import { cn } from '@/app/lib/utils'

interface Row { id: string; ok: boolean; bad?: boolean; msg: string }

/** The current slide's checks: fit errors, rule and judgment checks, then layout warnings. */
export function Checks({ item }: { item: Item | undefined }) {
  if (!item) return null
  const list: Row[] = [
    ...(item.errors || []).map((msg) => ({ id: 'fit', ok: false, bad: true, msg })),
    ...(item.checks || []),
    ...(item.warnings || []).map((msg) => ({ id: 'rule', ok: false, msg })),
  ]
  const passed = list.filter((c) => c.ok).length
  return (
    <div className="overflow-y-auto max-[900px]:order-4 max-[900px]:overflow-visible max-[900px]:border-t max-[900px]:border-line max-[900px]:px-4 max-[900px]:pb-10 max-[900px]:pt-5">
      <h3 className="mb-2.5 flex gap-2.5 font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">
        Checks
        <span className="tracking-[.04em] text-ink-2">
          {item.checksPending ? <><i className="spinner" />judging…</> : `${passed}/${list.length} pass`}
        </span>
      </h3>
      <ul className="grid gap-[3px]">
        {list.map((c, k) => (
          <li key={k} className={cn('grid grid-cols-[18px_30px_1fr] items-baseline gap-1.5 text-[13px]', c.ok ? 'text-ink-2' : 'text-ink')}>
            <span className={cn('font-semibold', c.ok ? 'text-ok' : c.bad ? 'text-bad' : 'text-warn')}>{c.ok ? '✓' : c.bad ? '✕' : '!'}</span>
            <code className="font-mono text-[11px] font-medium leading-none text-ink-3">{c.id}</code>
            <span>{c.msg}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
