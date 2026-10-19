/* ⌘K in the doc editor: a link over the selected words. Under the selection, an address field; Enter sets it, Esc closes,
   Remove takes an existing link off. The address is checked as the format reads links: http(s) or a #section. */
import { useState, type FormEvent } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'

export interface LinkAt { x: number; y: number; url: string }
interface Props { at: LinkAt; onSet: (url: string | null) => void; onClose: () => void }

const LINK = /^(https?:\/\/[^\s)]+|#[\w-]+)$/
/** "example.com/x" is read as https; anything else must already be an address. */
const address = (s: string) => { const t = s.trim(); return LINK.test(t) ? t : LINK.test(`https://${t}`) && t.includes('.') ? `https://${t}` : null }

export function LinkBox({ at, onSet, onClose }: Props) {
  const [url, setUrl] = useState(at.url), [bad, setBad] = useState(false)
  const place = (m: HTMLElement | null) => { m?.style.setProperty('--x', `${at.x}px`); m?.style.setProperty('--y', `${at.y + 8}px`) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const a = address(url)
    if (!a) { setBad(true); return }
    onSet(a)
  }
  return (
    <form ref={place} onSubmit={submit} data-edit-chrome onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }}
      className="fixed left-[var(--x)] top-[var(--y)] z-30 flex w-[320px] -translate-x-1/2 items-center gap-1.5 rounded-lg bg-raise p-1.5 shadow-[0_0_0_1px_theme(colors.line-2),0_8px_24px_rgba(0,0,0,.18)]">
      <Input autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setBad(false) }} onBlur={onClose} placeholder="Paste a link, or #section"
        aria-label="Link address" aria-invalid={bad} className="h-8 flex-1 border-line-2 bg-app-bg text-[13px] md:text-[13px]" />
      {at.url && <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => onSet(null)}>Remove</Button>}
    </form>
  )
}
