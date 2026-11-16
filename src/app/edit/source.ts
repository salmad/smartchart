/* A slide as its source file (the JSON the agent writes) and back, checked by the same schema as any writer's slide. */
import { isTemplate, upgrade, validate } from '@/engine/slides/schema'
import type { Slide, Style } from '@/engine/types'

export const slideSource = (slide: Slide): string => `${JSON.stringify(slide, null, 2)}\n`

export interface ReadSource { slide: Slide | null; error: string | null; notes: string[] }

/** `from`: the slide the file was opened on. Errors it already had don't hold the file back; new ones do. */
export function readSlideSource(text: string, style: Style, from?: Slide): ReadSource {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (e) { return { slide: null, error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`, notes: [] } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { slide: null, error: 'The slide is one JSON object, { "template": … }.', notes: [] }
  if (!isTemplate((raw as { template?: unknown }).template)) return { slide: null, error: validate(raw, style).errors[0] ?? 'The slide needs a template.', notes: [] }
  // A new error is what any writer's save is refused for, so the slide isn't drawn or saved until it's fixed; warnings
  // only report.
  const slide = upgrade(raw as Slide), v = validate(slide, style), had = new Set(from ? validate(from, style).errors : [])
  return { slide: v.errors.some((e) => !had.has(e)) ? null : slide, error: null, notes: [...v.errors, ...v.warnings] }
}

/** A whole deck as one file: its writing style and its slides in order, each with its id. */
export const deckSource = (style: Style, items: readonly { id: string; slide: Slide }[]): string =>
  `${JSON.stringify({ style, slides: items.map((it) => ({ id: it.id, ...it.slide })) }, null, 2)}\n`
