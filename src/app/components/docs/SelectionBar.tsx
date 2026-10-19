/* The bar over selected words: Bold, Focus and a link. It sits above the selection (below it near the top of the
   page), in the page's own colours, and never takes the selection from the editor. ⌘B, ⌘⇧H and ⌘K do the same. */
import { useEffect, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { Bold, Highlighter, Link2 } from 'lucide-react'
import type { Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { LinkBox, type LinkAt } from './LinkBox'
import { surface, tint, tintOnHover } from './chrome'

interface Props { editor: Editor; frame: HTMLElement; theme: Theme }
interface Spot { x: number; y: number; below: boolean }

const btn = 'grid size-8 place-items-center rounded-md text-[var(--fg-2)]'

export function SelectionBar({ editor, frame, theme }: Props) {
  const [spot, setSpot] = useState<Spot | null>(null), [link, setLink] = useState<LinkAt | null>(null), [, bump] = useState(0)
  const openLink = () => {
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const end = editor.view.coordsAtPos(to), start = editor.view.coordsAtPos(from)
    setLink({ x: (start.left + end.left) / 2, y: end.bottom, url: (editor.getAttributes('link').href as string | undefined) ?? '' })
  }
  useEffect(() => {
    const update = () => {
      bump((n) => n + 1)
      const sel = editor.state.selection
      if (sel.empty || !editor.isFocused || !sel.$from.parent.isTextblock || sel.$from.parent !== sel.$to.parent) { setSpot(null); return }
      const a = editor.view.coordsAtPos(sel.from), b = editor.view.coordsAtPos(sel.to), f = frame.getBoundingClientRect(), top = Math.min(a.top, b.top), below = top - f.top < 64
      setSpot({ x: (a.left + b.left) / 2 - f.left, y: (below ? Math.max(a.bottom, b.bottom) + 8 : top - 8) - f.top, below })
    }
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && editor.isFocused) { e.preventDefault(); openLink() } }
    editor.on('selectionUpdate', update); editor.on('focus', update); editor.on('blur', update); editor.on('transaction', update)
    document.addEventListener('keydown', key)
    return () => { editor.off('selectionUpdate', update); editor.off('focus', update); editor.off('blur', update); editor.off('transaction', update); document.removeEventListener('keydown', key) }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openLink reads the editor only
  }, [editor, frame])

  const putLink = (url: string | null) => {
    const chain = editor.chain().focus().extendMarkRange('link')
    if (url) chain.setLink({ href: url }).run(); else chain.unsetLink().run()
    setLink(null)
  }
  const on = (m: string) => editor.isActive(m)
  const button = (name: string, label: string, shortcut: string, onClick: () => void, icon: ReactNode) => (
    <button type="button" aria-label={label} aria-pressed={on(name)} title={`${label} (${shortcut})`} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={cn(btn, on(name) ? tint : tintOnHover)}>{icon}</button>
  )
  return (
    <>
      {spot && !link && (
        <div ref={(m) => { m?.style.setProperty('--x', `${spot.x}px`); m?.style.setProperty('--y', `${spot.y}px`) }} data-edit-chrome role="toolbar" aria-label="Format"
          className={cn(`theme-${theme} absolute left-[var(--x)] top-[var(--y)] z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-[10px] p-1`, spot.below ? '' : '-translate-y-full', surface)}>
          {button('bold', 'Bold', '⌘B', () => editor.chain().focus().toggleBold().run(), <Bold className="size-4" strokeWidth={2} />)}
          {button('focus', 'Focus colour', '⌘⇧H', () => editor.chain().focus().toggleMark('focus').run(), <Highlighter className="size-4 text-[var(--focus)]" strokeWidth={1.75} />)}
          {button('link', 'Link', '⌘K', openLink, <Link2 className="size-4" strokeWidth={1.75} />)}
        </div>
      )}
      {link && <LinkBox at={link} onSet={putLink} onClose={() => { setLink(null); editor.commands.focus() }} />}
    </>
  )
}
