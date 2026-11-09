import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_VIEW, type ViewSettings } from '@/engine/roadmaps/view'

const storeKey = (id: string) => `roadmap-view:${id}`

function mergeView(raw: Partial<ViewSettings>): ViewSettings {
  return {
    ...DEFAULT_VIEW,
    ...raw,
    chips: raw.chips ?? DEFAULT_VIEW.chips,
    columns: raw.columns?.length ? raw.columns : DEFAULT_VIEW.columns,
    collapsed: raw.collapsed ?? DEFAULT_VIEW.collapsed,
    groupBy: raw.groupBy ?? null,
    sort: raw.sort ?? DEFAULT_VIEW.sort,
  }
}

export function encodeView(v: ViewSettings): string {
  const json = JSON.stringify(v)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeView(raw: string | null): ViewSettings | null {
  if (!raw) return null
  try {
    let b64 = raw.replace(/-/g, '+').replace(/\//g, '_')
    while (b64.length % 4) b64 += '='
    const json = decodeURIComponent(escape(atob(b64)))
    return mergeView(JSON.parse(json) as Partial<ViewSettings>)
  } catch {
    return null
  }
}

function readView(roadmapId: string): ViewSettings {
  const fromUrl = decodeView(new URL(location.href).searchParams.get('v'))
  if (fromUrl) return fromUrl
  try {
    return decodeView(localStorage.getItem(storeKey(roadmapId))) ?? DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

function persist(roadmapId: string, v: ViewSettings) {
  try {
    localStorage.setItem(storeKey(roadmapId), encodeView(v))
  } catch {
    /* storage blocked */
  }
  const url = new URL(location.href)
  url.searchParams.set('v', encodeView(v))
  history.replaceState(history.state, '', url.href)
  notify()
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', notify)
}

/** Filter, sort, grouping and collapse for one roadmap; URL `?v=` first, then localStorage. */
export function useViewSettings(roadmapId: string): [ViewSettings, (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void] {
  const [view, setLocal] = useState(() => readView(roadmapId))

  useEffect(() => {
    const sync = () => setLocal(readView(roadmapId))
    sync()
    listeners.add(sync)
    return () => { listeners.delete(sync) }
  }, [roadmapId])

  const setView = useCallback(
    (next: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => {
      const v = typeof next === 'function' ? next(readView(roadmapId)) : next
      persist(roadmapId, v)
      setLocal(v)
    },
    [roadmapId],
  )

  return [view, setView]
}
