// src/app/edit/IconPicker.tsx
/* Over each icon on an icon-lead card while editing: click it to choose another icon from the curated set, or ask the
   model to pick one from the card's own text. The icon changes on the slide at once; Save keeps it. */
import { useRef, useState } from 'react'
import { icons } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { jev } from '@/engine/agent/llm'
import { ICONS } from '@/engine/slides/schema'
import type { Style } from '@/engine/types'
import { pickIcon } from './icon'
import type { SlideEdit } from './useSlideEdit'

export const glyph = (name: string) => icons[name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') as keyof typeof icons]

function Glyph({ name }: { name: string }) {
  const Icon = glyph(name)
  return Icon ? <Icon className="size-4" strokeWidth={1.5} /> : null
}

function One({ edit, path, index, deckStyle, box }: { edit: SlideEdit; path: string; index: number; deckStyle: Style; box: DOMRect }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const frame = useRef<HTMLSpanElement>(null)
  const parent = frame.current?.parentElement?.getBoundingClientRect()
  const current = (edit.draft.cards?.[index]?.icon) ?? ''
  const set = (name: string) => { edit.patch({ [`${path}.icon`]: name }); setOpen(false) }
  const ask = async () => {
    setBusy(true); setError(null)
    try { set(await pickIcon(edit.draft, index, deckStyle, jev)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  const place = (m: HTMLElement | null) => {
    if (!m || !parent) return
    for (const [k, v] of Object.entries({ l: box.left - parent.left, t: box.top - parent.top, w: Math.min(box.width, box.height), h: box.height })) m.style.setProperty(`--${k}`, `${v}px`)
  }
  return (
    <span ref={frame}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button ref={place} type="button" aria-label="Change icon" onMouseDown={(e) => e.preventDefault()}
            className="pointer-events-auto absolute left-[var(--l)] top-[var(--t)] h-[var(--h)] w-[var(--w)] cursor-pointer rounded-md hover:ring-1 hover:ring-[rgb(var(--mark)/.45)]" />
        </PopoverTrigger>
        <PopoverContent className="w-[19rem] p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Button size="sm" variant="outline" className="mb-2 w-full gap-1.5" disabled={busy} onClick={() => void ask()}>
            <Sparkles className="size-3.5" /> {busy ? 'Choosing…' : 'Pick from the card text'}
          </Button>
          {error && <p role="alert" className="mb-2 text-[12px] text-warn">{error}</p>}
          <div role="listbox" aria-label="Icons" className="grid grid-cols-8 gap-1">
            {ICONS.map((name) => (
              <button key={name} type="button" role="option" aria-selected={name === current} aria-label={name.replace(/-/g, ' ')} onClick={() => set(name)}
                className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-line hover:text-ink aria-selected:bg-line aria-selected:text-ink"><Glyph name={name} /></button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  )
}

export function IconPicker({ edit, slide, deckStyle }: { edit: SlideEdit; slide: HTMLElement | null; deckStyle: Style }) {
  const host = useRef<HTMLDivElement>(null)
  const items = slide ? [...slide.querySelectorAll<HTMLElement>('[data-item^="cards["] > .ic')] : []
  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {host.current && items.map((ic) => {
        const path = ic.parentElement?.dataset.item ?? '', index = Number(/\[(\d+)\]$/.exec(path)?.[1])
        return <One key={path} edit={edit} path={path} index={index} deckStyle={deckStyle} box={ic.getBoundingClientRect()} />
      })}
    </div>
  )
}
