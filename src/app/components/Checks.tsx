import { useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import type { Item } from '@/app/store'
import { softChecks } from '@/engine/agent/soft'
import { config } from '@/app/config'
import { cn } from '@/app/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface Row { id: string; ok: boolean; bad?: boolean; msg: string }

const rowsOf = (item: Item): Row[] => [
  ...(item.errors || []).map((msg) => ({ id: 'fit', ok: false, bad: true, msg })),
  ...(item.checks || []),
  ...(item.warnings || []).map((msg) => ({ id: 'rule', ok: false, msg })),
]

/** Under the slide: one line saying how the current slide's checks stand; a click opens them. */
export function Checks({ item }: { item: Item | undefined }) {
  if (!item) return null
  const list = rowsOf(item), todo = list.filter((c) => !c.ok)
  if (!list.length && !item.checksPending) return null
  const bad = todo.some((c) => c.bad)
  return (
    <Popover>
      <PopoverTrigger className="-mx-2 flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-[12.5px] text-ink-2 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel data-[state=open]:text-ink">
        {item.checksPending ? <><i className="spinner" />Checking…</>
          : todo.length ? <><CircleAlert aria-hidden className={cn('size-4', bad ? 'text-bad' : 'text-warn')} strokeWidth={1.75} />{todo.length} to look at</>
          : <><CircleCheck aria-hidden className="size-4 text-ok" strokeWidth={1.75} />All {list.length} checks pass</>}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} aria-label="Slide checks"
        className="max-h-[min(420px,60vh)] w-[420px] overflow-y-auto rounded-[14px] border-line-2 bg-raise p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.7)]">
        <CheckList item={item} />
      </PopoverContent>
    </Popover>
  )
}

/** The current slide's checks, as confidence: what to act on first, the passes folded into one line. */
function CheckList({ item }: { item: Item }) {
  const [open, setOpen] = useState(false)
  const list = rowsOf(item), todo = list.filter((c) => !c.ok), passed = list.filter((c) => c.ok)
  // Suggestions wait until the slide fits: first the problems, then what would make it better.
  const better = item.errors?.length ? [] : softChecks(item.slide)
  return (
    <div>
      {(item.checksPending || todo.length > 0) && (
        <h3 className="mb-3 flex items-baseline gap-2 text-[13px] font-medium text-ink">
          {item.checksPending ? <><i className="spinner" />Checking…</> : `${todo.length} to look at`}
        </h3>
      )}
      <ul className="grid gap-1.5">
        {todo.map((c, k) => <CheckRow key={k} c={c} />)}
      </ul>
      {better.length > 0 && (
        <div className={cn(todo.length > 0 && 'mt-3')}>
          <h3 className="mb-1.5 text-[12.5px] font-medium text-ink-2">Could be better</h3>
          <ul className="grid gap-1.5">
            {better.map((c) => <li key={c.id} className="grid grid-cols-[14px_1fr] items-baseline gap-2 text-[13px] text-ink-2"><span aria-hidden className="text-ink-3">◦</span><span>{c.msg}</span></li>)}
          </ul>
        </div>
      )}
      {passed.length > 0 && (
        <div className={cn(todo.length > 0 && 'mt-2')}>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
            className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
            <span className="font-semibold text-ok" aria-hidden>✓</span>{todo.length ? `${passed.length} passed` : `All ${passed.length} checks pass`}<span aria-hidden className={cn('text-ink-3 transition-transform', open && 'rotate-90')}>›</span>
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
