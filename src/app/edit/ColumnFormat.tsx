// src/app/edit/ColumnFormat.tsx
/* A small chip on each table column header while editing: bold, italic, and quiet / normal / focus for the whole
   column. The three are separate choices (spec 3). Focus is one column at a time, so choosing it frees the others. */
import { useRef } from 'react'
import { Bold, Italic, Type } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import type { Slide } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

type Tone = 'normal' | 'muted' | 'focus'
const TONES: Tone[] = ['normal', 'muted', 'focus']

/** The patch for one column's tone: muted and focus are exclusive, and only one column is focus. */
export function tonePatch(slide: Slide, j: number, tone: Tone): Record<string, unknown> {
  const set: Record<string, unknown> = { [`table.columns[${j}].muted`]: tone === 'muted' ? true : null, [`table.columns[${j}].focus`]: tone === 'focus' ? true : null }
  if (tone === 'focus') (slide.table?.columns ?? []).forEach((c, k) => { if (k !== j && c.focus) set[`table.columns[${k}].focus`] = null })
  return set
}

function One({ edit, index, box }: { edit: SlideEdit; index: number; box: DOMRect }) {
  const frame = useRef<HTMLSpanElement>(null)
  const col = edit.draft.table?.columns?.[index], tone: Tone = col?.focus ? 'focus' : col?.muted ? 'muted' : 'normal'
  const place = (m: HTMLElement | null) => {
    const parent = frame.current?.parentElement?.getBoundingClientRect()
    if (!m || !parent) return
    for (const [k, v] of Object.entries({ l: box.right - parent.left - 22, t: box.top - parent.top + (box.height - 22) / 2 })) m.style.setProperty(`--${k}`, `${v}px`)
  }
  const flip = (key: 'bold' | 'italic') => edit.patch({ [`table.columns[${index}].${key}`]: col?.[key] ? null : true })
  const toggle = (key: 'bold' | 'italic', label: string, Icon: typeof Bold) => (
    <button type="button" aria-label={label} aria-pressed={!!col?.[key]} onClick={() => flip(key)}
      className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-line aria-pressed:bg-line aria-pressed:text-ink"><Icon className="size-4" /></button>)
  return (
    <span ref={frame}>
      <Popover>
        <PopoverTrigger asChild>
          <button ref={place} type="button" aria-label={`Format column ${index + 1}`} onMouseDown={(e) => e.preventDefault()}
            className="pointer-events-auto absolute left-[var(--l)] top-[var(--t)] grid size-[22px] place-items-center rounded-md bg-raise/90 text-ink-3 shadow-[0_0_0_1px_theme(colors.line-2)] hover:text-ink">
            <Type className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">{toggle('bold', 'Bold column', Bold)}{toggle('italic', 'Italic column', Italic)}</div>
            <span aria-hidden className="h-5 w-px bg-line-2" />
            <div role="radiogroup" aria-label="Column tone" className="flex gap-0.5">
              {TONES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tone === t} onClick={() => edit.patch(tonePatch(edit.draft, index, t))}
                  className="h-8 rounded-md px-2.5 text-[13px] capitalize text-ink-2 hover:bg-line aria-checked:bg-line aria-checked:text-ink">{t}</button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  )
}

export function ColumnFormat({ edit, slide }: { edit: SlideEdit; slide: HTMLElement | null }) {
  const host = useRef<HTMLDivElement>(null)
  const heads = slide ? [...slide.querySelectorAll<HTMLElement>('th[data-path^="table.columns["]')] : []
  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {host.current && heads.map((th) => {
        const index = Number(/\[(\d+)\]/.exec(th.dataset.path ?? '')?.[1])
        return <One key={index} edit={edit} index={index} box={th.getBoundingClientRect()} />
      })}
    </div>
  )
}
