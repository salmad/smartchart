import { test, expect } from 'vitest'
import { imageFigure } from '@/app/components/docs/docPictures'

test('an uploaded image becomes an image figure with editor source', () => {
  const b = imageFigure('/i/x.webp', 'Screenshot')
  expect(b).toMatchObject({ type: 'figure', kind: 'image', body: { image: { src: '/i/x.webp', alt: 'Screenshot' }, source: 'Added in the editor.' } })
})
