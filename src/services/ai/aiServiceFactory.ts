import type { ChartConfiguration } from '@/shared/types/chart'
import type { AIService, ChatResponse } from './types'
import { claudeService } from './claudeService'
import { geminiService } from './geminiService'

/**
 * AI Service with automatic fallback from Claude to Gemini
 */
class AIServiceWithFallback implements AIService {
  private primaryService: AIService = claudeService
  private fallbackService: AIService = geminiService

  async modifyChart(
    currentConfig: ChartConfiguration,
    userMessage: string
  ): Promise<ChatResponse> {
    // Try primary service (Claude) first
    const primaryResponse = await this.primaryService.modifyChart(currentConfig, userMessage)

    // If Claude succeeds, return the response
    if (primaryResponse.success) {
      return primaryResponse
    }

    // If Claude fails due to configuration (no API key), don't try fallback
    if (primaryResponse.message.includes('not configured')) {
      console.log('Primary AI service (Claude) not configured, trying fallback (Gemini)...')
    } else {
      console.log('Primary AI service (Claude) failed, trying fallback (Gemini)...')
    }

    // Try fallback service (Gemini)
    const fallbackResponse = await this.fallbackService.modifyChart(currentConfig, userMessage)

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
