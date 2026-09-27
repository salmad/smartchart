import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Style } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { go, setPendingPrompt } from '@/app/route'

const EXAMPLES: [string, Style, string][] = [
  ['ARR bridge for the board', 'consulting', 'ARR grew from £9.8m to £17.5m in FY26: new customers +£6.2m, expansion +£2.1m, churn −£1.4m, pricing +£0.8m. Make the bridge for the board.'],
  ['The problem, for a seed deck', 'pitch', 'Seed pitch, the problem: a typical UK SME puts £540k a year of business spend on personal cards and earns nothing back. Founders carry the personal guarantee; banks cap SME credit at £25k.'],
  ['Compare three plans', 'consulting', 'Compare our plans. Starter £29 a month: 3 seats, email support, 5 integrations. Team £79: 10 seats, priority support, 20 integrations. Scale £199: unlimited seats, a dedicated manager, every integration. Recommend Team.'],
]

const STYLES: [Style, string][] = [['consulting', 'Consulting'], ['pitch', 'Pitch']]

/** The site's prompt: what you type opens the editor at /new, which builds the first slide from it. */
export function PromptBox({ id, autoFocus = false }: { id?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(''), [style, setStyle] = useState<Style>('consulting')
  const ready = text.trim().length > 0

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!ready) return
    setPendingPrompt(JSON.stringify({ text: text.trim(), style }))
    go('/new')
  }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }

  return (
    <form id={id} onSubmit={submit} className="grid gap-3">
      <div className="grid rounded-[18px] bg-white p-2 shadow-[0_1px_2px_rgba(18,18,17,.06),0_0_0_1px_rgba(18,18,17,.09)] transition-shadow focus-within:shadow-[0_1px_2px_rgba(18,18,17,.06),0_0_0_2px_#121211]">
        <label htmlFor={`${id ?? 'p'}-text`} className="sr-only">Describe your slide</label>
        <textarea id={`${id ?? 'p'}-text`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} autoFocus={autoFocus} rows={3}
          placeholder="Paste your numbers and say what the slide should argue. Revenue grew from £2.1m in 2023 to £5.4m in 2025…"
          className="min-h-[96px] resize-none bg-transparent px-3 pt-2.5 text-[16px] leading-[1.5] text-type outline-none placeholder:text-type-3" />
        <div className="flex items-center justify-between gap-3 pl-1.5">
          <div role="group" aria-label="Writing style" className="flex gap-1">
            {STYLES.map(([v, label]) => (
              <button key={v} type="button" aria-pressed={style === v} onClick={() => setStyle(v)}
                className="h-9 rounded-full px-3.5 text-[13px] text-type-2 transition-colors hover:text-type aria-pressed:bg-paper-2 aria-pressed:text-type">
                {label}
              </button>
            ))}
          </div>
          <button type="submit" disabled={!ready}
            className="h-11 rounded-full bg-type px-5 text-[14px] font-medium text-paper transition-opacity disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-type focus-visible:ring-offset-2">
            Build my slide
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map(([label, st, prompt]) => (
          <button key={label} type="button" onClick={() => { setText(prompt); setStyle(st) }}
            className={cn('h-9 rounded-full border border-rule bg-transparent px-3.5 text-[13px] text-type-2 transition-colors hover:border-type-3 hover:text-type')}>
            {label}
          </button>
        ))}
      </div>
    </form>
  )
}
