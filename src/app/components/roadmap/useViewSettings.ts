import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_MATRIX, DEFAULT_VIEW, type GroupKey, type MatrixSettings, type ViewSettings } from '@/engine/roadmaps/view'

const storeKey = (id: string) => `roadmap-view:${id}`

/** A view saved before grouping was shared: one `groupBy` object for the list and Gantt, `matrix.rows` and
    `matrix.folded` for the matrix. The matrix's rows win when it had them; they were the deeper grouping. */
interface SavedView extends Omit<Partial<ViewSettings>, 'groupBy' | 'matrix'> {
  groupBy?: GroupKey[] | GroupKey | null
  matrix?: Partial<MatrixSettings> & { rows?: string[]; folded?: string[] }
}

function mergeGroupBy(raw: SavedView): GroupKey[] {
  if (Array.isArray(raw.groupBy)) return raw.groupBy
  const rows = raw.matrix?.rows
  if (rows?.length) return rows.map((field) => ({ on: 'field', field }))
  return raw.groupBy ? [raw.groupBy] : []
}

function mergeView(raw: SavedView): ViewSettings {
  const layout =
    raw.layout === 'gantt' || raw.layout === 'matrix' || raw.layout === 'checks' || raw.layout === 'sprint' ? raw.layout : DEFAULT_VIEW.layout
  const { rows: _rows, folded: oldFolded, ...matrixRaw } = raw.matrix ?? {}
  return {
    ...DEFAULT_VIEW,
    ...raw,
    chips: raw.chips ?? DEFAULT_VIEW.chips,
    search: typeof raw.search === 'string' ? raw.search : '',
    columns: raw.columns?.length ? raw.columns : DEFAULT_VIEW.columns,
    collapsed: raw.collapsed ?? DEFAULT_VIEW.collapsed,
    groupBy: mergeGroupBy(raw),
    folded: raw.folded ?? oldFolded ?? DEFAULT_VIEW.folded,
    sort: raw.sort ?? DEFAULT_VIEW.sort,
    layout,
    scale: raw.scale ?? DEFAULT_VIEW.scale,
    matrix: {
      ...DEFAULT_MATRIX,
      ...matrixRaw,
      cols: matrixRaw.cols ?? DEFAULT_MATRIX.cols,
      pins: matrixRaw.pins ?? DEFAULT_MATRIX.pins,
      expanded: matrixRaw.expanded ?? DEFAULT_MATRIX.expanded,
      foldedCols: matrixRaw.foldedCols ?? DEFAULT_MATRIX.foldedCols,
      show: { ...DEFAULT_MATRIX.show, ...matrixRaw.show },
    },
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
    return mergeView(JSON.parse(json) as SavedView)
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
  try {
    history.replaceState(history.state, '', url.href)
  } catch {
    /* Safari refuses a burst of URL writes (typing a search); the view still applies, and the next write catches up. */
  }
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
