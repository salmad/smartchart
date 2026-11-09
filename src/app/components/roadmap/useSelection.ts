import { useCallback, useRef, useState } from 'react'

export function useSelection(order: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const anchor = useRef<string | null>(null)

  const toggle = useCallback((id: string, extend: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (extend && anchor.current) {
        const a = order.indexOf(anchor.current)
        const b = order.indexOf(id)
        if (a >= 0 && b >= 0) {
          const lo = Math.min(a, b)
          const hi = Math.max(a, b)
          for (let i = lo; i <= hi; i++) next.add(order[i])
          return next
        }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      anchor.current = id
      return next
    })
  }, [order])

  const pick = useCallback((id: string, extend: boolean) => {
    if (extend) toggle(id, true)
    else {
      anchor.current = id
      setSelected(new Set([id]))
    }
  }, [toggle])

  const selectAll = useCallback(() => {
    setSelected(new Set(order))
  }, [order])

  const clear = useCallback(() => {
    setSelected(new Set())
    anchor.current = null
  }, [])

  return { selected, toggle, pick, selectAll, clear }
}
