/* Dev doc review page: one doc starter drawn by the read view, its figures checked (C1 chart labels, R15 colours).
   Query: doc=<starter id>, theme=ink|paper (over the doc's own), width=<px> (the figure column). Sets window.__docs. */
import '@/engine/components/components.css'
import '@/engine/docs/doc.css'
import { DOC_STARTERS, starterDoc } from '@/engine/starters'
import { mountDoc } from '@/engine/docs/mount'
import { FIG_WIDTH } from '@/engine/docs/figure'
import { chartLabelLints, colourLints } from '@/engine/slides/lints'
import { esc } from '@/engine/components/text'
import type { Theme } from '@/engine/types'

declare global { interface Window { __docs?: { issues: string[] } } }

const q = new URLSearchParams(location.search)
const starter = DOC_STARTERS.find((s) => s.id === q.get('doc')) ?? DOC_STARTERS[0]
const theme = q.get('theme') === 'ink' || q.get('theme') === 'paper' ? (q.get('theme') as Theme) : undefined
const width = Number(q.get('width')) || 0
const doc = starterDoc(starter)
if (theme) doc.theme = theme

const root = document.getElementById('doc') as HTMLElement, bar = document.getElementById('bar') as HTMLElement
if (width) root.style.setProperty('--doc-wide', `${width}px`)
const link = (params: Record<string, string>, label: string, current: boolean) => {
  const u = new URLSearchParams(q)
  for (const [k, v] of Object.entries(params)) u.set(k, v)
  return `<a href="?${u}"${current ? ' aria-current="page"' : ''}>${esc(label)}</a>`
}
bar.innerHTML = [...DOC_STARTERS.map((s) => link({ doc: s.id }, s.label, s === starter)),
  link({ theme: 'paper' }, 'Paper', (doc.theme ?? 'paper') === 'paper'), link({ theme: 'ink' }, 'Ink', doc.theme === 'ink')].join('')

void Promise.all(['800 100px Archivo', '900 100px Archivo', '400 30px Geist', '600 30px Geist', "500 20px 'Geist Mono'"].map((f) => document.fonts.load(f)))
  .then(() => document.fonts.ready).then(() => {
    mountDoc(root, doc, `dev-${starter.id}`)
    const figs = [...root.querySelectorAll<HTMLElement>('.doc-fig .fig')]
    const issues = figs.flatMap((fig) => [...chartLabelLints(fig, FIG_WIDTH), ...colourLints(fig)].map((m) => `#${fig.closest<HTMLElement>('.doc-fig')?.id ?? 'code'}: ${m}`))
    bar.insertAdjacentHTML('beforeend', `<span class="summary">${figs.length} figures · ${issues.length} issues</span>${issues.length ? `<ul>${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`)
    window.__docs = { issues }
  })
