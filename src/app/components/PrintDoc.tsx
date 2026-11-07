/* Download PDF: the doc through the browser print dialog. Chrome around the article is hidden in print CSS. */
import { useEffect, useRef } from 'react'

export function PrintDoc({ name, onDone }: { name: string; onDone: () => void }) {
  const latest = useRef({ name, onDone })
  latest.current = { name, onDone }
  useEffect(() => {
    let live = true
    const title = document.title
    document.body.dataset.printingDoc = '1'
    const done = () => {
      delete document.body.dataset.printingDoc
      window.removeEventListener('afterprint', done)
      document.title = title
      if (live) latest.current.onDone()
    }
    void document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!live) return
      document.title = latest.current.name
      window.addEventListener('afterprint', done)
      window.print()
    })))
    return () => {
      live = false
      delete document.body.dataset.printingDoc
      window.removeEventListener('afterprint', done)
      document.title = title
    }
  }, [])
  return null
}
