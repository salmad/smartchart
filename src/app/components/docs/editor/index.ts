/* The doc editor's extensions: the schema, the figure atom, the keys and rules, and the smaller parts. */
import type { AnyExtension } from '@tiptap/core'
import { Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions'
import { Behaviour, type BehaviourOptions } from './behaviour'
import { Figure, type FigureHost } from './figure'
import { LinkTails, UniqueIds } from './extras'
import { schemaExtensions } from './schema'

const HINT: Record<string, string> = { docTitle: 'Title', docSubtitle: 'Subtitle', sectionHead: 'Heading', heading: 'Subheading', paragraph: 'Write something' }

export function docExtensions(host: FigureHost, behaviour: BehaviourOptions): AnyExtension[] {
  return [
    ...schemaExtensions(), Figure.configure({ host }), Behaviour.configure(behaviour), LinkTails, UniqueIds, UndoRedo, Gapcursor,
    // An empty paragraph says so only while it has the cursor; the rest show what they are.
    Placeholder.configure({ showOnlyCurrent: false, placeholder: ({ node, editor }) => {
      if (node.type.name !== 'paragraph') return HINT[node.type.name] ?? ''
      const { $from } = editor.state.selection
      return $from.parent === node ? HINT.paragraph : ''
    } }),
  ]
}
