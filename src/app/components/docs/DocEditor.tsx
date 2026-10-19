/* The doc in edit mode: the page is the editor itself (Tiptap), drawn with the read view's structure and CSS, with the
   chrome around it: the slash menu, the block handle, the selection bar and the link box. The figure open in place is
   drawn by React into its slot, inside the figure's own node. */
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent } from '@tiptap/react'
import type { Theme } from '@/engine/types'
import { findFigure } from './editor/figure'
import { BlockHandle } from './BlockHandle'
import { FigureEdit } from './FigureEdit'
import { SelectionBar } from './SelectionBar'
import { SlashMenu } from './SlashMenu'
import { useSlash } from './useSlash'
import type { DocEdit } from './useDocEdit'
import './docs-edit.css'

interface Props { edit: DocEdit; theme: Theme; accent: string | undefined }

export function DocEditor({ edit, theme, accent }: Props) {
  const frameRef = useRef<HTMLElement | null>(null)
  const { editor } = edit
  const [frame, setFrame] = useState<HTMLElement | null>(null), page = frame?.querySelector<HTMLElement>('.ProseMirror') ?? null
  const slash = useSlash(edit, useCallback(() => frameRef.current, []))
  const open = editor && edit.figure ? findFigure(editor, edit.figure) : null
  return (
    <div ref={(el) => { frameRef.current = el; setFrame(el) }} className={`relative theme-${theme}`}>
      <article className={`doc theme-${theme} doc-editing`} data-links>
        <EditorContent editor={editor} className="contents" />
      </article>
      {editor && page && frame && <BlockHandle edit={edit} page={page} frame={frame} theme={theme} />}
      {editor && frame && <SelectionBar editor={editor} frame={frame} theme={theme} />}
      {slash.slash && <SlashMenu x={slash.slash.x} y={slash.slash.y} above={slash.slash.above} choices={slash.slash.choices} active={slash.slash.active} onPick={slash.choose} onHover={slash.hover} />}
      {edit.slot && open?.block.type === 'figure' && edit.figure && createPortal(<FigureEdit key={edit.figure} doc={edit} at={edit.figure} block={open.block} theme={theme} accent={accent} />, edit.slot)}
    </div>
  )
}
