/**
 * Slide generation utility with dynamic AI-style insights
 * Analyzes data to generate bespoke commentary (3-5 insights)
 * Uses Gemini Flash (primary) and Claude Haiku (fallback) for LLM generation
 */

import type { ChartConfiguration } from '@/shared/types/chart'
import { slideAIService } from '@/services/ai/slideAIService'

export interface SlideInsight {
  text: string
}

export interface SlideContent {
  title: string
  subtitle?: string
  chartTitle: string
  chartUnits: string
  insights: SlideInsight[]
}

/**
 * Generate slide content from chart configuration using LLM
 * Uses Gemini Flash (primary) and Claude Haiku (fallback)
 */
export async function generateSlideContent(config: ChartConfiguration): Promise<SlideContent> {
  const { data, styling } = config
  const { xAxisKey, seriesNames } = data

  // Filter out hidden series
  const visibleSeries = seriesNames.filter(
    name => !styling.hiddenSeries.includes(name)
  )

  // Generate chart title (descriptive, not action)
  const chartTitle = styling.title || `${visibleSeries.join(', ')} by ${xAxisKey}`

  try {
    // Use LLM to generate insights, action title, subtitle, and units all at once
    const llmResponse = await slideAIService.generateSlideContent(data)

    if (llmResponse.success && llmResponse.insights && llmResponse.actionTitle) {
      return {
        title: llmResponse.actionTitle,
        subtitle: llmResponse.subtitle || undefined,
        chartTitle,
        chartUnits: llmResponse.units || 'units',
        insights: llmResponse.insights,
      }
    }

    // If LLM fails, throw to trigger fallback logic. todo: remove, just return error message to user instead of bad quality output
    throw new Error('LLM generation failed')
  } catch (error) {
    console.error('Slide generation error, using fallback:', error)

    // Fallback to simple generation if LLM fails
    const { description } = data
    let userObjective = ''
    if (description) {
      const match = description.match(/(?:objective|goal|aim):\s*(.+?)(?:\.|$)/i)
      if (match) {
        userObjective = match[1].trim()
      }
    }

    return {
      title: userObjective
        ? `Optimize ${seriesNames[0] || 'performance'} to ${userObjective.toLowerCase()}`
        : `Strategic recommendations based on ${xAxisKey} analysis`,
      subtitle: `Insights from ${seriesNames.length} key metrics`,
      chartTitle,
      chartUnits: 'units',
      insights: [
        { text: 'Data analysis indicates notable patterns worth deeper investigation' },
        { text: 'Performance metrics suggest areas for strategic focus' },
        { text: 'Strategic opportunities identified for optimization' },
      ],
    }
  }
}
