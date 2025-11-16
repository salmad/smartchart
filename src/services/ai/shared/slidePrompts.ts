import type { ChartData } from '@/shared/types/chart'
import type { SlideInsight } from '../types'

/**
 * Build prompt for generating complete slide content (insights, title, subtitle, units)
 * Shared across Gemini Flash and Claude Haiku
 */
export function buildSlideGenerationPrompt(data: ChartData): string {
  return `You are a McKinsey-style business consultant analyzing data for a presentation slide.

Chart Data:
${JSON.stringify(data, null, 2)}

Your task is to generate 3-5 bespoke insights (prefer 3) following the Minto Pyramid Principle.
These insights will support an action-oriented title on a consulting slide.

Guidelines:
- Analyze actual data patterns, trends, growth rates, and comparisons
- Generate insights that are SPECIFIC to this data (not generic templates)
- Each insight should be 1-2 sentences maximum
- Focus on the "so what" - actionable observations
- Consider the user's objective if provided in description

Also generate:
1. An action-oriented title (the conclusion/recommendation)
2. A subtitle (context about the data)
3. Infer the appropriate units ($, %, units, etc.)

Return ONLY a valid JSON object with this structure:
{
  "actionTitle": "Verb-based recommendation based on data findings",
  "subtitle": "Brief context about the analysis",
  "insights": [
    { "text": "First key insight from the data" },
    { "text": "Second supporting insight" },
    { "text": "Third insight (optional)" }
  ],
  "units": "$" or "%" or "units" etc.
}

Example for sales data:
{
  "actionTitle": "Prioritize Product A to capitalize on 45% growth momentum",
  "subtitle": "Q1-Q4 sales performance across four product lines",
  "insights": [
    { "text": "Product A demonstrates consistent 45% growth trajectory, outpacing all competitors" },
    { "text": "Q4 surge reaching $278K indicates strong market demand and scalability potential" },
    { "text": "Product B volatility (139K to 278K swing) suggests need for demand stabilization" }
  ],
  "units": "$"
}`
}

/**
 * Build prompt for generating action-oriented title based on existing insights
 * Shared across Gemini Flash and Claude Haiku
 */
export function buildActionTitlePrompt(insights: SlideInsight[], data: ChartData): string {
  return `Generate an action-oriented slide title (McKinsey style) based on these insights and data.

Insights:
${insights.map((i, idx) => `${idx + 1}. ${i.text}`).join('\n')}

Data Context:
${JSON.stringify(data, null, 2)}

The title should be:
- Action-oriented (starts with a verb or recommendation)
- The conclusion that the insights support
- Answers "so what should we do?"

Return JSON only:
{
  "actionTitle": "Action-oriented recommendation",
  "subtitle": "Brief context"
}`
}

/**
 * Build prompt for inferring data units
 * Shared across Gemini Flash and Claude Haiku
 */
export function buildUnitsInferencePrompt(data: ChartData): string {
  return `Infer the appropriate units for this chart data.

Data:
${JSON.stringify(data, null, 2)}

Return only one of: $, %, units, kg, °C, or another appropriate unit.
Return JSON only: { "units": "$" }`
}
