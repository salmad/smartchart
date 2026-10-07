// The judge (spec §4): did the slide meet the case's expectations, and when not, what in Occam's text confused the
// agent. It reads the whole transcript, so Occam's own feedback (write issues, check_slide's verdicts) is evidence.
import type { Slide, Style } from '@/engine/types'
import { SOURCES, type Case, type Transcript } from './types'

export interface Schema { type: string; additionalProperties?: boolean; required?: string[]; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; minItems?: number; maxItems?: number }
const str: Schema = { type: 'string' }, yes: Schema = { type: 'boolean' }
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const list = (items: Schema, n?: number): Schema => ({ type: 'array', items, ...(n === undefined ? {} : { minItems: n, maxItems: n }) })

/** Asked of every slide: a consulting title states the so-what; the body proves the title. */
export const genericQuestions = (style: Style): { id: string; q: string }[] => [
  ...(style === 'consulting' ? [{ id: 'G1', q: 'Does the title state a so-what (a conclusion the reader should take away), not a topic label?' }] : []),
  { id: 'G2', q: 'Does the body (the table, chart, cards or steps, and any notes) prove what the title and subtitle claim?' },
]

export const judgeSchema = (generic: number, questions: number): Schema => obj({
  generic: list(obj({ id: str, yes, why: str }), generic),
  case: list(obj({ q: str, yes, why: str }), questions),
  numbers: list(obj({ value: str, kind: { type: 'string', enum: ['derived', 'invented'] }, why: str })),
  magic: obj({ presentAsIs: yes, fix: str }),
  confusedBy: list(obj({ mismatch: str, quote: str, source: { type: 'string', enum: [...SOURCES] }, why: str, fix: str })),
})

const tool = (name: string) => name.replace(/^mcp__smartchart__/, '')
/** Every call in order, with what Occam answered (long results trimmed), then the reply to the user. */
export const transcriptText = (t: Transcript): string => [
  ...t.calls.map((x, i) => `${i + 1}. ${tool(x.name)} ${JSON.stringify(x.input).slice(0, 1500)}\n   → ${x.isError ? 'ERROR ' : ''}${x.result.slice(0, 3000)}`),
  `Reply to the user:\n${t.finalText}`,
].join('\n')

export interface JudgeInput { c: Case; request: string; t: Transcript; slide: Slide; style: Style; lints: string[]; unknown: string[] }
export function judgePrompt({ c, request, t, slide, style, lints, unknown }: JudgeInput): string {
  const generic = genericQuestions(style)
  return [
    'You are judging one slide an AI agent made in Occam for a first-time user, and diagnosing what in Occam led the agent wrong. Be strict and concrete: the user will present the slide to a board or to investors without checking it closely.',
    'First Read slide.png in this folder: the slide as rendered at 1920×1080. Judge what the reader sees; use the JSON only to read values exactly.',
    `Deck style: ${style}.`,
    `The user's request:\n<<<\n${request}\n>>>`,
    `What the agent did (Occam tool calls and answers, including its issues, warnings and check_slide verdicts), then its reply:\n<<<\n${transcriptText(t)}\n>>>`,
    `Final slide JSON:\n${JSON.stringify(slide)}`,
    `Measured on the rendered slide: ${lints.length ? lints.join('; ') : 'no fit issues or layout lints'}.`,
    `Answer "generic" in this order, copying each id:\n${generic.map((g) => `${g.id}. ${g.q}`).join('\n')}`,
    c.questions.length ? `Answer "case" in this order, copying each question into q:\n${c.questions.map((q, i) => `${i + 1}. ${q.q}`).join('\n')}` : 'Answer "case" with an empty list.',
    unknown.length
      ? `Answer "numbers" for each of these figures on the slide that the request does not state, in this order: ${unknown.join(', ')}. "derived" if it follows from the request (a sum, share or difference of its figures, or a count or year it implies); "invented" if not.`
      : 'Answer "numbers" with an empty list.',
    'Answer "magic": would a first-time user present this slide unchanged? If not, the one thing they would fix first.',
    'Answer "confusedBy": for every "no" above, every invented figure and every Occam issue the agent left unfixed, find in the transcript the text that led the agent there: a server instruction, a tool description, a template card or the guide (from get_guide or get_template results), or a tool result it misread or ignored. Quote it exactly, name its source, say why it misled, and propose the smallest fix to that text. Use source "none" when the agent simply erred against clear guidance, and say which guidance. An empty list when nothing went wrong.',
  ].join('\n\n')
}
