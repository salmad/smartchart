import { test, expect } from 'vitest'
import { STARTERS, starterSlide } from '@/engine/starters'
import { shapeOf } from './shape'
import locked from '../fixtures/example-shapes.json'

// The starters keep the structure locked from the 788f4d7 examples (names from the lock, by position). Never -u.
test('starter shapes match the locked example shapes', async () => {
  const shapes = STARTERS.map((s, i) => ({ name: locked[i]?.name, consulting: shapeOf(starterSlide(s, 'consulting')), pitch: shapeOf(starterSlide(s, 'pitch')) }))
  await expect(JSON.stringify(shapes, null, 1)).toMatchFileSnapshot('../fixtures/example-shapes.json')
})
