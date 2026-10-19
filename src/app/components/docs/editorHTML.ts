/* The doc in edit mode as HTML: the read view's structure and classes (so the text sits where it does when read), with
   every text field editable and every block tagged with its key. Sections keep their wrapper, without the fold control
   or contents; figures are drawn as on the page and edit in place later (Task 6). */
import { md } from '@/engine/components/text'
import { blockHTML } from '@/engine/docs/render'
import type { Keyed } from '@/engine/docs/blocks'
import type { Theme } from '@/engine/types'
import type { Draft } from './useDocEdit'

const field = (key: string, hint: string, item?: number) =>
  ` data-field="${key}"${item === undefined ? '' : ` data-item="${item}"`} data-kind="md" contenteditable="true" spellcheck="true" data-hint="${hint}"`

/** A paragraph's hint shows only while it is focused and empty (Task 5 adds the slash menu to it). */
const WRITE = 'Write something'

function blockEdit({ key, block: b }: Keyed, theme: Theme): string {
  switch (b.type) {
    case 'heading': return `<h${b.level}${b.id ? ` id="${b.id}"` : ''} data-key="${key}"${field(key, b.level === 2 ? 'Heading' : 'Subheading')}>${md(b.text)}</h${b.level}>`
    case 'paragraph': return `<p data-key="${key}"${field(key, WRITE)}>${md(b.text)}</p>`
    case 'quote': return `<blockquote data-key="${key}"><p${field(key, 'Quote')}>${md(b.text)}</p></blockquote>`
    case 'bullets': return `<ul class="doc-list" data-key="${key}">${b.items.map((x, i) => `<li${field(key, 'List', i)}>${md(x)}</li>`).join('')}</ul>`
    case 'numbered': return `<ol class="doc-list" data-key="${key}">${b.items.map((x, i) => `<li><span${field(key, 'List', i)}>${md(x)}</span></li>`).join('')}</ol>`
    // Not text: drawn as read, selectable as a whole.
    default: return blockHTML(b, theme).replace(/^<(\w+)/, `<$1 data-key="${key}" data-block-select tabindex="-1"`)
  }
}

export function editorHTML(d: Draft, theme: Theme): string {
  let body = '', open = false
  for (const k of d.blocks) {
    if (k.block.type === 'heading' && k.block.level === 2) { body += `${open ? '</div></section>' : ''}<section class="doc-sec">${blockEdit(k, theme)}<div class="sec-body">`; open = true; continue }
    body += blockEdit(k, theme)
  }
  if (open) body += '</div></section>'
  const head = `<header class="doc-head"><h1 class="doc-title" data-head="title"${field('', 'Title').replace(' data-field=""', '')}>${md(d.title)}</h1>`
    + `<p class="doc-sub" data-head="subtitle"${field('', 'Subtitle').replace(' data-field=""', '')}>${md(d.subtitle)}</p></header>`
  return `<article class="doc theme-${theme} doc-editing" data-links>${head}<div class="doc-body">${body}</div></article>`
}
