import { test, expect } from 'vitest'
import { EXAMPLES } from '@/engine/slides/examples'
import { shapeOf } from './shape'
import type { Slide, Style } from '@/engine/types'

const specFor = ({ consulting, pitch, name: _n, ...shared }: (typeof EXAMPLES)[number], style: Style) => ({ ...shared, ...(style === 'pitch' ? pitch : consulting) }) as Slide
test('example shapes are locked', async () => {
  const shapes = EXAMPLES.map((e) => ({ name: e.name, consulting: shapeOf(specFor(e, 'consulting')), pitch: shapeOf(specFor(e, 'pitch')) }))
  await expect(JSON.stringify(shapes, null, 1)).toMatchFileSnapshot('../fixtures/example-shapes.json')
})
