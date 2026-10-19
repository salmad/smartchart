/* The doc read view in a browser: the page from docHTML, each figure's canvas laid out and scaled to its frame (as a
   slide is to its frame), then the page's behaviour: sections that fold (kept per viewer), links that unfold their
   target, the contents marking where the reader is, and on a phone a figure that opens full size. */
import type { Theme } from '../types.js'
import { allocate } from '../slides/colours.js'
import { alignHalves, drawIcons, fitPictures, fitValues, sizeTable, stackIcons } from '../components/fit.js'
import { drawCharts } from '../components/charts/hosts.js'
import { asSlide, canvas, figureCanvasHTML, isText, widthOf } from './figure.js'
import { DEFAULT_THEME, docHTML } from './render.js'
import type { Doc, FigureBlock } from './types.js'

/** Under this frame width the notes leave the canvas, and the figure can be expanded. */
const NARROW = 600

/** Scale the canvas to its frame, and give the frame the canvas's height at that scale. */
function size(frame: HTMLElement, fig: HTMLElement, kind: string) {
  const width = widthOf(kind, frame.clientWidth), k = frame.clientWidth / width
  if (isText(kind)) fig.style.setProperty('--w', `${width}px`)
  fig.style.setProperty('--s', String(k))
  frame.style.setProperty('height', `${fig.offsetHeight * k}px`)
}

/** Lay out one figure: the canvas for its frame's width (notes beside, or below on a narrow frame), its colours,
    the component fitters and charts as on a slide, then its scale. `f` is null for code. */
export function mountFigure(frame: HTMLElement, f: FigureBlock | null, theme: Theme, accent: string | undefined): void {
  const fig = frame.querySelector<HTMLElement>(':scope > .fig'), w = frame.clientWidth
  if (!fig || !w) return
  const kind = f?.kind ?? 'code', k = w / widthOf(kind, w), beside = w >= NARROW
  if (f?.body.notes?.length) fig.innerHTML = figureCanvasHTML(f, beside)
  frame.dataset.mode = beside ? 'beside' : 'narrow'
  frame.closest('.doc-fig')?.classList.toggle('narrow', !beside)
  if (isText(kind)) fig.style.setProperty('--w', `${w / k}px`)
  fig.style.setProperty('--s', String(k))
  const s = f ? asSlide(f) : null, colours = allocate(s, theme, accent)
  for (const [key, v] of Object.entries(colours.vars)) fig.style.setProperty(`--${key}`, v)
  fitValues(fig)
  sizeTable(fig, k); stackIcons(fig, k)
  if (s) drawCharts(fig, s, theme, accent, colours)
  drawIcons(fig); fitPictures(fig, k); alignHalves(fig, k)
  size(frame, fig, kind)
}

/** Every figure under `root` laid out once it has a width, again when it crosses NARROW, and otherwise only rescaled: the
    fitters measure in design pixels, so their work holds at any scale (a figure in a folded section waits). */
export function fitFigures(root: HTMLElement, blockOf: (frame: HTMLElement) => FigureBlock | null, theme: Theme, accent: string | undefined): { disconnect(): void } {
  const fit = (frame: HTMLElement) => {
    const w = frame.clientWidth, fig = frame.querySelector<HTMLElement>(':scope > .fig')
    if (!w || !fig) return
    if (frame.dataset.mode !== (w >= NARROW ? 'beside' : 'narrow')) mountFigure(frame, blockOf(frame), theme, accent)
    else size(frame, fig, blockOf(frame)?.kind ?? 'code')
  }
  const sizes = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target as HTMLElement)))
  root.querySelectorAll<HTMLElement>('.doc-fig > .fig-frame').forEach((frame) => { fit(frame); sizes.observe(frame) })
  return sizes
}

const load = (key: string): string[] => { try { const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } }
const save = (key: string, ids: string[]) => { try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* private window: folds last this visit */ } }

