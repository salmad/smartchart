import { test, expect } from 'vitest'
import { preloadEditor, staticClosure } from '../../vite/preload-editor'

const chunk = (fileName: string, imports: string[] = [], moduleIds: string[] = []) => ({ type: 'chunk' as const, fileName, imports, moduleIds })
const html = '<script>var editor = /*editor-chunks*/[]</script>'
const run = (bundle: Record<string, unknown>, entry = 'assets/index-a.js') => {
  const plugin = preloadEditor(), t = plugin.transformIndexHtml
  const handler = typeof t === 'function' ? t : (t as { handler: (h: string, c: unknown) => string }).handler
  return (handler as (h: string, c: unknown) => string).call({}, html, { bundle, chunk: bundle[entry] })
}

test('the editor and what it imports are listed, minus what the entry already loads', () => {
  const bundle = {
    'assets/index-a.js': chunk('assets/index-a.js', ['assets/react-b.js']),
    'assets/react-b.js': chunk('assets/react-b.js'),
    'assets/App-c.js': chunk('assets/App-c.js', ['assets/react-b.js', 'assets/slide-d.js', 'assets/utils-e.js'], ['/x/src/app/App.tsx', '/x/src/app/Other.tsx']),
    'assets/slide-d.js': chunk('assets/slide-d.js', ['assets/utils-e.js']),
    'assets/utils-e.js': chunk('assets/utils-e.js'),
    'assets/style.css': { type: 'asset' },
  }
  expect(run(bundle)).toBe('<script>var editor = /*editor-chunks*/["/assets/App-c.js","/assets/slide-d.js","/assets/utils-e.js"]</script>')
})

test('a build without the editor chunk leaves the list empty', () => {
  expect(run({ 'assets/index-a.js': chunk('assets/index-a.js') })).toBe(html)
})

test('a shared chunk is listed once, and a cycle does not loop', () => {
  const a = chunk('a.js', ['b.js']), b = chunk('b.js', ['a.js', 'c.js']), c = chunk('c.js')
  expect(staticClosure(a, new Map([a, b, c].map((x) => [x.fileName, x])), new Set())).toEqual(['a.js', 'b.js', 'c.js'])
})
