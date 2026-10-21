/* The editor is a chunk of its own, fetched when the entry has run. For a browser that has signed in before, index.html
   fetches it, and what it imports, alongside the entry instead: one round trip less on a visit whose cache is empty (the
   first after a deploy). The list is written into the inline script, in place of its empty `editor-chunks` list, and used only there; a visitor
   with no stored account never fetches it. Chunk names are hashed, so they are read from the build, not written down. */
import type { Plugin } from 'vite'

interface Chunk { type: 'chunk'; fileName: string; imports: string[]; moduleIds: string[] }
type Item = Chunk | { type: 'asset' }

/** `from` and everything it imports statically, minus what `skip` already holds. */
export function staticClosure(from: Chunk, byName: Map<string, Chunk>, skip: Set<string>): string[] {
  const out: string[] = [], seen = new Set<string>()
  const walk = (c: Chunk) => {
    if (seen.has(c.fileName)) return
    seen.add(c.fileName)
    if (!skip.has(c.fileName)) out.push(c.fileName)
    for (const name of c.imports) { const next = byName.get(name); if (next) walk(next) }
  }
  walk(from)
  return out
}

export function preloadEditor(): Plugin {
  return {
    name: 'preload-editor',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const items = Object.values(ctx.bundle ?? {}) as Item[]
        const chunks = items.filter((c): c is Chunk => c.type === 'chunk')
        const byName = new Map(chunks.map((c) => [c.fileName, c]))
        const editor = chunks.find((c) => c.moduleIds.some((id) => id.replace(/\\/g, '/').endsWith('/src/app/App.tsx')))
        const entry = ctx.chunk ? byName.get(ctx.chunk.fileName) : undefined
        if (!editor || !entry) return html
        // What the entry loads anyway (Vite preloads its static imports) needs no second request.
        const have = new Set(staticClosure(entry, byName, new Set()))
        const files = staticClosure(editor, byName, have).map((f) => `/${f}`)
        return html.replace('/*editor-chunks*/[]', `/*editor-chunks*/${JSON.stringify(files)}`)
      },
    },
  }
}
