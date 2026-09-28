/* Example prompts, one per common job: the site's prompt and the new-deck prompt offer the same three. */
import type { Style } from '@/engine/types'

/** [chip label, the style it is written for, the prompt it fills in]. */
export const EXAMPLES: readonly [string, Style, string][] = [
  ['A report', 'consulting', 'Turn this into slides for the exec team. Q3 review: revenue grew from £4.2m to £5.1m (+21%). New customers added £0.7m and expansion £0.4m; churn cost £0.2m. Gross margin rose from 61% to 66% after we moved hosting. Two risks: the enterprise pipeline is thin (3 deals over £100k, down from 7), and hiring is behind plan by 4 engineers. Ask: approve two enterprise sales hires in Q4.'],
  ['A seed pitch', 'pitch', 'Seed pitch, the market: 5.7m UK SMEs; 19% already use a business credit card; 30–40% say they need revolving credit; the EU and UK SME credit gap is about €400bn. Say why now.'],
  ['A business case', 'consulting', 'Business case for a self-serve plan. Today every customer goes through sales: 38-day cycle, £9k average first-year value, CAC £6k. A self-serve plan at £49 a month would reach teams under 10 people, about 60% of inbound leads we reject today. Pilot: 120 sign-ups in 6 weeks, 14% converted to paid. Recommend launching in Q1.'],
]
