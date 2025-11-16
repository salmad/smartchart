/**
 * Slide AI Service with Gemini Flash as primary and Claude Haiku as fallback
 */

import type { ChartData } from '@/shared/types/chart'
import type { SlideGenerationResponse, SlideInsight } from './types'
import { geminiService } from './geminiService'
import { claudeService } from './claudeService'

class SlideAIService {
  /**
   * Generate slide insights, title, subtitle, and units using LLM
   * Primary: Gemini Flash, Fallback: Claude Haiku
   */
  async generateSlideContent(data: ChartData): Promise<SlideGenerationResponse> {
    // Try Gemini Flash first
    console.log('Attempting slide generation with Gemini Flash...')
    const geminiResponse = await geminiService.generateSlideInsights?.(data)

    if (geminiResponse?.success) {
      console.log('Successfully generated slide with Gemini Flash')
      return geminiResponse
    }

    // If Gemini fails, try Claude Haiku
    console.log('Gemini failed, trying Claude Haiku fallback...')
    const claudeResponse = await claudeService.generateSlideInsights?.(data)

    if (claudeResponse?.success) {
      console.log('Successfully generated slide with Claude Haiku')
      return claudeResponse
    }

    // Both failed, return error
    console.error('Both AI services failed for slide generation')
    return {
      success: false,
      error: 'Both AI services are unavailable. Please check your API keys.',
    }
  }

  /**
   * Generate action-oriented title based on insights
   * Primary: Gemini Flash, Fallback: Claude Haiku
   */
  async generateActionTitle(
    insights: SlideInsight[],
    data: ChartData
  ): Promise<{ actionTitle: string; subtitle: string }> {
    // Try Gemini Flash first
    try {
      if (geminiService.generateActionTitle) {
        const result = await geminiService.generateActionTitle(insights, data)
        if (result?.actionTitle) {
          return result
        }
      }
    } catch (error) {
      console.error('Gemini action title failed:', error)
    }

    // Try Claude Haiku fallback
    try {
      if (claudeService.generateActionTitle) {
        const result = await claudeService.generateActionTitle(insights, data)
        if (result?.actionTitle) {
          return result
        }
      }
    } catch (error) {
      console.error('Claude action title failed:', error)
    }

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
        ? `Optimize ${seriesNames[0] || 'performance'} to ${userObjective.toLowerCase()}`
        : `Strategic recommendations based on ${xAxisKey} analysis`,
      subtitle: `Insights from ${seriesNames.length} key metrics`,
    }
  }

  /**
   * Infer units from data using LLM
   * Primary: Gemini Flash, Fallback: Claude Haiku
   */
  async inferUnits(data: ChartData): Promise<string> {
    // Try Gemini Flash first
    try {
      if (geminiService.inferUnits) {
        const units = await geminiService.inferUnits(data)
        if (units) {
          return units
        }
      }
    } catch (error) {
      console.error('Gemini units inference failed:', error)
    }

    // Try Claude Haiku fallback
    try {
      if (claudeService.inferUnits) {
        const units = await claudeService.inferUnits(data)
        if (units) {
          return units
        }
      }
    } catch (error) {
      console.error('Claude units inference failed:', error)
    }

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
}

export const slideAIService = new SlideAIService()
