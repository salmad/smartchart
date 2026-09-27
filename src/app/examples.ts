/* Example prompts, one per common job: the site's prompt and the new-deck prompt offer the same three. */
import type { Style } from '@/engine/types'

/** [chip label, the style it is written for, the prompt it fills in]. */
export const EXAMPLES: readonly [string, Style, string][] = [
  ['ARR bridge for the board', 'consulting', 'ARR grew from £9.8m to £17.5m in FY26: new customers +£6.2m, expansion +£2.1m, churn −£1.4m, pricing +£0.8m. Make the bridge for the board.'],
  ['The problem, for a seed deck', 'pitch', 'Seed pitch, the problem: a typical UK SME puts £540k a year of business spend on personal cards and earns nothing back. Founders carry the personal guarantee; banks cap SME credit at £25k.'],
  ['Compare three plans', 'consulting', 'Compare our plans. Starter £29 a month: 3 seats, email support, 5 integrations. Team £79: 10 seats, priority support, 20 integrations. Scale £199: unlimited seats, a dedicated manager, every integration. Recommend Team.'],
]
