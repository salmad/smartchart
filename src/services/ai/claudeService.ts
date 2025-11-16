import Anthropic from '@anthropic-ai/sdk'
import type { ChartConfiguration, ChartData } from '@/shared/types/chart'
import type { AIService, ChatResponse, SlideGenerationResponse, SlideInsight } from './types'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

if (!apiKey) {
  console.warn('VITE_ANTHROPIC_API_KEY not found in environment variables')
}

const anthropic = apiKey ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) : null

class ClaudeService implements AIService {
  async modifyChart(
    currentConfig: ChartConfiguration,
    userMessage: string
  ): Promise<ChatResponse> {
    if (!anthropic) {
      return {
        success: false,
        message: 'Claude API key is not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
      }
    }

    try {
      const prompt = `You are a chart configuration expert. The user wants to modify their chart.

Current Chart Configuration:
${JSON.stringify(currentConfig, null, 2)}

User Request: "${userMessage}"

Your task is to:
1. Analyze the user's request
2. Modify the chart configuration accordingly
3. Return ONLY a valid JSON object with two keys:
   - "configuration": The updated ChartConfiguration object
   - "message": A friendly message explaining what you changed (1-2 sentences)

Rules:
- Keep data structure consistent (same xAxisKey format)
- Only modify what the user asked for
- Maintain premium color palette: purple (#8B5CF6), emerald (#10B981), rose (#F43F5E), blue (#3B82F6), violet (#8B5CF6)
- Chart types: 'bar', 'line', or 'combined'
- Series types: 'bar' or 'line'
- If user asks to change data, modify dataPoints array
- If user asks about styling (colors, type, labels), modify styling object
- Preserve seriesNames consistency with dataPoints keys
- Return valid JSON only, no markdown or code blocks

Example response format:
{
  "configuration": { ...updated config... },
  "message": "I've changed your chart to a line chart and updated the colors to match your brand."
}`

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const textContent = message.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const text = textContent.text

      // Clean up response (remove markdown code blocks if present)
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      try {
        const parsed = JSON.parse(cleanedText)

        if (!parsed.configuration || !parsed.message) {
          throw new Error('Invalid response format from AI')
        }

        // Validate the configuration has required structure
        if (!parsed.configuration.data || !parsed.configuration.styling) {
          throw new Error('Configuration missing data or styling')
        }

        return {
          success: true,
          configuration: parsed.configuration,
          message: parsed.message,
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', cleanedText, parseError)
        return {
          success: false,
          message: 'I had trouble understanding how to modify your chart. Could you try rephrasing your request?',
        }
      }
    } catch (error) {
      console.error('Claude API error:', error)
      // Return error with enough detail to trigger fallback
      return {
        success: false,
        message: 'Claude API request failed. Trying fallback provider...',
      }
    }
  }

  async generateSlideInsights(data: ChartData): Promise<SlideGenerationResponse> {
    if (!anthropic) {
      return {
        success: false,
        error: 'Claude API key is not configured',
      }
    }

    try {
      const prompt = `You are a McKinsey-style business consultant analyzing data for a presentation slide.

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

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const textContent = message.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const text = textContent.text
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      try {
        const parsed = JSON.parse(cleanedText)

        return {
          success: true,
          actionTitle: parsed.actionTitle,
          subtitle: parsed.subtitle,
          insights: parsed.insights || [],
          units: parsed.units || 'units',
        }
      } catch (parseError) {
        console.error('Failed to parse Claude slide response:', cleanedText, parseError)
        return {
          success: false,
          error: 'Failed to parse AI response',
        }
      }
    } catch (error) {
      console.error('Claude slide generation error:', error)
      return {
        success: false,
        error: 'API request failed',
      }
    }
  }

  async generateActionTitle(
    insights: SlideInsight[],
    data: ChartData
  ): Promise<{ actionTitle: string; subtitle: string }> {
    if (!anthropic) {
      // Fallback to simple generation
      const { seriesNames, xAxisKey, description } = data
      let userObjective = ''
      if (description) {
        const match = description.match(/(?:objective|goal|aim):\s*(.+?)(?:\.|$)/i)
        if (match) {
          userObjective = match[1].trim()
        }
      }

      return {
        actionTitle: userObjective
          ? `Optimize ${seriesNames[0]} to ${userObjective.toLowerCase()}`
          : `Strategic recommendations based on ${xAxisKey} analysis`,
        subtitle: `Insights from ${seriesNames.length} key metrics`,
      }
    }

    try {
      const prompt = `Generate an action-oriented slide title (McKinsey style) based on these insights and data.

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

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const textContent = message.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const text = textContent.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const parsed = JSON.parse(text)
      return {
        actionTitle: parsed.actionTitle,
        subtitle: parsed.subtitle,
      }
    } catch (error) {
      console.error('Claude action title error:', error)
      const { seriesNames, xAxisKey } = data
      return {
        actionTitle: `Strategic recommendations based on ${xAxisKey} analysis`,
        subtitle: `Insights from ${seriesNames.length} key metrics`,
      }
    }
  }

  async inferUnits(data: ChartData): Promise<string> {
    if (!anthropic) {
      // Fallback to simple inference
      const { description, seriesNames } = data
      if (description?.toLowerCase().includes('sales') || description?.toLowerCase().includes('revenue')) {
        return '$'
      }
      if (seriesNames.join(' ').toLowerCase().includes('percent')) {
        return '%'
      }
      return 'units'
    }

    try {
      const prompt = `Infer the appropriate units for this chart data.

Data:
${JSON.stringify(data, null, 2)}

Return only one of: $, %, units, kg, °C, or another appropriate unit.
Return JSON only: { "units": "$" }`

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const textContent = message.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const text = textContent.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const parsed = JSON.parse(text)
      return parsed.units || 'units'
    } catch (error) {
      console.error('Claude units inference error:', error)
      return 'units'
    }
  }
}

export const claudeService = new ClaudeService()