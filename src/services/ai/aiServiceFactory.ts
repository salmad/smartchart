import type { ChartConfiguration } from '@/shared/types/chart'
import type { AIService, ChatResponse } from './types'
import { claudeService } from './claudeService'
import { geminiService } from './geminiService'

/**
 * AI Service with automatic fallback from Gemini Flash to Claude Haiku
 */
class AIServiceWithFallback implements AIService {
  private primaryService: AIService = geminiService
  private fallbackService: AIService = claudeService

  async modifyChart(
    currentConfig: ChartConfiguration,
    userMessage: string,
    useWebSearch = false
  ): Promise<ChatResponse> {
    console.log('AIServiceWithFallback.modifyChart called with useWebSearch:', useWebSearch)

    // Try primary service (Gemini Flash) first
    const primaryResponse = await this.primaryService.modifyChart(currentConfig, userMessage, useWebSearch)

    // If Gemini succeeds, return the response
    if (primaryResponse.success) {
      return primaryResponse
    }

    // If Gemini fails due to configuration (no API key), try fallback
    if (primaryResponse.message.includes('not configured')) {
      console.log('Primary AI service (Gemini Flash) not configured, trying fallback (Claude Haiku)...')
    } else {
      console.log('Primary AI service (Gemini Flash) failed, trying fallback (Claude Haiku)...')
    }

    // Try fallback service (Claude Haiku)
    const fallbackResponse = await this.fallbackService.modifyChart(currentConfig, userMessage, useWebSearch)

    // If fallback succeeds, return with a note about using fallback
    if (fallbackResponse.success) {
      return {
        ...fallbackResponse,
        message: fallbackResponse.message,
      }
    }

    // Both services failed
    return {
      success: false,
      message:
        'Both AI services are unavailable. Please check your API keys in the .env file and try again.',
    }
  }
}

export const aiService = new AIServiceWithFallback()
