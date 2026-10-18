/* One slide at 1920×1080 for the lint browser tests: window.lint(slide, style) mounts it and returns the lints.
   window.cols(slide, style, width) mounts it in a frame that wide and returns its table's column widths. */
import '@/engine/slides/slides.css'
import { mountSlide } from '@/engine/slides/render'
import { fitIssues, layoutLints, type LayoutLints } from '@/engine/slides/lints'
import type { Slide, Style } from '@/engine/types'

export type LintResult = { fit: string[]; bodyTop: number | null } & LayoutLints
declare global { interface Window { lint?: (slide: Slide, style: Style) => Promise<LintResult>; cols?: (slide: Slide, style: Style, width: number) => Promise<string[]>; ready?: boolean } }

const fonts = Promise.all(['800 100px Archivo', '900 100px Archivo', '400 30px Geist', '600 30px Geist', "500 20px 'Geist Mono'"].map((f) => document.fonts.load(f))).then(() => document.fonts.ready)
window.lint = async (slide, style) => {
  await fonts
  const deck = { style, theme: 'ink' as const, accent: null, footer: 'Fixture', slides: [slide] }
  const frame = document.getElementById('frame') as HTMLElement
  const el = mountSlide(frame, slide, { page: 1, section: 0, kicker: '', footer: 'Fixture' }, deck)
  const body = el.querySelector(':scope > .head + *'), k = el.getBoundingClientRect().width / 1920
  const bodyTop = body && Math.round((body.getBoundingClientRect().top - el.getBoundingClientRect().top) / k)
  return { fit: fitIssues(el, style), ...layoutLints(el, style), bodyTop }
}
window.cols = async (slide, style, width) => {
  await fonts
  const deck = { style, theme: 'ink' as const, accent: null, footer: 'Fixture', slides: [slide] }
  const frame = document.getElementById('frame') as HTMLElement
  frame.style.width = `${width}px`; frame.style.height = `${width * 9 / 16}px`
  const el = mountSlide(frame, slide, { page: 1, section: 0, kicker: '', footer: 'Fixture' }, deck)
  const widths = [...el.querySelectorAll<HTMLElement>('.tbl col')].map((c) => c.style.width)
  frame.style.width = ''; frame.style.height = ''
  return widths
}
window.ready = true
