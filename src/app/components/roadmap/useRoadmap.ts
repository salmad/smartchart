import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { POLL_MS, roadmapStore, type RoadmapView } from '@/app/roadmap-store'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { RoadmapOp } from '@/engine/roadmaps/ops'

export function useRoadmap(repo: RoadmapRepo, id: string, by: string) {
  const store = useMemo(() => roadmapStore(repo, id, { by, now: () => Date.now() }), [repo, id, by])
  const view = useSyncExternalStore(store.subscribe, store.get, store.get)
  useEffect(() => {
    void store.open()
    const onVis = () => { if (document.visibilityState === 'visible') void store.poll() }
    document.addEventListener('visibilitychange', onVis)
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible') void store.poll() }, POLL_MS)
    return () => { store.close(); window.clearInterval(tick); document.removeEventListener('visibilitychange', onVis) }
  }, [store])
  return {
    view,
    act: (op: RoadmapOp) => store.act(op),
    poll: () => store.poll(),
  }
}

export type { RoadmapView }
