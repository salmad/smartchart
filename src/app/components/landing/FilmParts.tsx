import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/* The pieces the landing film is cut from. Everything is sized in cqw (the film frame's width), so the film scales like a
   video. The film is always dark: its colours are literal, not the site's look tokens. Gold is the only colour that moves. */

/** The doc nobody reads: a page of the board pack. As Occam reads it, a gold line scans the page and the figures and
    sentences that carry the point light up, one pass at a time (`marks` 1–3). */
export function Doc({ marks, scanning }: { marks: number; scanning: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[.8cqw] bg-[#F6F3EC] p-[2.2cqw] text-[#2A2621] shadow-[0_0_0_1px_rgba(255,255,255,.6)_inset,0_2cqw_5cqw_-1.5cqw_rgba(0,0,0,.85)]">
      <p className="text-[.8cqw] font-medium uppercase tracking-[.1em] text-[#8A8984]">Board pack · Q4 · draft 3</p>
      <p className="mt-[.8cqw] font-display text-[1.9cqw] font-extrabold leading-none [font-stretch:78%]">Year 4 results</p>
      <div className="mt-[1.2cqw] grid gap-[.8cqw] text-[1.02cqw] leading-[1.55]">
        <p>
          Year 4 closed with revenue of <Mark on={marks > 0}>£42m</Mark>, up from £14m a year earlier. Gross margin came to{' '}
          <Mark on={marks > 0}>£16m</Mark> after funding costs of £9m, rewards of £6m and <Mark on={marks > 1}>bad debt of £11m</Mark>.
        </p>
        <p><Mark on={marks > 2}>Bad debt is now the largest single cost</Mark>, driven by revolver balances in the first two cohorts. Funding costs are fixed for three years under the warehouse facility, and rewards scale with card spend.</p>
        <p className="text-[#8A8984]">Underwriting changes from Q2 are expected to bring bad debt towards 8% of balances, though the effect will lag by two to three quarters as older cohorts run off, and the committee has asked for…</p>
      </div>
      {scanning && <i aria-hidden className="absolute inset-x-0 h-[2px] bg-[#E8B94A] shadow-[0_0_1.2cqw_.3cqw_rgba(232,185,74,.6)] motion-safe:animate-scan" />}
    </div>
  )
}

/** A highlighter pass: gold sweeps in left to right. */
function Mark({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="relative">
      <span aria-hidden className={cn('absolute -inset-x-[.2cqw] inset-y-[.05cqw] origin-left rounded-[.2cqw] bg-[#E8B94A]/40 transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]', on ? 'scale-x-100' : 'scale-x-0')} />
      <span className="relative">{children}</span>
    </span>
  )
}

// Sparks around the slide as it arrives: position around the frame (in % of the slide) and a stagger, as literal classes.
const SPARKS = [
  'left-[-2%] top-[8%] [animation-delay:0ms]', 'left-[18%] top-[-6%] [animation-delay:120ms]', 'left-[46%] top-[-8%] [animation-delay:60ms]',
  'left-[74%] top-[-5%] [animation-delay:180ms]', 'left-[101%] top-[12%] [animation-delay:40ms]', 'left-[103%] top-[52%] [animation-delay:220ms]',
  'left-[99%] top-[92%] [animation-delay:100ms]', 'left-[62%] top-[104%] [animation-delay:260ms]', 'left-[30%] top-[106%] [animation-delay:140ms]',
  'left-[-4%] top-[88%] [animation-delay:200ms]', 'left-[-5%] top-[48%] [animation-delay:80ms]', 'left-[88%] top-[-9%] [animation-delay:300ms]',
]
const SIZES = ['size-[1.6cqw]', 'size-[1cqw]', 'size-[1.3cqw]']

/** The slide is designed: gold four-point stars burst around it, and a sheen of light passes across it once. */
export function Celebrate() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 overflow-hidden rounded-[.6cqw]">
        <i className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,244,214,.22),transparent)] motion-safe:animate-sheen" />
      </div>
      {SPARKS.map((p, i) => (
        <svg key={p} viewBox="0 0 20 20" className={cn('absolute -translate-x-1/2 -translate-y-1/2 opacity-0 motion-safe:animate-sparkle', p, SIZES[i % 3])}>
          <path d="M10 0c.8 5.6 3.6 8.4 10 10-6.4 1.6-9.2 4.4-10 10-.8-5.6-3.6-8.4-10-10 6.4-1.6 9.2-4.4 10-10z" fill="#E8B94A" />
        </svg>
      ))}
    </div>
  )
}

