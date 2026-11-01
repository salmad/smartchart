/** Renders the landing hero at 2400×1260 for scripts/generate-og.mjs. */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import '@/engine/slides/slides.css'
import '@/engine/components/components.css'
import { BeforeAfter } from '@/app/components/landing/BeforeAfter'
import { Em } from '@/app/components/landing/parts'

function Mark() {
  return (
    <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
      <defs><clipPath id="occam-cut-og"><path d="M0 64V0h18L64 46v18z" /></clipPath></defs>
      <rect x="1" y="1" width="62" height="62" rx="14" className="fill-stage stroke-rule" strokeWidth="2" />
      <circle cx="32" cy="32" r="19" className="fill-[#E8B94A]" clipPath="url(#occam-cut-og)" />
    </svg>
  )
}

function OgCapture() {
  return (
    <div data-look="ink" className="site flex h-full flex-col bg-paper text-type">
      <div className="site-glow flex min-h-0 flex-1 flex-col">
        <header className="mb-10 flex items-center gap-3 font-display text-[28px] font-extrabold tracking-[-.01em] [font-stretch:78%]">
          <Mark />Occam
        </header>
        <div className="grid flex-1 content-start gap-8">
          <h1 className="max-w-[1200px] font-display text-[88px] font-normal leading-[.94] tracking-[-.025em] [font-stretch:78%] [text-wrap:balance]">
            Slides,<br /> <Em>scientifically precise.</Em>
          </h1>
          <p className="max-w-[920px] text-[32px] leading-[1.45] text-type-2 [text-wrap:balance]">
            Laws, not vibes: every slide passes 57 checks for design, meaning and logic.
          </p>
          <div className="mt-4 w-full max-w-[1120px]">
            <BeforeAfter rest={82} motion={false} />
          </div>
        </div>
        <p className="mt-auto pt-8 text-[26px] text-type-3">occamslides.com · First slide free</p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('og')!).render(<OgCapture />)
