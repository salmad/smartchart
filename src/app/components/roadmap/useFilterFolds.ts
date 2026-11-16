import { useCallback, useMemo, useState } from 'react'
import { filtering, type ViewSettings } from '@/engine/roadmaps/view'

type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

/** Under a filter or a search the tree opens to what it found, whatever was folded before; a row folded there stays
    folded only while that same filter is on, and the saved folds come back when it goes. Returns the view the
    issue views draw and the setter they write through. */
export function useFilterFolds(view: ViewSettings, setView: (next: ViewChange) => void): [ViewSettings, (next: ViewChange) => void] {
  const key = filtering(view) ? JSON.stringify([view.chips, view.search ?? '']) : ''
  const [folds, setFolds] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] })
  const ids = useMemo(() => (key && folds.key === key ? folds.ids : []), [folds, key])

  const shown = useMemo(() => (key ? { ...view, collapsed: ids } : view), [ids, key, view])

  const onView = useCallback(
    (next: ViewChange) => {
      if (!key) {
        setView(next)
        return
      }
      setView((prev) => {
        const v = typeof next === 'function' ? next({ ...prev, collapsed: ids }) : next
        if (v.collapsed !== ids) setFolds({ key, ids: v.collapsed })
        return { ...v, collapsed: prev.collapsed }
      })
    },
    [ids, key, setView],
  )

  return [shown, onView]
}
