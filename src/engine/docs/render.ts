/* Doc → the page as HTML: the head, the contents, the body with each ## section folding, figures on canvases. Pure
   (no DOM), so it is tested in node; mount.ts draws the charts, scales the canvases and wires the page. */
import type { Theme } from '../types.js'
import { esc, md } from '../components/text.js'
import { outline } from './parse.js'
import { codeFigureHTML, figureHTML } from './figure.js'
import type { Block, Doc } from './types.js'

/** A doc's theme when it names none: paper suits long reading (M3 swaps in the workspace's brand). */
export const DEFAULT_THEME: Theme = 'paper'

function blockHTML(b: Block, theme: Theme): string {
  switch (b.type) {
    case 'heading': return `<h3 id="${b.id}">${md(b.text)}</h3>`
    case 'paragraph': return `<p>${md(b.text)}</p>`
    case 'bullets': return `<ul class="doc-list">${b.items.map((x) => `<li>${md(x)}</li>`).join('')}</ul>`
    case 'numbered': return `<ol class="doc-list">${b.items.map((x) => `<li><span>${md(x)}</span></li>`).join('')}</ol>`
    case 'quote': return `<blockquote><p>${md(b.text)}</p></blockquote>`
    case 'divider': return '<hr>'
    case 'code': return codeFigureHTML(b, theme)
    case 'figure': return figureHTML(b, theme)
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
