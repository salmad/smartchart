/* Accent panel: curated swatches, a custom colour and a hex field, shown in the Look menu.
   Swatches show the colour as the slides will draw it on the current palette. */
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { PALETTES, accentOn, resolveAccent } from '@/engine/slides/colours'
import type { Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'

// Curated: distinct hues that stay clear of the palettes' problem red and gain green.
const PRESETS = [['Gold', '#E8B94A'], ['Cobalt', '#2447D1'], ['Sky', '#0EA5E9'], ['Violet', '#7C5CFF'], ['Magenta', '#D946EF'], ['Teal', '#14B8A6']] as const
const HEX = /^#?([0-9a-f]{6})$/i

interface Props { accent: string | null; theme: Theme; onChange: (hex: string | null) => void }
type Look = ReturnType<typeof accentLook>

/** What to draw: the chosen hex, how it is shown on this palette, and why when that differs. */
export function accentLook(accent: string | null, theme: Theme) {
  const pal = PALETTES[theme], chosen = accent || pal.focus, name = theme === 'ink' ? 'Ink' : 'Paper'
  const refused = accent ? resolveAccent(theme, accent).error : undefined
  const drawn = (hex: string) => accentOn(hex, pal.bg), shown = refused ? pal.focus : drawn(chosen)
  // The allocator decides (colour spec C7): a refused accent falls back to the palette's own focus.
  const note = refused ? `${refused} Using the ${name} default instead.`
    : shown !== chosen ? `Drawn as ${shown} on ${name} so it stays legible.` : ''
  return { chosen, shown, drawn, refused: !!refused, note }
}

export const paint = (el: HTMLElement | null, hex: string) => el?.style.setProperty('--sw', hex)

/** The accent section of the Look menu: mounted only while open, so it paints its own swatches. */
export function AccentPanel({ look: l, accent, onChange }: { look: Look; accent: string | null; onChange: Props['onChange'] }) {
  const swatches = useRef<(HTMLButtonElement | null)[]>([])
  const wheel = useRef<HTMLLabelElement>(null), hexDot = useRef<HTMLElement>(null), hex = useRef<HTMLInputElement>(null)
  const custom = !PRESETS.some(([, h]) => h === l.chosen)

  useLayoutEffect(() => {
    PRESETS.forEach(([, h], i) => paint(swatches.current[i], l.drawn(h)))
    paint(wheel.current, l.shown); paint(hexDot.current, l.shown)
    // While the field is being typed in it is not overwritten.
    if (hex.current && document.activeElement !== hex.current) hex.current.value = l.chosen
  }, [l])

  const commit = () => {
    const input = hex.current
    if (!input) return
    const m = input.value.trim().match(HEX)
    input.value = m ? `#${m[1].toUpperCase()}` : l.chosen
    if (m) onChange(`#${m[1].toUpperCase()}`)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  return (
    <>
      <div className="flex h-4 items-center justify-between font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] text-ink-3">
        <span>Accent</span>
        {accent && <button type="button" onClick={() => onChange(null)}
          className="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-medium normal-case leading-none tracking-normal text-ink-2 hover:text-ink">Palette default</button>}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {PRESETS.map(([name, h], i) => (
          <button key={h} type="button" ref={(el) => { swatches.current[i] = el }} aria-label={name} title={name} aria-pressed={h === l.chosen}
            onClick={() => onChange(h)}
            className={cn('aspect-square cursor-pointer rounded-full border-0 bg-[var(--sw)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)] transition-[transform,box-shadow] duration-[120ms] hover:scale-110',
              'focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_theme(colors.raise),0_0_0_3px_theme(colors.ink-3)]',
              h === l.chosen && 'shadow-[0_0_0_2px_theme(colors.raise),0_0_0_4px_theme(colors.ink)] focus-visible:shadow-[0_0_0_2px_theme(colors.raise),0_0_0_4px_theme(colors.ink)]')} />
        ))}
        <label ref={wheel} title="Custom colour"
          className={cn('sw-wheel relative aspect-square cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)] transition-[transform,box-shadow] duration-[120ms] hover:scale-110',
            'focus-within:shadow-[0_0_0_2px_theme(colors.raise),0_0_0_3px_theme(colors.ink-3)]',
            custom && 'on shadow-[0_0_0_2px_theme(colors.raise),0_0_0_4px_theme(colors.ink)] focus-within:shadow-[0_0_0_2px_theme(colors.raise),0_0_0_4px_theme(colors.ink)]')}>
          <input type="color" aria-label="Custom colour" value={l.chosen.toLowerCase()} onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer border-0 p-0 opacity-0" />
        </label>
      </div>
      <label className="flex h-[34px] items-center gap-2.5 rounded-[9px] border border-line bg-panel px-2.5 transition-colors focus-within:border-line-2">
        <i ref={hexDot} className="size-3 flex-none rounded-full bg-[var(--sw)] shadow-[0_0_0_1px_rgba(255,255,255,.14)]" />
        <input ref={hex} defaultValue={l.chosen} spellCheck={false} maxLength={7} aria-label="Hex colour" onKeyDown={onKey} onBlur={commit}
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[12.5px] font-medium uppercase leading-none tracking-[.04em] text-ink outline-none" />
      </label>
      {l.note && <p className={cn('text-xs leading-[1.45]', l.refused ? 'text-warn' : 'text-ink-3')}>{l.note}</p>}
    </>
  )
}
