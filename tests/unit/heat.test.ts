import { test, expect } from 'vitest'
import { heatSteps } from '@/engine/components/heat'

test('heat steps band each figure by its share of the largest: 0.1, 0.25, 0.4, 0.65', () => {
  expect(heatSteps([632, 400, 250, 157, 53, 5])).toEqual([5, 4, 3, 2, 1, 1])
  expect(heatSteps([100, 65, 64, 40, 39, 25, 24, 10, 9])).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1])
})

test('null, zero and negatives are unshaded; nothing at all is all zeros', () => {
  expect(heatSteps([null, -61, 0, 10])).toEqual([0, 0, 0, 5])
  expect(heatSteps([null, -1])).toEqual([0, 0])
})
