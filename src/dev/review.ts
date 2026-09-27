/* Dev review page: every example (or the stress deck) in both styles, validated and measured for overflow.
   Query: style=both|consulting|pitch, theme=ink|paper, stress=1, only=<index>, full=1. Sets window.__fit. */
import '@/engine/slides/slides.css'
import { MENU, catalogue, describe, validateDeck } from '@/engine/slides/schema'
import { contexts, esc, mountSlide } from '@/engine/slides/render'
import { fitIssues, layoutLints } from '@/engine/slides/lints'
import { EXAMPLES, FOOTER, type Example } from '@/engine/slides/examples'
import type { Slide, Style, Theme } from '@/engine/types'
import { stressFor } from '../../tests/fixtures/stress'

declare global { interface Window { __fit?: { issues: number; warnings: number } } }

type Choice = 'both' | Style
const q = new URLSearchParams(location.search)
const STRESS = q.has('stress')
const strip = ({ name: _name, ...rest }: Slide & { name: string }): Partial<Slide> => rest
const SOURCE: Example[] = STRESS
  ? stressFor('consulting').map((sc, i) => ({ template: sc.template, name: sc.name, consulting: strip(sc), pitch: strip(stressFor('pitch')[i]) }))
  : EXAMPLES
const specFor = (ex: Example, style: Style): Slide => {
  const { consulting, pitch, name: _name, ...shared } = ex
  return { ...shared, ...(style === 'pitch' ? pitch : consulting) } as Slide
}
const deckFor = (style: Style, theme: Theme) => ({ style, theme, accent: null, footer: FOOTER, slides: SOURCE.map((ex) => specFor(ex, style)) })

const state: { style: Choice; theme: Theme } = { style: (q.get('style') as Choice | null) || 'both', theme: (q.get('theme') as Theme | null) || 'ink' }
const only = q.get('only')
if (q.get('full')) document.body.classList.add('full')
const listEl = document.getElementById('list') as HTMLElement
const ro = new ResizeObserver((es) => es.forEach((e) => (e.target.firstElementChild as HTMLElement | null)?.style.setProperty('--s', String(e.contentRect.width / 1920))))

function render() {
  document.querySelectorAll<HTMLElement>('.seg').forEach((seg) => seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.v === state[seg.dataset.key as keyof typeof state]))))
  const styles: Style[] = state.style === 'both' ? ['consulting', 'pitch'] : [state.style]
  const decks = Object.fromEntries(styles.map((st) => [st, deckFor(st, state.theme)])) as Record<Style, ReturnType<typeof deckFor>>
  const ctx = Object.fromEntries(styles.map((st) => [st, contexts(decks[st])])) as Record<Style, ReturnType<typeof contexts>>
  const checks = Object.fromEntries(styles.map((st) => [st, validateDeck(decks[st])])) as Record<Style, ReturnType<typeof validateDeck>>

  listEl.innerHTML = `<details><summary>The menu the router sees: catalogue()</summary><pre>${esc(catalogue())}</pre></details>`
    + SOURCE.map((ex, i) => (only !== null && +only !== i ? '' : `
    <figure data-i="${i}">
      <figcaption><span class="id">${String(i + 1).padStart(2, '0')} · ${ex.template} · ${styles.map((st) => MENU[ex.template].variant(decks[st].slides[i])).join(' / ')}</span><b>${ex.name}</b><span class="badges"></span></figcaption>
      <div class="frames ${styles.length > 1 ? 'two' : ''}">${styles.map((st) => `<div class="frame-wrap">
        ${styles.length > 1 ? `<div class="frame-label">${st}</div>` : ''}<div class="frame" data-style="${st}"></div></div>`).join('')}</div>
      <div class="issues"></div>
      <details><summary>Agent output (JSON)</summary><pre>${esc(styles.map((st) => (styles.length > 1 ? `// ${st}\n` : '') + JSON.stringify(decks[st].slides[i], null, 2)).join('\n\n'))}</pre></details>
      <details><summary>Template card: describe("${ex.template}", "${styles[0]}")</summary><pre>${esc(JSON.stringify(describe(ex.template, styles[0]), null, 2))}</pre></details>
    </figure>`)).join('')

  let bad = 0, warn = 0
  listEl.querySelectorAll<HTMLElement>('figure').forEach((fig) => {
    const i = Number(fig.dataset.i), lines: { cls: string; text: string }[] = []
    fig.querySelectorAll<HTMLElement>('.frame').forEach((fr) => {
      const st = fr.dataset.style as Style
      mountSlide(fr, decks[st].slides[i], ctx[st][i], decks[st]); ro.observe(fr)
    })
    styles.forEach((st) => {
      const pre = styles.length > 1 ? `${st}: ` : '', own = (p: string) => p.startsWith(`slides[${i}].`)
      checks[st].errors.filter(own).forEach((e) => lines.push({ cls: '', text: pre + e }))
      checks[st].warnings.filter(own).forEach((w) => lines.push({ cls: 'w', text: pre + w }))
      const slide = fig.querySelector<HTMLElement>(`.frame[data-style="${st}"] .slide`)
      if (!slide) return
      fitIssues(slide, st).forEach((e) => lines.push({ cls: '', text: `${pre}layout: ${e}` }))
      const lint = layoutLints(slide, st)
      lint.issues.forEach((e) => lines.push({ cls: '', text: `${pre}layout: ${e}` }))
      lint.warnings.forEach((w) => lines.push({ cls: 'w', text: `${pre}layout: ${w}` }))
    })
    const errs = lines.filter((l) => !l.cls).length, warns = lines.length - errs
    bad += errs; warn += warns
    const badges = fig.querySelector('.badges'), issues = fig.querySelector('.issues')
    if (badges) badges.innerHTML = errs ? `<span class="badge bad">${errs} issue${errs > 1 ? 's' : ''}</span>` : warns ? `<span class="badge warn">${warns} warning${warns > 1 ? 's' : ''}</span>` : '<span class="badge">valid · fits</span>'
    if (issues) issues.innerHTML = lines.map((l) => `<div class="${l.cls}">${esc(l.text)}</div>`).join('')
  })
  const summary = document.getElementById('summary')
  if (summary) summary.textContent = bad ? `${bad} issues · ${warn} warnings` : warn ? `all fit · ${warn} warnings` : 'all slides valid and fit'
  window.__fit = { issues: bad, warnings: warn }
}

document.querySelectorAll<HTMLElement>('.seg').forEach((seg) => seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
  if (seg.dataset.key === 'style') state.style = b.dataset.v as Choice
  else state.theme = b.dataset.v as Theme
  render()
})))
// Load every face before measuring; otherwise charts and headlines lay out in the fallback font.
void Promise.all(['800 100px Archivo', '900 100px Archivo', '400 30px Geist', '600 30px Geist', "500 20px 'Geist Mono'"].map((f) => document.fonts.load(f)))
  .then(() => document.fonts.ready).then(render)
