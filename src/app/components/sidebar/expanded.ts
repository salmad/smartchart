/* Which branches of the tree are open, per viewer and workspace, kept in this browser. Storage can be blocked or full; the
   tree then starts collapsed and works the same. */
import { keyOf, type PageRef } from '@/engine/pages/tree'

type Store = Pick<Storage, 'getItem' | 'setItem'>
const storageKey = (viewer: string, workspace: string) => `smartchart.tree.open.v1.${viewer}.${workspace}`

export function loadExpanded(viewer: string, workspace: string, storage?: Store): Set<string> {
  try {
    const v: unknown = JSON.parse((storage ?? localStorage).getItem(storageKey(viewer, workspace)) ?? 'null')
    return new Set(Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [])
  } catch { return new Set() }
}

export function saveExpanded(viewer: string, workspace: string, open: ReadonlySet<string>, storage?: Store): void {
  try { (storage ?? localStorage).setItem(storageKey(viewer, workspace), JSON.stringify([...open])) } catch { /* storage blocked */ }
}

export const withRefs = (open: ReadonlySet<string>, refs: PageRef[]): Set<string> => new Set([...open, ...refs.map(keyOf)])
