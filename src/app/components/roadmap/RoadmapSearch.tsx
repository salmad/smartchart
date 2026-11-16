import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface Props {
  value: string
  onChange: (value: string) => void
}

/** Where a key belongs to something else: a field being typed in, or an open dialog or menu. */
function busyTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]'))
}

/** Find issues by name, at a fixed width so nothing beside it moves as results change. `/` or Cmd/Ctrl+F comes here;
    Esc clears what is typed, and a second Esc leaves the box. */
export function RoadmapSearch({ value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = input.current
      if (!el) return
      const find = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f'
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
      if (!find && !slash) return
      if (e.target !== el && busyTarget(e.target)) return
      e.preventDefault()
      el.focus()
      el.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div role="search" className="relative w-48 flex-none max-[720px]:w-36">
      <Search aria-hidden strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-ink-3" />
      <Input
        ref={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          // Ours, not the issue panel's: it closes on an Escape nobody took.
          e.preventDefault()
          e.stopPropagation()
          if (value) onChange('')
          else e.currentTarget.blur()
        }}
        placeholder="Search"
        aria-label="Search issues by name"
        aria-keyshortcuts="/ Control+F Meta+F"
        spellCheck={false}
        autoComplete="off"
        className="h-7 border-transparent bg-transparent pl-8 pr-7 text-[13px] shadow-none transition-colors placeholder:text-ink-3 hover:bg-panel focus:bg-panel md:text-[13px]"
      />
      {value && (
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label="Clear search"
          onClick={() => { onChange(''); input.current?.focus() }}
          className="absolute right-1 top-1/2 size-5 -translate-y-1/2 [&_svg]:size-3.5"
        >
          <X aria-hidden strokeWidth={1.75} />
        </Button>
      )}
    </div>
  )
}
