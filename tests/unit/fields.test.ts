// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { caretRange, redraw, setCaret, typed } from '@/app/edit/fields'

const field = (html: string, kind = 'md') => { const el = document.createElement('p'); el.dataset.kind = kind; el.contentEditable = 'true'; el.innerHTML = html; document.body.append(el); return el }

test('the cursor survives a redraw at the same plain-text offset', () => {
  const el = field('Revenue <span class="hl-focus">doubles</span>')
  setCaret(el, 10)
  expect(caretRange(el)).toEqual([10, 10])
  redraw(el, 'Revenue [[doubles]] now')
  setCaret(el, 10)
  expect(caretRange(el)).toEqual([10, 10])
  expect(el.innerHTML).toBe('Revenue <span class="hl-focus">doubles</span> now')
})

test('typed() maps the element text onto the markup; whatever the browser inserted is ignored', () => {
  const el = field('Revenue <span class="hl-focus">doubles</span>')
  el.innerHTML = 'Revenue <span class="hl-focus">doubless</span><b></b>'
  expect(typed(el, 'Revenue [[doubles]]')).toBe('Revenue [[doubless]]')
})

test('a plain-text field takes its text as it is', () => {
  const el = field('Q1', 'esc')
  el.textContent = 'Q1 ’27'
  expect(typed(el, 'Q1')).toBe('Q1 ’27')
})