/** The request. Typing: the composer, with a cursor and the send button. Sent: the message rises away into the chat and
    Occam's status is left in its place (working on it, then done). */
export function Prompt({ text, sent, status }: { text: string; sent: boolean; status?: 'working' | 'done' }) {
  if (!sent) {
    return (
      <div className="flex items-center gap-[1cqw] whitespace-nowrap rounded-full bg-[#1C1A17] py-[.7cqw] pl-[1.6cqw] pr-[.7cqw] text-[1.3cqw] text-[#F3EEE4] shadow-[0_0_0_1px_#3A352E,0_1.5cqw_3cqw_-1cqw_rgba(0,0,0,.8)]">
        <span>{text}<i aria-hidden className="ml-px inline-block h-[1.1em] w-px translate-y-[.15em] animate-pulse bg-[#F3EEE4]" /></span>
        <span aria-hidden className="grid size-[2.2cqw] place-items-center rounded-full bg-[#F3EEE4] text-[1.2cqw] text-[#0B0A09]">↑</span>
      </div>
    )
  }
  // Sent: the message lifts off the composer and leaves upward, into the chat; Occam's status takes its place.
  return (
    <div className="relative grid place-items-center whitespace-nowrap">
      <p className="absolute rounded-[1.4cqw_1.4cqw_.3cqw_1.4cqw] bg-[#F3EEE4] px-[1.5cqw] py-[.8cqw] text-[1.3cqw] text-[#0B0A09] shadow-[0_1.5cqw_3cqw_-1cqw_rgba(0,0,0,.8)] motion-safe:animate-send">{text}</p>
      {status && (
        <p key={status} className="flex items-center gap-[.6cqw] py-[.8cqw] text-[1.2cqw] text-[#A39B8E] motion-safe:animate-rise motion-safe:[animation-delay:.5s]">
          <span className="font-medium text-[#E8B94A]">Occam</span>
          {status === 'working'
            ? <><i aria-hidden className="inline-block size-[1.1cqw] animate-spin rounded-full border-2 border-white/20 border-t-[#E8B94A] [animation-duration:.8s]" />working on it</>
            : <>done</>}
        </p>
      )}
    </div>
  )
}

/* The checks, drawn on the slide in its own 1920 × 1080 units, measured from the rendered waterfall-notes draft:
   margins 128 / 96 and the 56 px title-to-body gap come from slides.css; words and bars from their laid-out boxes. */
const GOLD = '#E8B94A'
const LINKS: [word: [number, number, number], bar: [number, number]][] = [
  [[128, 387, 222], [1293, 600]], // "Bad debt" → the bad-debt bar
  [[128, 293, 298], [295, 440]], // "£42m" → revenue, above its label
  [[787, 950, 298], [1625, 668]], // "£16m" → margin, above its label
]

/** Logic review: each figure the title claims, underlined and joined to the bar that proves it. */
function Links({ on }: { on: boolean }) {
  return (
    <g className={cn('transition-opacity duration-500', on ? 'opacity-100' : 'opacity-0')}>
      {LINKS.map(([[x1, x2, y], [bx, by]], i) => {
        const mx = (x1 + x2) / 2
        return (
          <g key={i}>
            <line x1={x1} x2={x2} y1={y} y2={y} stroke={GOLD} strokeWidth="5" strokeDasharray="none" />
            <path d={`M${mx} ${y + 6} C ${mx} ${by - 40}, ${bx} ${y + 120}, ${bx} ${by - 14}`} fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="10 8"
              className={on ? 'motion-safe:animate-[dash_1.2s_linear_infinite]' : ''} />
            <circle cx={bx} cy={by - 14} r="9" fill={GOLD} />
          </g>
        )
      })}
    </g>
  )
}

