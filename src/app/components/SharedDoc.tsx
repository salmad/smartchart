/* A doc shared by link: the read view only, for anyone with the link. */
import '@/engine/docs/doc.css'
import { useEffect, useRef } from 'react'
import { parseDoc } from '@/engine/docs/parse'
import { loadFaces, mountDoc } from '@/engine/docs/mount'
import { DEFAULT_USER_LOOK } from '@/engine/look'
import type { SharedDoc } from '@/app/share'

interface Props { shared: SharedDoc; /** After figures are drawn, so export can snapshot the page. */ onReady?: (root: HTMLDivElement) => void }

export function SharedDocView({ shared, onReady }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const doc = parseDoc(shared.text).doc
  useEffect(() => {
    let go = true, mounted: { destroy(): void } | null = null
    const drawn = { ...doc, theme: doc.theme ?? DEFAULT_USER_LOOK.theme, accent: doc.accent ?? DEFAULT_USER_LOOK.accent ?? undefined }
    void loadFaces().then(() => {
      if (go && page.current) {
        mounted = mountDoc(page.current, drawn, 'shared')
        onReady?.(page.current)
      }
    })
    return () => { go = false; mounted?.destroy() }
  }, [shared.text]) // eslint-disable-line react-hooks/exhaustive-deps -- doc parsed from text

  return <div ref={page} data-doc-print-root className="min-h-0 flex-1 overflow-y-auto bg-app-bg" />
}
