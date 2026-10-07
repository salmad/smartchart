/* Pictures in edit mode: replace the one under the pointer, or pick one first when adding an item that carries a
   picture (a logo, a person's photo). The picture goes through /api/images like a dropped one; the slide takes its src. */
import { useEffect, useRef, useState } from 'react'
import { ImageUp, Loader2 } from 'lucide-react'
import { imageMeta } from '@/engine/slides/images'
import { getAt, newItem, type ListOp } from '@/engine/slides/edit'
import type { Style } from '@/engine/types'
import { pickPicture } from '@/app/pictures'
import type { SlideEdit } from './useSlideEdit'

type State = { state: 'idle' } | { state: 'busy' } | { state: 'failed'; why: string }

/** Picking and uploading, with one state for the buttons that start it. */
export function usePictures(edit: SlideEdit, style: Style) {
  const [state, setState] = useState<State>({ state: 'idle' })
  const run = async (kind: Parameters<typeof pickPicture>[0], then: (src: string) => void) => {
    setState({ state: 'busy' })
    try { const src = await pickPicture(kind); if (src) then(src); setState({ state: 'idle' }) }
    catch (e) { setState({ state: 'failed', why: e instanceof Error ? e.message : String(e) }) }
  }
  return {
    state, dismiss: () => setState({ state: 'idle' }),
    /** A new item after `index`, with the picture picked first. */
    add: (op: ListOp, index: number) => { const p = op.picture; if (!p) return
      void run(p.kind, (src) => { const set = newItem(edit.draft, style, op, index + 1), list = set[op.path] as Record<string, unknown>[]
        list[index + 1] = { ...list[index + 1], [p.field]: { src } }; edit.patch(set, `${op.path}[${index + 1}]`) }) },
    /** The picture at `path`, replaced by one of the same kind; its alt text stays. */
    replace: (path: string) => { const cur = getAt(edit.draft, path) as { src?: string; alt?: string } | undefined, kind = imageMeta(cur?.src)?.kind ?? 'photo'
      void run(kind, (src) => edit.patch({ [path]: { ...cur, src } })) },
  }
}

/** A "Replace" button over the picture under the pointer, and what went wrong, if anything. */
export function PictureButtons({ slide, pictures }: { slide: HTMLElement | null; pictures: ReturnType<typeof usePictures> }) {
  const [hover, setHover] = useState<HTMLElement | null>(null), host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!slide) return
    const move = (e: PointerEvent) => { const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-pic]') : null; if (el) setHover(el) }
    const leave = () => setHover(null)
    slide.addEventListener('pointermove', move); slide.parentElement?.parentElement?.addEventListener('pointerleave', leave)
    return () => { slide.removeEventListener('pointermove', move); slide.parentElement?.parentElement?.removeEventListener('pointerleave', leave) }
  }, [slide])
  useEffect(() => {
    const el = host.current?.querySelector<HTMLElement>('[data-replace]'), frame = host.current?.parentElement
    if (!el || !hover || !frame) return
    const a = hover.getBoundingClientRect(), b = frame.getBoundingClientRect()
    el.style.setProperty('--l', `${a.right - b.left - 8}px`); el.style.setProperty('--t', `${a.top - b.top + 8}px`)
  })
  const { state } = pictures
  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {hover?.isConnected && (
        <button type="button" data-replace onMouseDown={(e) => e.preventDefault()} onClick={() => pictures.replace(hover.dataset.pic ?? '')} disabled={state.state === 'busy'}
          className="pointer-events-auto absolute left-[var(--l)] top-[var(--t)] flex h-7 -translate-x-full items-center gap-1.5 rounded-full bg-raise px-2.5 text-[12px] text-ink shadow-[0_0_0_1px_theme(colors.line-2)] hover:bg-panel">
          {state.state === 'busy' ? <Loader2 className="size-3.5 animate-spin" /> : <ImageUp className="size-3.5" />}Replace picture
        </button>
      )}
      {state.state === 'failed' && (
        <p role="alert" className="pointer-events-auto absolute bottom-3 left-1/2 flex max-w-[80%] -translate-x-1/2 items-center gap-3 rounded-lg bg-raise px-3 py-2 text-[12.5px] text-ink-2 shadow-[0_0_0_1px_theme(colors.line-2)]">
          {state.why}<button type="button" onClick={pictures.dismiss} className="text-ink-3 hover:text-ink">Dismiss</button>
        </p>
      )}
    </div>
  )
}
