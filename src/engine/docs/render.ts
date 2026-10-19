/* Doc → the page as HTML: the head, the contents, the body with each ## section folding, figures on canvases. Pure
   (no DOM), so it is tested in node; mount.ts draws the charts, scales the canvases and wires the page. */
import type { Theme } from '../types.js'
import { esc, md } from '../components/text.js'
import { outline } from './parse.js'
import { codeFigureHTML, figureHTML } from './figure.js'
import { figureChecks } from './checks.js'
import type { Block, Doc, ListBlock } from './types.js'

/** A doc's theme when it names none: paper suits long reading (M3 swaps in the workspace's brand). */
export const DEFAULT_THEME: Theme = 'paper'

/** The figure's failed code checks as a native <details>: a count, and the messages when opened. Nothing when none fail. */
function badgeHTML(f: Extract<Block, { type: 'figure' }>): string {
  let failed: ReturnType<typeof figureChecks>
  try { failed = figureChecks(f).filter((c) => !c.ok) } catch { return '' }
  if (!failed.length) return ''
  return `<details class="fig-checks"><summary>${failed.length} check${failed.length === 1 ? '' : 's'}</summary><ul>${failed.map((c) => `<li><b>${c.id}</b> ${esc(c.msg)}</li>`).join('')}</ul></details>`
}

/** A list; the list under an item is drawn inside that item's li. */
export function listHTML(l: ListBlock): string {
  const items = l.items.map((x, i) => {
    const under = l.nested?.[i] ? listHTML(l.nested[i] as ListBlock) : ''
    return l.type === 'bullets' ? `<li>${md(x)}${under}</li>` : `<li><span>${md(x)}</span>${under}</li>`
  }).join('')
  return `<${l.type === 'bullets' ? 'ul' : 'ol'} class="doc-list">${items}</${l.type === 'bullets' ? 'ul' : 'ol'}>`
}

/** One block as HTML. A ## heading is the bare <h2 id>: only docHTML wraps it in its section. */
export function blockHTML(b: Block, theme: Theme): string {
  switch (b.type) {
    case 'heading': { const t = `h${b.level}`; return `<${t} id="${b.id}">${md(b.text)}</${t}>` }
    case 'paragraph': return `<p>${md(b.text)}</p>`
    case 'bullets': case 'numbered': return listHTML(b)
    case 'quote': return `<blockquote><p>${md(b.text)}</p></blockquote>`
    case 'divider': return '<hr>'
    case 'code': return codeFigureHTML(b, theme)
    case 'figure': return figureHTML(b, theme, true, badgeHTML(b))
    case 'raw': return `<pre class="doc-raw">${esc(b.text)}</pre>`
  }
}

const sectionOpen = (id: string, text: string) => `<section class="doc-sec" id="${id}"><h2><button class="fold" type="button" aria-expanded="true" aria-controls="${id}-body" aria-label="Fold section"><i data-lucide="chevron-down"></i></button><a href="#${id}">${md(text)}</a></h2><div class="sec-body" id="${id}-body">`

export function docHTML(doc: Doc): string {
  const theme = doc.theme ?? DEFAULT_THEME, toc = outline(doc)
  const list = `<ol>${toc.map((h) => `<li class="l${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol>`
  let body = '', open = false
  for (const b of doc.blocks) {
    if (b.type === 'heading' && b.level === 2) { body += `${open ? '</div></section>' : ''}${sectionOpen(b.id, b.text)}`; open = true; continue }
    body += blockHTML(b, theme)
  }
  if (open) body += '</div></section>'
  const head = `<header class="doc-head"><h1 class="doc-title">${md(doc.title)}</h1>${doc.subtitle ? `<p class="doc-sub">${md(doc.subtitle)}</p>` : ''}</header>`
  const nav = toc.length ? `<nav class="doc-toc" aria-label="Contents"><p class="toc-h">Contents</p>${list}</nav>` : ''
  const mini = toc.length ? `<details class="doc-toc-mini"><summary>Contents</summary>${list}</details>` : ''
  return `<article class="doc theme-${theme}" data-links>${head}${nav}<div class="doc-body">${mini}${body}</div></article>`
}
