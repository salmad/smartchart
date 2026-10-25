/* Doc versions, on the same model as a deck's (src/engine/versions.ts): each block's JSON is a blob stored once under its
   hash, and a version is a tree (the front matter plus the ordered block hashes). Framework-free. */
import { hash } from '../versions.js'
import type { Theme } from '../types.js'
import type { Block, Doc } from './types.js'

export interface DocTree { title: string; subtitle?: string; theme?: Theme; accent?: string; blocks: string[] }

/** A doc as a tree and its blobs (hash → block). */
export function docTree(doc: Doc): { tree: DocTree; blobs: Record<string, Block> } {
  const blobs: Record<string, Block> = {}
  const blocks = doc.blocks.map((b) => {
    const h = hash(JSON.stringify(b))
    blobs[h] = b
    return h
  })
  const tree: DocTree = { title: doc.title, blocks }
  if (doc.subtitle !== undefined) tree.subtitle = doc.subtitle
  return { tree, blobs }
}

/** The doc a tree and its blobs give back; null when a blob is missing. */
export function docFrom(tree: DocTree, blobs: Record<string, Block>): Doc | null {
  const blocks: Block[] = []
  for (const h of tree.blocks) {
    const b = Object.hasOwn(blobs, h) ? blobs[h] : undefined
    if (!b) return null
    blocks.push(structuredClone(b))
  }
  const { blocks: _b, ...front } = tree
  return { ...front, blocks }
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** What changed from `a` to `b`, in a few words ("Edited 2 blocks · added 1 block"); empty when nothing a reader would see. */
export function describeDocDiff(a: DocTree | null, b: DocTree): string {
  if (!a) return ''
  const was = new Map<string, number>(), now = new Map<string, number>()
  for (const h of a.blocks) was.set(h, (was.get(h) ?? 0) + 1)
  for (const h of b.blocks) now.set(h, (now.get(h) ?? 0) + 1)
  let gone = 0, fresh = 0
  for (const [h, n] of was) gone += Math.max(0, n - (now.get(h) ?? 0))
  for (const [h, n] of now) fresh += Math.max(0, n - (was.get(h) ?? 0))
  const edited = Math.min(gone, fresh)
  const parts = [
    a.title !== b.title && 'renamed',
    (a.subtitle ?? '') !== (b.subtitle ?? '') && 'changed the subtitle',
    edited > 0 && `edited ${count(edited, 'block')}`,
    fresh > edited && `added ${count(fresh - edited, 'block')}`,
    gone > edited && `removed ${count(gone - edited, 'block')}`,
    !edited && fresh === gone && a.blocks.join() !== b.blocks.join() && 'reordered blocks',
  ].filter((p): p is string => !!p)
  const text = parts.join(' · ')
  return text ? text[0].toUpperCase() + text.slice(1) : ''
}
