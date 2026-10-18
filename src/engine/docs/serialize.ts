/* Doc → doc file. Blocks are separated by a blank line; ids are always written, so a file keeps the ids it was given. */
import type { Block, Doc } from './types.js'

/** A paragraph that would read as another block (or starts with the escape itself) is written after a \. */
const LOOKS_LIKE = /^(- |\d+\. |#|>|```|---\s*$|\\)/

function block(b: Block): string {
  switch (b.type) {
    case 'heading': return `${'#'.repeat(b.level)} ${b.text} {#${b.id}}`
    case 'paragraph': return LOOKS_LIKE.test(b.text) ? `\\${b.text}` : b.text
    case 'bullets': return b.items.map((x) => `- ${x}`).join('\n')
    case 'numbered': return b.items.map((x, i) => `${i + 1}. ${x}`).join('\n')
    case 'quote': return `> ${b.text}`
    case 'divider': return '---'
    case 'code': {
      // The fence is longer than any run of backticks inside, so the code comes back whole.
      const fence = '`'.repeat(Math.max(3, ...(b.text.match(/`+/g) ?? []).map((r) => r.length + 1)))
      return `${fence}${b.lang}\n${b.text}\n${fence}`
    }
    case 'figure': return `\`\`\`occam:${b.kind} {#${b.id}}\n${JSON.stringify(b.body, null, 2)}\n\`\`\``
    case 'raw': return b.text
  }
}

export function serializeDoc(doc: Doc): string {
  const front = [`title: ${doc.title}`, doc.subtitle !== undefined && `subtitle: ${doc.subtitle}`, doc.theme && `theme: ${doc.theme}`, doc.accent && `accent: ${doc.accent}`].filter(Boolean)
  return `---\n${front.join('\n')}\n---\n\n${doc.blocks.map(block).join('\n\n')}\n`
}
