/* The workspace open in the app: the most recently used one, until the maker picks another (which then becomes the
   most recently used, for the next visit and for agents). `ready` answers once the list has loaded. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { currentWorkspace, type Workspace, type WorkspaceRepo } from '@/app/workspaces'
import { showThenFetch } from '@/app/swr'

const isWorkspaces = (v: unknown): v is Workspace[] => Array.isArray(v) && v.every((w) => !!w && typeof (w as Workspace).id === 'string' && typeof (w as Workspace).name === 'string')

export interface WorkspaceState {
  /** Null while loading; empty if it failed. */
  list: Workspace[] | null
  current: Workspace | null
  ready: Promise<Workspace | null>
  switchTo(id: string): void
  /** Reads the list again (after a rename, a new workspace, an accepted invite), keeping the open one. */
  reload(open?: string): Promise<void>
}

/** With `account`, the list stored in this browser shows first (and lets boot go on) while the server's answer is on its way. */
export function useWorkspace(repo: WorkspaceRepo, onChange: (w: Workspace | null) => void, account?: string): WorkspaceState {
  const [list, setList] = useState<Workspace[] | null>(null), [picked, setPicked] = useState<string | null>(null)
  // Answered by the first load; made once, so boot can wait on it before the list is in.
  const [first] = useState(() => { let done: (w: Workspace | null) => void = () => undefined; const promise = new Promise<Workspace | null>((r) => { done = r }); return { promise, done } })
  useEffect(() => {
    let live = true
    if (account) {
      void showThenFetch(account, 'workspaces', () => repo.list(), isWorkspaces, (l) => { if (live) setList(l); first.done(currentWorkspace(l, null)) })
        .then((ok) => { if (!ok && live) { setList((l) => l ?? []); first.done(null) } })
    } else {
      repo.list().then((l) => { if (live) setList(l); first.done(currentWorkspace(l, null)) }, () => { if (live) setList([]); first.done(null) })
    }
    return () => { live = false }
  }, [repo, first, account])
  const current = list ? currentWorkspace(list, picked) : null
  const changed = useRef(onChange)
  changed.current = onChange
  useEffect(() => { changed.current(current) }, [current?.id, current?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchTo = useCallback((id: string) => {
    setPicked(id)
    void repo.use(id).catch(() => undefined)
  }, [repo])
  const reload = useCallback(async (open?: string) => {
    const l = await repo.list().catch(() => null)
    if (l) setList(l)
    if (open) setPicked(open)
  }, [repo])
  return { list, current, ready: first.promise, switchTo, reload }
}
