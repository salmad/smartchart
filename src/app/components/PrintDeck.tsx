/* Download PDF: the deck through the browser's own print engine, one slide per page, text kept as text.
   Mounted for one print, then gone; the deck's name becomes the file's. */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { contexts } from '@/engine/slides/render'
import type { Deck } from '@/engine/types'
import { SlideView } from './SlideView'

export function PrintDeck({ deck, name, onDone }: { deck: Deck; name: string; onDone: () => void }) {
  // One print per mount: the parent passes a new deck and callback on every render.
  const latest = useRef({ name, onDone })
  latest.current = { name, onDone }
  useEffect(() => {
    let live = true
    const title = document.title
    const done = () => { window.removeEventListener('afterprint', done); document.title = title; if (live) latest.current.onDone() }
    void document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!live) return
      document.title = latest.current.name
      window.addEventListener('afterprint', done)
      window.print()
    })))
    return () => { live = false; window.removeEventListener('afterprint', done); document.title = title }
  }, [])

  const ctx = contexts(deck)
  return createPortal(
    <div className="print-deck" aria-hidden>
      {deck.slides.map((slide, i) => <SlideView key={i} slide={slide} deck={deck} ctx={ctx[i]} className="print-slide" />)}
    </div>,
    document.body,
  )
}

/** The file name a deck saves under: its name, without characters file systems refuse. */
export const pdfName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Deck'
