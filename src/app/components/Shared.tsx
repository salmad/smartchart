/* A deck shared by link, for the room: every slide full width, top to bottom, and Present for the meeting.
   Open to anyone with the link, signed in or not; it always shows the deck as last saved. */
import { useEffect, useRef, useState } from 'react'
import { contexts } from '@/engine/slides/render'
import { loadShared, type Shared as SharedDeck } from '@/app/share'
import { Button } from './ui/button'
import { Present } from './Present'
import { PrintDeck, pdfName } from './PrintDeck'
import { SlideView } from './SlideView'

type Load = { state: 'loading' } | { state: 'off' } | { state: 'error' } | { state: 'ready'; shared: SharedDeck }

export function Shared({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [presenting, setPresenting] = useState<number | null>(null), [printing, setPrinting] = useState(false)
  const slideRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    let live = true
    loadShared(token).then((shared) => { if (live) setLoad(shared ? { state: 'ready', shared } : { state: 'off' }) }, () => { if (live) setLoad({ state: 'error' }) })
    return () => { live = false }
  }, [token])

  // ?slide=<id> opens at that slide.
  const wanted = new URLSearchParams(location.search).get('slide')
  useEffect(() => {
    if (load.state !== 'ready' || !wanted) return
    const i = load.shared.ids.indexOf(wanted)
    if (i >= 0) requestAnimationFrame(() => slideRefs.current[i]?.scrollIntoView({ block: 'center' }))
  }, [load.state, wanted])  // eslint-disable-line react-hooks/exhaustive-deps -- once, when the deck first loads

  // A shared deck is for whoever has the link, not for search results.
  useEffect(() => {
    const robots = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' })
    document.head.append(robots)
    return () => robots.remove()
  }, [])
  const name = load.state === 'ready' ? load.shared.name : null
  useEffect(() => { if (name) document.title = `${name} · Occam` }, [name])
  // ⌘P prints the deck, one slide per page, not the page around it.
  useEffect(() => {
    if (!name) return
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setPrinting(true) } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [name])

  if (load.state === 'loading') return <div className="h-full bg-app-bg" />
  if (load.state !== 'ready') return <Gone error={load.state === 'error'} />
  const { deck } = load.shared, ctx = contexts(deck)

  if (presenting !== null) return <Present deck={deck} start={presenting} onExit={() => setPresenting(null)} />
  return (
    <div className="h-full overflow-y-auto bg-app-bg text-ink">
      <header className="sticky top-0 z-[1] flex h-14 items-center gap-3 border-b border-line bg-app-bg/85 px-5 backdrop-blur max-[900px]:px-4">
        <a href="/home" className="whitespace-nowrap text-[13px] font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
        <span aria-hidden className="text-[13px] text-ink-3">/</span>
        <h1 className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{load.shared.name}</h1>
        {deck.slides.length > 0 && <Button variant="outline" onClick={() => setPrinting(true)} title="Download PDF (⌘P)">PDF</Button>}
        {deck.slides.length > 0 && <Button onClick={() => setPresenting(0)}>Present</Button>}
      </header>
      <main className="mx-auto grid w-full max-w-[1200px] gap-8 px-8 pb-16 pt-10 max-[900px]:gap-4 max-[900px]:px-4 max-[900px]:pb-10 max-[900px]:pt-4">
        {deck.slides.map((slide, i) => (
          <button key={i} ref={(el) => { slideRefs.current[i] = el }} type="button" onClick={() => setPresenting(i)} aria-label={`Present from slide ${i + 1}`}
            className="relative mx-auto block aspect-video w-[min(100%,calc((100vh_-_56px_-_64px)*16/9))] cursor-zoom-in overflow-hidden rounded-[10px] bg-panel shadow-[0_0_0_1px_theme(colors.line),0_24px_60px_rgba(0,0,0,.5)] outline-none focus-visible:shadow-[0_0_0_2px_theme(colors.ink-3)] max-[900px]:w-full max-[900px]:rounded-lg">
            <SlideView slide={slide} deck={deck} ctx={ctx[i]} className="absolute inset-0" />
          </button>
        ))}
        {deck.slides.length === 0 && <p className="py-24 text-center text-ink-3">This deck has no slides yet.</p>}
      </main>
      {printing && <PrintDeck deck={deck} name={pdfName(load.shared.name)} onDone={() => setPrinting(false)} />}
      <footer className="border-t border-line py-6 text-center text-[12.5px] text-ink-3">
        Made with <a href="/home" className="text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">Occam</a>
      </footer>
    </div>
  )
}

function Gone({ error }: { error: boolean }) {
  return (
    <div className="grid h-full place-content-center gap-2 bg-app-bg px-6 text-center text-ink">
      <p className="text-[17px] font-medium">{error ? 'This deck can’t be opened right now.' : 'This link is off.'}</p>
      <p className="text-ink-3">{error ? 'Check your connection and reload the page.' : 'Its owner stopped sharing the deck, or the link was never made.'}</p>
      <a href="/home" className="mt-4 text-[13px] text-ink-2 hover:text-ink">Occam</a>
    </div>
  )
}
