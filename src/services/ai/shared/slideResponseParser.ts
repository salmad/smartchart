import type { SlideGenerationResponse } from '../types'

/**
 * Parse slide generation response from LLM
 * Shared across Gemini Flash and Claude Haiku
 */
export function parseSlideGenerationResponse(rawText: string): SlideGenerationResponse {
  const cleanedText = rawText
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
    console.error('Failed to parse slide generation response:', cleanedText, parseError)
    return {
      success: false,
      error: 'Failed to parse AI response',
    }
  }
}

/**
 * Parse action title response from LLM
 * Shared across Gemini Flash and Claude Haiku
 */
export function parseActionTitleResponse(rawText: string): { actionTitle: string; subtitle: string } | null {
  const cleanedText = rawText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleanedText)
    return {
      actionTitle: parsed.actionTitle,
      subtitle: parsed.subtitle,
    }
  } catch (parseError) {
    console.error('Failed to parse action title response:', cleanedText, parseError)
    return null
  }
}

/**
 * Parse units inference response from LLM
 * Shared across Gemini Flash and Claude Haiku
 */
export function parseUnitsResponse(rawText: string): string | null {
  const cleanedText = rawText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleanedText)
    return parsed.units || null
  } catch (parseError) {
    console.error('Failed to parse units response:', cleanedText, parseError)
    return null
  }
}

/**
 * Fallback generation for when LLM fails
 */
export function generateFallbackActionTitle(seriesNames: string[], xAxisKey: string, description?: string): { actionTitle: string; subtitle: string } {
  let userObjective = ''
  if (description) {
    const match = description.match(/(?:objective|goal|aim):\s*(.+?)(?:\.|$)/i)
    if (match) {
      userObjective = match[1].trim()
    }
  }

  return {
    actionTitle: userObjective
      ? `Optimize ${seriesNames[0] || 'performance'} to ${userObjective.toLowerCase()}`
      : `Strategic recommendations based on ${xAxisKey} analysis`,
    subtitle: `Insights from ${seriesNames.length} key metrics`,
  }
}

/**
 * Fallback unit inference for when LLM fails
 */
export function generateFallbackUnits(description?: string, seriesNames?: string[]): string {
  if (description?.toLowerCase().includes('sales') || description?.toLowerCase().includes('revenue')) {
    return '$'
  }
  if (seriesNames && seriesNames.join(' ').toLowerCase().includes('percent')) {
    return '%'
  }
  return 'units'
}
