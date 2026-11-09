/* Doc → the page as HTML: the head, the contents, the body with each ## section folding, figures on canvases. Pure
   (no DOM), so it is tested in node; mount.ts draws the charts, scales the canvases and wires the page. */
import type { Theme } from '../types.js'
import { esc, md } from '../components/text.js'
import { outlineTree, type OutlineSection } from './parse.js'
import { codeFigureHTML, figureHTML } from './figure.js'
import { checkKey, figureChecks } from './checks.js'
import { identify } from './ops.js'
import type { Block, Doc, ListBlock } from './types.js'

/** A doc's theme when it names none: paper suits long reading (M3 swaps in the workspace's brand). */
export const DEFAULT_THEME: Theme = 'paper'

/** The figure's failed code checks as a native <details>: a count, and the messages when opened, each a button the app
    answers (it opens the check in the Checks panel; data-check-key names it). Nothing when none fail. */
function badgeHTML(f: Extract<Block, { type: 'figure' }>): string {
  let failed: ReturnType<typeof figureChecks>
  try { failed = figureChecks(f).filter((c) => !c.ok) } catch { return '' }
  if (!failed.length) return ''
  const hard = failed.filter((c) => !/^S\d/.test(c.id)), soft = failed.filter((c) => /^S\d/.test(c.id))
  const summary = hard.length ? `${hard.length} check${hard.length === 1 ? '' : 's'}` : 'Could be better'
  const say = (msg: string) => msg.replace(/^The /, '').replace(/\.$/, '')
  const rows = [...hard, ...soft].map((c) => `<li><button type="button" class="fig-check" data-check="${esc(c.id)}" data-check-key="${esc(checkKey(c))}">${esc(say(c.msg))}</button></li>`).join('')
  return `<details class="fig-checks"><summary>${summary}</summary><ul>${rows}</ul></details>`
}

/** A list; the list under an item is drawn inside that item's li. */
export function listHTML(l: ListBlock): string {
  const items = l.items.map((x, i) => {
    const under = l.nested?.[i] ? listHTML(l.nested[i] as ListBlock) : ''
    return l.type === 'bullets' ? `<li>${md(x)}${under}</li>` : `<li><span>${md(x)}</span>${under}</li>`
  }).join('')
  return `<${l.type === 'bullets' ? 'ul' : 'ol'} class="doc-list">${items}</${l.type === 'bullets' ? 'ul' : 'ol'}>`
}

/** One block as HTML. A ## heading is the bare <h2 id>: only docHTML wraps it in its section. `at` is a text block's id
    (ops.identify), drawn as data-block so a check or comment can point at it. */
export function blockHTML(b: Block, theme: Theme, at?: string): string {
  const named = at ? ` data-block="${esc(at)}"` : ''
  switch (b.type) {
    case 'heading': { const t = `h${b.level}`; return `<${t} id="${b.id}">${md(b.text)}</${t}>` }
    case 'paragraph': return `<p${named}>${md(b.text)}</p>`
    case 'bullets': case 'numbered': return named ? listHTML(b).replace(/^<(ul|ol) /, `<$1${named} `) : listHTML(b)
    case 'quote': return `<blockquote${named}><p>${md(b.text)}</p></blockquote>`
    case 'divider': return '<hr>'
    case 'code': return codeFigureHTML(b, theme)
    case 'figure': return figureHTML(b, theme, true, badgeHTML(b))
    case 'raw': return `<pre class="doc-raw">${esc(b.text)}</pre>`
  }
}

const sectionOpen = (id: string, text: string) => `<section class="doc-sec" id="${id}"><h2><button class="fold" type="button" aria-expanded="true" aria-controls="${id}-body" aria-label="Fold section"><i data-lucide="chevron-down"></i></button><a href="#${id}">${md(text)}</a></h2><div class="sec-body" id="${id}-body">`

function tocItem(s: OutlineSection): string {
  const link = `<a href="#${esc(s.id)}">${esc(s.text)}</a>`
  if (!s.children.length) return `<li class="l2">${link}</li>`
  const sub = `<ol>${s.children.map((c) => `<li class="l3"><a href="#${esc(c.id)}">${esc(c.text)}</a></li>`).join('')}</ol>`
  return `<li class="l2 toc-branch"><details class="toc-sec" open><summary>${link}</summary>${sub}</details></li>`
}

const tocList = (tree: OutlineSection[]) => `<ol>${tree.map(tocItem).join('')}</ol>`

export function docHTML(doc: Doc): string {
  const theme = doc.theme ?? DEFAULT_THEME, tree = outlineTree(doc)
  const list = tocList(tree)
  let body = '', open = false
  for (const { id, block: b } of identify(doc)) {
    if (b.type === 'heading' && b.level === 2) { body += `${open ? '</div></section>' : ''}${sectionOpen(b.id, b.text)}`; open = true; continue }
    body += blockHTML(b, theme, id)
  }
  if (open) body += '</div></section>'
  // No title, no header: an issue's body sits under the issue's own title.
  const head = !doc.title && !doc.subtitle ? '' : `<header class="doc-head"><h1 class="doc-title">${md(doc.title)}</h1>${doc.subtitle ? `<p class="doc-sub">${md(doc.subtitle)}</p>` : ''}</header>`
  const nav = tree.length ? `<nav class="doc-toc" aria-label="Contents"><p class="toc-h">Contents</p>${list}</nav>` : ''
  const mini = tree.length ? `<details class="doc-toc-mini"><summary>Contents</summary>${list}</details>` : ''
  return `<article class="doc theme-${theme}" data-links>${head}${nav}<div class="doc-body">${mini}${body}</div></article>`
}
