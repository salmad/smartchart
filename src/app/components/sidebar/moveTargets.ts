/* Where a page may go, for the Move to… picker: every page of the workspace in tree order with its depth, and the sentence
   that greys it out (inside itself, or deeper than pages nest). Pure, so the picker's rules run under test. */
import { buildTree, canMove, keyOf, type PageRef, type PageSummary } from '@/engine/pages/tree'

export interface MoveTarget { ref: PageRef; name: string; depth: number; reason: string | null }

/** The top level first (null `ref`), then the pages in tree order. A deck with no slides is not offered unless it has pages in it. */
export function moveTargets(pages: PageSummary[], page: PageRef): MoveTarget[] {
  const tree = buildTree(pages), out: MoveTarget[] = []
  const shown = (n: PageSummary): boolean => !(n.kind === 'deck' && n.slides === 0) || tree.children(n).some((c) => shown(c as PageSummary))
  const walk = (list: PageSummary[], depth: number, seen: Set<string>) => {
    for (const n of list) {
      if (seen.has(keyOf(n))) continue
      const next = new Set(seen).add(keyOf(n)), why = canMove(pages, page, n)
      out.push({ ref: { kind: n.kind, id: n.id }, name: n.name, depth, reason: why === 'ok' ? null : why })
      walk(tree.children(n).filter((c) => shown(c as PageSummary)) as PageSummary[], depth + 1, next)
    }
  }
  walk(tree.roots.filter((n) => shown(n as PageSummary)) as PageSummary[], 1, new Set())
  return out
}
