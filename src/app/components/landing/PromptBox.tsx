import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Style } from '@/engine/types'
import { EXAMPLES } from '@/app/examples'
import { go, setPendingPrompt } from '@/app/route'

/** The site's prompt: what you type opens the editor at /new, which builds the first slide from it. No style to
    pick: a deck starts in Consulting, and an example sets its own style when it fills the box. */
export function PromptBox({ id, autoFocus = false }: { id?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(''), [style, setStyle] = useState<Style>('consulting')
  const ready = text.trim().length > 0

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    // The CTA is never greyed out: pressed with nothing typed, it puts the cursor in the box.
    if (!ready) { document.getElementById(`${id ?? 'p'}-text`)?.focus(); return }
    setPendingPrompt(JSON.stringify({ text: text.trim(), style }))
    go('/new')
  }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }

  return (
    <form id={id} onSubmit={submit} className="grid gap-3">
      <div className="grid rounded-[20px] bg-card p-2 shadow-[0_0_0_1px_rgb(var(--site-type-3)/.35),0_12px_32px_-18px_rgb(var(--site-shadow)/.35)] transition-shadow focus-within:shadow-[0_0_0_2px_rgb(var(--site-type)),0_12px_32px_-18px_rgb(var(--site-shadow)/.35)]">
        <label htmlFor={`${id ?? 'p'}-text`} className="sr-only">Describe your slide</label>
        <textarea id={`${id ?? 'p'}-text`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} autoFocus={autoFocus} rows={2}
          placeholder="Paste your doc or notes…"
          className="min-h-[60px] resize-none bg-transparent px-3 pt-2.5 text-[16px] leading-[1.5] text-type outline-none placeholder:text-type-3" />
        <div className="flex justify-end">
          <button type="submit"
            className="h-11 whitespace-nowrap rounded-full bg-type px-5 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-type focus-visible:ring-offset-2">
            Make slides
          </button>
        </div>
      </div>
      {/* Examples, quiet: text you can click, not buttons that compete with Make slides. */}
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-type-3">
        <span>Try</span>
        {EXAMPLES.map(([label, st, prompt]) => (
          <button key={label} type="button" onClick={() => { setText(prompt); setStyle(st) }}
            className="text-type-2 underline decoration-rule underline-offset-4 transition-colors hover:text-type hover:decoration-type-3">
            {label}
          </button>
        ))}
      </p>
    </form>
  )
}
