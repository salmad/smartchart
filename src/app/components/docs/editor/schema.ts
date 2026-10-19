/* The doc editor's schema: exactly what the format can hold, drawn as the read view draws it (section.doc-sec > h2 +
   div.sec-body), so doc.css and components.css apply unchanged. Every container says what the Block union says it may
   hold, and nothing the file cannot write is offered: no italic, no code marks, no hard breaks, one quote text. */
import { Mark, markInputRule, Node } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Heading from '@tiptap/extension-heading'
import Bold from '@tiptap/extension-bold'
import Link from '@tiptap/extension-link'
import Blockquote from '@tiptap/extension-blockquote'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'

/** The format's own link addresses: http(s), or #id for a section. (LinkBox checks the same.) */
export const LINK_URI = /^(https?:\/\/[^\s)]+|#[\w-]+)$/

const span = (name: string, cls: string, rule?: RegExp, key?: string) => Mark.create({
  name,
  parseHTML: () => [{ tag: `span.${cls}` }],
  renderHTML: () => ['span', { class: cls }, 0],
  addInputRules() { return rule ? [markInputRule({ find: rule, type: this.type })] : [] },
  addKeyboardShortcuts() { return key ? { [key]: () => this.editor.commands.toggleMark(name) } : {} },
})
/** `[[words]]`, typed, becomes the Focus mark at once, so what is on screen is what the file will say. */
export const Focus = span('focus', 'hl-focus', /(?:\[\[)([^\]]+)(?:\]\])$/, 'Mod-Shift-h')
export const Neg = span('neg', 'hl-neg')
export const Pos = span('pos', 'hl-pos')

export const DocTitle = Node.create({ name: 'docTitle', content: 'inline*', marks: '_', defining: true, parseHTML: () => [{ tag: 'h1.doc-title' }], renderHTML: () => ['h1', { class: 'doc-title' }, 0] })
export const DocSubtitle = Node.create({ name: 'docSubtitle', content: 'inline*', marks: '_', defining: true, parseHTML: () => [{ tag: 'p.doc-sub' }], renderHTML: () => ['p', { class: 'doc-sub' }, 0] })

export const SectionHead = Node.create({
  name: 'sectionHead', content: 'inline*', marks: '_', defining: true,
  addAttributes: () => ({ id: { default: '', rendered: false } }),
  renderHTML: ({ node }) => ['h2', node.attrs.id ? { id: node.attrs.id as string } : {}, 0],
})
export const SectionBody = Node.create({ name: 'sectionBody', content: 'block*', renderHTML: () => ['div', { class: 'sec-body' }, 0] })
export const Section = Node.create({ name: 'section', content: 'sectionHead sectionBody', renderHTML: () => ['section', { class: 'doc-sec' }, 0] })

/** The base nodes and marks, in the shape of the Block union. */
export const schemaExtensions = () => [
  Document.extend({ content: 'docTitle docSubtitle block* section*' }),
  Paragraph, Text, Bold, Focus, Neg, Pos,
  Link.configure({ autolink: false, linkOnPaste: false, openOnClick: false, isAllowedUri: (url) => LINK_URI.test(url), HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
  // Subheadings only: a section's own heading is its sectionHead.
  Heading.configure({ levels: [3] }).extend({
    addAttributes: () => ({ level: { default: 3 }, id: { default: '', rendered: false } }),
    renderHTML: ({ node }) => ['h3', node.attrs.id ? { id: node.attrs.id as string } : {}, 0],
    addInputRules: () => [],
  }),
  // A quote is one text; a list item is its words and at most one list under it.
  Blockquote.extend({ content: 'paragraph' }),
  HorizontalRule,
  BulletList.configure({ HTMLAttributes: { class: 'doc-list' } }), OrderedList.configure({ HTMLAttributes: { class: 'doc-list' } }),
  ListItem.extend({ content: 'paragraph (bulletList | orderedList)?' }),
  DocTitle, DocSubtitle, Section, SectionHead, SectionBody,
]
