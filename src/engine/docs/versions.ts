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
  if (doc.theme) tree.theme = doc.theme
  if (doc.accent) tree.accent = doc.accent
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
