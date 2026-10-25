/* One-time cleanup and save paths: palette does not belong in deck JSON, doc files, or version trees. */
import { parseDoc } from './docs/parse.js'
import { serializeDoc } from './docs/serialize.js'
import type { Doc } from './docs/types.js'
import type { Tree } from './versions.js'
import type { DocTree } from './docs/versions.js'
import { DEFAULT_USER_LOOK } from './look.js'

export function stripDoc(doc: Doc): Doc {
  const { theme: _t, accent: _a, ...body } = doc
  return body
}

/** Doc file text without theme/accent in front matter. */
export function stripDocText(text: string): { text: string; changed: boolean } {
  const { doc } = parseDoc(text)
  const next = serializeDoc(stripDoc(doc))
  return { text: next, changed: next !== text }
}

/** Deck `data` JSON without theme/accent keys. */
export function stripDeckData(data: unknown): { data: unknown; changed: boolean } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { data, changed: false }
  const d = data as Record<string, unknown>
  if (!('theme' in d) && !('accent' in d)) return { data, changed: false }
  const { theme: _t, accent: _a, ...rest } = d
  return { data: rest, changed: true }
}

const FIXED_TREE_LOOK = { theme: DEFAULT_USER_LOOK.theme, accent: DEFAULT_USER_LOOK.accent }

export function stripDeckVersionTree(tree: unknown): { tree: Tree; changed: boolean } {
  const raw = tree && typeof tree === 'object' && !Array.isArray(tree) ? tree as Record<string, unknown> : {}
  const t = raw as Partial<Tree>
  const slides = Array.isArray(t.slides) ? t.slides as Tree['slides'] : []
  const style = t.style === 'pitch' ? 'pitch' : 'consulting'
  const next: Tree = { style, ...FIXED_TREE_LOOK, slides }
  const paletteWrong = t.theme !== next.theme || (t.accent ?? null) !== (next.accent ?? null)
  return { tree: next, changed: paletteWrong }
}

export function stripDocVersionTree(tree: unknown): { tree: DocTree; changed: boolean } {
  const raw = tree && typeof tree === 'object' && !Array.isArray(tree) ? tree as Record<string, unknown> : {}
  const t = raw as Partial<DocTree>
  const blocks = Array.isArray(t.blocks) ? t.blocks.map(String) : []
  const next: DocTree = { title: typeof t.title === 'string' ? t.title : '', blocks }
  if (t.subtitle !== undefined) next.subtitle = t.subtitle
  return { tree: next, changed: 'theme' in raw || 'accent' in raw }
}
