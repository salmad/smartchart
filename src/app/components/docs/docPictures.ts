/* Pictures in the doc editor: upload like the chat or slide edit, then insert an image figure at the cursor. */
import type { Editor } from '@tiptap/core'
import { insertAfter, replaceBlock } from '@/engine/docs/blocks'
import type { Block } from '@/engine/docs/types'
import { uploadPicture } from '@/app/pictures'
import { applyBlocks } from './editor/structure'

export function imageFigure(src: string, alt: string): Block {
  return { type: 'figure', kind: 'image', id: '', body: { caption: '', image: { src, alt }, source: 'Added in the editor.' } }
}

/** After upload, put an image figure at the cursor (or replace an empty paragraph). */
export function insertImageFigure(editor: Editor, originals: readonly Block[], src: string, alt: string): boolean {
  const fig = imageFigure(src, alt)
  return applyBlocks(editor, originals, (list, i) => {
    const key = list[i]?.key
    if (!key) return null
    const cur = list[i].block
    if (cur.type === 'paragraph' && !cur.text.trim()) {
      const next = replaceBlock(list, key, fig)
      const last = next[next.length - 1]?.key === key
      if (last) {
        const r = insertAfter(next, key, { type: 'paragraph', text: '' })
        return { list: r.list, focus: { key, select: true } }
      }
      return { list: next, focus: { key, select: true } }
    }
    const r = insertAfter(list, key, fig)
    const last = r.list[r.list.length - 1]?.key === r.key
    if (last) {
      const p = insertAfter(r.list, r.key, { type: 'paragraph', text: '' })
      return { list: p.list, focus: { key: r.key, select: true } }
    }
    return { list: r.list, focus: { key: r.key, select: true } }
  })
}

const shotName = (name: string) => (/^image\.(png|jpe?g|webp|gif)$/i.test(name) ? 'Screenshot' : name.replace(/\.[^.]+$/, '') || 'Image')

/** Uploads a picture for a doc image figure; throws with a sentence when it cannot. */
export async function uploadDocImage(file: File): Promise<{ src: string; alt: string }> {
  const up = await uploadPicture(file, 'screenshot')
  const v = up.kinds.screenshot ?? up.kinds.photo
  if (!v) throw new Error(up.refused.screenshot ?? up.refused.photo ?? 'That picture cannot be used here.')
  return { src: v.src, alt: shotName(file.name) }
}

export function imageFiles(dt: DataTransfer | null): File[] {
  return Array.from(dt?.files ?? []).filter((f) => f.type.startsWith('image/'))
}