export function mountDoc(root: HTMLElement, doc: Doc, key: string): { destroy(): void } {
  const theme = doc.theme ?? DEFAULT_THEME, store = `occam.doc.fold.${key}`
  const blocks = new Map(doc.blocks.flatMap((b) => (b.type === 'figure' ? [[b.id, b] as const] : [])))
  root.innerHTML = docHTML(doc)
  root.querySelectorAll<HTMLElement>('.fold').forEach(drawIcons)
  const blockOf = (frame: HTMLElement) => blocks.get(frame.closest<HTMLElement>('.doc-fig')?.dataset.block ?? '') ?? null

  const sizes = fitFigures(root, blockOf, theme, doc.accent)

  // Expand: on a narrow frame a figure opens at a desktop figure's size, in a dialog that scrolls sideways.
  root.querySelectorAll<HTMLElement>('.doc-fig').forEach((el) => {
    if (isText(el.dataset.kind ?? '')) return
    el.insertAdjacentHTML('beforeend', '<button class="fig-expand" type="button" aria-label="Expand figure"><i data-lucide="maximize-2"></i></button>')
  })
  root.querySelectorAll<HTMLElement>('.fig-expand').forEach(drawIcons)
  const expand = (el: HTMLElement) => {
    const src = el.querySelector<HTMLElement>(':scope > .fig-frame')
    if (!src) return
    const dialog = document.createElement('dialog')
    dialog.className = 'fig-dialog'
    // A fresh canvas, notes beside: the page's own one carries its fitted sizes and drawn charts.
    const f = blockOf(src), fresh = f ? canvas(f.kind, theme, figureCanvasHTML(f, true)) : `<div class="fig-frame">${src.innerHTML}</div>`
    dialog.innerHTML = `<button class="fig-close" type="button" aria-label="Close"><i data-lucide="x"></i></button><div class="fig-scroll">${fresh}</div>`
    root.querySelector('.doc')?.append(dialog)
    drawIcons(dialog)
    dialog.addEventListener('close', () => dialog.remove())
    dialog.querySelector('.fig-close')?.addEventListener('click', () => dialog.close())
    dialog.showModal()
    const frame = dialog.querySelector<HTMLElement>('.fig-frame')
    if (frame) mountFigure(frame, f, theme, doc.accent)
  }

  // Folding, kept per viewer; a link to an id unfolds the section that holds it, then goes there.
  const folded = () => [...root.querySelectorAll<HTMLElement>('.doc-sec.folded')].map((s) => s.id)
  const setFold = (sec: HTMLElement, fold: boolean) => {
    sec.classList.toggle('folded', fold)
    sec.querySelector(':scope > h2 > .fold')?.setAttribute('aria-expanded', String(!fold))
  }
  const reveal = (id: string) => {
    const target = id ? root.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null
    if (!target) return false
    const sec = target.closest<HTMLElement>('.doc-sec')
    if (sec?.classList.contains('folded')) { setFold(sec, false); save(store, folded()) }
    target.scrollIntoView({ block: 'start' })
    return true
  }
  const click = (e: MouseEvent) => {
    const t = e.target instanceof Element ? e.target : null
    const fold = t?.closest<HTMLElement>('.fold'), sec = fold?.closest<HTMLElement>('.doc-sec')
    if (fold && sec) { setFold(sec, !sec.classList.contains('folded')); save(store, folded()); return }
    const ex = t?.closest<HTMLElement>('.fig-expand')?.closest<HTMLElement>('.doc-fig')
    if (ex) { expand(ex); return }
    const a = t?.closest<HTMLAnchorElement>('a[href^="#"]')
    if (a && reveal(a.getAttribute('href')?.slice(1) ?? '')) { e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')) }
  }
  root.addEventListener('click', click)
  // Esc closes a figure's checks.
  const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; const d = (e.target instanceof Element ? e.target : null)?.closest<HTMLDetailsElement>('details.fig-checks[open]'); if (d) { d.open = false; d.querySelector('summary')?.focus() } }
  root.addEventListener('keydown', esc)
  for (const id of load(store)) { const sec = root.querySelector<HTMLElement>(`.doc-sec[id="${CSS.escape(id)}"]`); if (sec) setFold(sec, true) }
  if (location.hash) reveal(decodeURIComponent(location.hash.slice(1)))

  // The contents mark the last heading the reader has passed.
  const heads = [...root.querySelectorAll<HTMLElement>('.doc-sec, .sec-body h3[id]')], links = [...root.querySelectorAll<HTMLAnchorElement>('.doc-toc a, .doc-toc-mini a')]
  let frame = 0
  const spy = () => {
    frame = 0
    const current = heads.filter((h) => h.getBoundingClientRect().top <= 120).pop()?.id
    links.forEach((a) => (a.getAttribute('href') === `#${current}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')))
  }
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(spy) }
  window.addEventListener('scroll', onScroll, { passive: true })
  spy()

  return { destroy() { sizes.disconnect(); root.removeEventListener('click', click); root.removeEventListener('keydown', esc); window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) } }
}
