import { describe, expect, it } from 'vitest'
import { parseDoc } from '@/engine/docs/parse'
import { toProse } from '@/engine/docs/prose'
import { docOf, saveHardBlockers } from '@/app/components/docs/useDocEdit'
import { DOC_STARTERS } from '@/engine/starters'

describe('saveHardBlockers on editor round-trip', () => {
  for (const s of DOC_STARTERS) {
    it(s.id, () => {
      const { doc } = parseDoc(s.markdown.join('\n'))
      const json = toProse({ title: doc.title, subtitle: doc.subtitle ?? '', blocks: doc.blocks })
      const next = docOf(doc, json)
      expect(saveHardBlockers(next, json), saveHardBlockers(next, json).join(' | ')).toEqual([])
    })
  }
})
