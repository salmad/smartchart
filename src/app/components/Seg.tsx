import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/** A view switch's track in a bar: its options take their own width (the default track shares the width out).
    A track is a filled step with no outline, and the chosen option a lighter pill on it: one edge to read, not three. */
export const SEG_TRACK = 'flex rounded-[9px] bg-line p-[3px]'

/** The pill under the chosen one of several: a single element that slides and resizes to it, so a change reads as a
    move. Put the returned ref on the options' positioned parent and PILL on an element inside it. The place is
    measured (labels differ in width, and step back to icons in a narrow bar) and handed to CSS as --pill-x and
    --pill-w. `chosen` selects the option that is on; `at` is whatever changes when the choice does. */
export function usePill<E extends HTMLElement>(chosen: string, at: unknown) {
  const track = useRef<E | null>(null)
  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const place = () => {
      const on = el.querySelector<HTMLElement>(chosen)
      el.style.setProperty('--pill-x', `${on?.offsetLeft ?? 0}px`)
      el.style.setProperty('--pill-w', `${on?.offsetWidth ?? 0}px`)
    }
    place()
    const seen = new ResizeObserver(place)
    seen.observe(el)
    return () => seen.disconnect()
  }, [chosen, at])
  return track
}

/** The pill's place and motion; callers add its colour, radius and vertical inset. */
export const PILL = 'pointer-events-none absolute left-0 w-[var(--pill-w)] translate-x-[var(--pill-x)] transition-[transform,width] duration-200 ease-out-strong motion-reduce:transition-none'

/** One of a few, side by side (a view, a palette, a scale): every option is always in sight. */
export function Seg<T extends string>({ label, value, options, disabled, onChange, className }: { label: string; value: T; options: [T, ReactNode][]; disabled?: boolean; onChange: (v: T) => void; className?: string }) {
  const track = usePill<HTMLDivElement>('[aria-pressed="true"]', `${value}/${options.length}`)
  return (
    <div ref={track} role="group" aria-label={label} className={cn('relative', className ?? 'grid auto-cols-fr grid-flow-col rounded-[9px] bg-line p-[3px]')}>
      <i aria-hidden className={cn(PILL, 'bottom-[3px] top-[3px] rounded-md bg-line-2')} />
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} disabled={disabled} onClick={() => onChange(v)}
          className="relative cursor-pointer rounded-md px-3 py-[5px] text-[13px] text-ink-2 outline-none transition-[color,transform] duration-150 ease-out-strong hover:text-ink focus-visible:ring-1 focus-visible:ring-ring active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 aria-pressed:text-ink motion-reduce:transition-none">
          {text}
        </button>
      ))}
    </div>
  )
}
