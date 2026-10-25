/* A doc shared by link: the read view only, for anyone with the link. */
import '@/engine/docs/doc.css'
import { useEffect, useRef } from 'react'
import { parseDoc } from '@/engine/docs/parse'
import { loadFaces, mountDoc } from '@/engine/docs/mount'
import { DEFAULT_USER_LOOK } from '@/engine/look'
import type { SharedDoc } from '@/app/share'

export function SharedDocView({ shared }: { shared: SharedDoc }) {
  const page = useRef<HTMLDivElement>(null)
  const doc = parseDoc(shared.text).doc
  useEffect(() => {
    let go = true, mounted: { destroy(): void } | null = null
    const drawn = { ...doc, theme: DEFAULT_USER_LOOK.theme }
    void loadFaces().then(() => {
      if (go && page.current) mounted = mountDoc(page.current, drawn, 'shared')
    })
    return () => { go = false; mounted?.destroy() }
  }, [shared.text]) // eslint-disable-line react-hooks/exhaustive-deps -- doc parsed from text

  return <div ref={page} className="min-h-0 flex-1 overflow-y-auto bg-app-bg" />
}
