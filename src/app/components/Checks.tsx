import { useState } from 'react'
import type { Item } from '@/app/store'
import { config } from '@/app/config'
import { cn } from '@/app/lib/utils'

interface Row { id: string; ok: boolean; bad?: boolean; msg: string }

/** The current slide's checks, as confidence: what to act on first, the passes folded into one line. */
export function Checks({ item }: { item: Item | undefined }) {
  const [open, setOpen] = useState(false)
  if (!item) return null
  const list: Row[] = [
    ...(item.errors || []).map((msg) => ({ id: 'fit', ok: false, bad: true, msg })),
    ...(item.checks || []),
    ...(item.warnings || []).map((msg) => ({ id: 'rule', ok: false, msg })),
  ]
  const todo = list.filter((c) => !c.ok), passed = list.filter((c) => c.ok)
  return (
    <div className="overflow-y-auto max-[900px]:order-4 max-[900px]:overflow-visible max-[900px]:border-t max-[900px]:border-line max-[900px]:px-4 max-[900px]:pb-10 max-[900px]:pt-5">
      <h3 className="mb-3 flex items-baseline gap-2 text-[13px] font-medium text-ink">
        {item.checksPending ? <><i className="spinner" />Checking…</> : todo.length ? `${todo.length} to look at` : 'Every check passed'}
        {!item.checksPending && <span className="font-normal text-ink-3">{list.length} checks</span>}
      </h3>
      <ul className="grid gap-1.5">
        {todo.map((c, k) => <CheckRow key={k} c={c} />)}
      </ul>
      {passed.length > 0 && (
        <div className="mt-2">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
            className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
            <span className="font-semibold text-ok" aria-hidden>✓</span>{passed.length} passed<span aria-hidden className={cn('text-ink-3 transition-transform', open && 'rotate-90')}>›</span>
          </button>
          {open && <ul className="mt-1.5 grid gap-1.5">{passed.map((c, k) => <CheckRow key={k} c={c} />)}</ul>}
        </div>
      )}
    </div>
  )
}

function CheckRow({ c }: { c: Row }) {
  return (
    <li className={cn('grid items-baseline gap-2 text-[13px]', config.debug ? 'grid-cols-[14px_30px_1fr]' : 'grid-cols-[14px_1fr]', c.ok ? 'text-ink-2' : 'text-ink')}>
      <span className={cn('font-semibold', c.ok ? 'text-ok' : c.bad ? 'text-bad' : 'text-warn')} aria-hidden>{c.ok ? '✓' : c.bad ? '✕' : '!'}</span>
      {config.debug && <code className="font-mono text-[11px] font-medium leading-none text-ink-3">{c.id}</code>}
      <span>{c.msg}</span>
    </li>
  )
}