/** A measurement, as in a design tool: a gold line with end caps and its length in px. */
function Dim({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const v = x1 === x2, cap = 12, lx = (x1 + x2) / 2, ly = (y1 + y2) / 2
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth="3" strokeDasharray="none" />
      {v ? <><line x1={x1 - cap} x2={x1 + cap} y1={y1} y2={y1} stroke={GOLD} strokeWidth="3" strokeDasharray="none" /><line x1={x1 - cap} x2={x1 + cap} y1={y2} y2={y2} stroke={GOLD} strokeWidth="3" strokeDasharray="none" /></>
        : <><line x1={x1} x2={x1} y1={y1 - cap} y2={y1 + cap} stroke={GOLD} strokeWidth="3" strokeDasharray="none" /><line x1={x2} x2={x2} y1={y1 - cap} y2={y1 + cap} stroke={GOLD} strokeWidth="3" strokeDasharray="none" /></>}
      <rect x={(v ? lx + 18 : lx - 40)} y={(v ? ly - 20 : ly + 16)} width="80" height="40" rx="8" fill={GOLD} />
      <text x={(v ? lx + 58 : lx)} y={(v ? ly + 9 : ly + 45)} textAnchor="middle" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="26" fontWeight="600" fill="#0B0A09">{label}</text>
    </g>
  )
}

/** Design review: the 12-column grid inside the margins, the guides the title and body sit on, and their measurements. */
function Measure({ on }: { on: boolean }) {
  const cols = Array.from({ length: 13 }, (_, i) => 128 + (i * (1920 - 256)) / 12)
  return (
    <g className={cn('transition-opacity duration-700', on ? 'opacity-100' : 'opacity-0')}>
      {cols.map((x) => <line key={x} x1={x} x2={x} y1="0" y2="1080" stroke={GOLD} strokeOpacity=".22" strokeWidth="2" strokeDasharray="none" />)}
      {[96, 293, 349].map((y) => <line key={y} x1="0" x2="1920" y1={y} y2={y} stroke={GOLD} strokeOpacity=".45" strokeWidth="2" strokeDasharray="none" />)}
      <Dim x1={0} y1={540} x2={128} y2={540} label="128" />
      <Dim x1={1792} y1={540} x2={1920} y2={540} label="128" />
      <Dim x1={1500} y1={0} x2={1500} y2={96} label="96" />
      <Dim x1={1500} y1={293} x2={1500} y2={349} label="56" />
    </g>
  )
}

/** A review's name, as a gold tag drawn on the slide beside what it is checking. */
function Tag({ x, y, children, anchor = 'start' }: { x: number; y: number; children: string; anchor?: 'start' | 'end' }) {
  const w = children.length * 17 + 44, left = anchor === 'end' ? x - w : x
  return (
    <g>
      <rect x={left} y={y} width={w} height="50" rx="25" fill={GOLD} />
      <text x={left + w / 2} y={y + 34} textAnchor="middle" fontFamily="Geist, system-ui, sans-serif" fontSize="28" fontWeight="600" fill="#0B0A09">{children}</text>
    </g>
  )
}

/** Everything the checks draw on the slide: the title outlined, the claim linked to its evidence, the grid measured. */
export function CheckOverlay({ check }: { check: number | undefined }) {
  return (
    <svg aria-hidden viewBox="0 0 1920 1080" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g className={cn('transition-opacity duration-500', check === 0 ? 'opacity-100' : 'opacity-0')}>
        <rect x="108" y="84" width="1250" height="226" rx="14" fill="none" stroke={GOLD} strokeWidth="4" strokeDasharray="none" />
        <Tag x={1792} y={20} anchor="end">Semantic check · the point is in the title</Tag>
      </g>
      <g className={cn('transition-opacity duration-500', check === 1 ? 'opacity-100' : 'opacity-0')}>
        <Links on={check === 1} />
        <Tag x={1792} y={360} anchor="end">Logic review · the chart backs the title</Tag>
      </g>
      <g className={cn('transition-opacity duration-500', check === 2 ? 'opacity-100' : 'opacity-0')}>
        <Measure on={check === 2} />
        <Tag x={1792} y={400} anchor="end">Design review · spacing and grid</Tag>
      </g>
    </svg>
  )
}
