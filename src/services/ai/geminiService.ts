import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChartConfiguration, ChartData } from '@/shared/types/chart'
import type { AIService, ChatResponse, SlideGenerationResponse, SlideInsight } from './types'
import {
  buildSlideGenerationPrompt,
  buildActionTitlePrompt,
  buildUnitsInferencePrompt,
} from './shared/slidePrompts'
import {
  parseSlideGenerationResponse,
  parseActionTitleResponse,
  parseUnitsResponse,
  generateFallbackActionTitle,
  generateFallbackUnits,
} from './shared/slideResponseParser'
import { buildChartModificationPrompt } from './shared/promptBuilder'
import { parseAIResponse } from './shared/responseParser'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  console.warn('VITE_GEMINI_API_KEY not found in environment variables')
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

class GeminiService implements AIService {
  async modifyChart(
    currentConfig: ChartConfiguration,
    userMessage: string,
    useWebSearch = false
  ): Promise<ChatResponse> {
    if (!genAI) {
      return {
        success: false,
        message: 'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.',
      }
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = buildChartModificationPrompt(currentConfig, userMessage, useWebSearch)

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      return parseAIResponse(text, useWebSearch)
    } catch (error) {
      console.error('Gemini API error:', error)
      return {
        success: false,
        message: 'Something went wrong while processing your request. Please try again.',
      }
    }
  }

  async generateSlideInsights(data: ChartData): Promise<SlideGenerationResponse> {
    if (!genAI) {
      return {
        success: false,
        error: 'Gemini API key is not configured',
      }
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const prompt = buildSlideGenerationPrompt(data)

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      return parseSlideGenerationResponse(text)
    } catch (error) {
      console.error('Gemini slide generation error:', error)
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
    if (!genAI) {
      return generateFallbackActionTitle(data.seriesNames, data.xAxisKey, data.description)
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const prompt = buildActionTitlePrompt(insights, data)

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      const parsed = parseActionTitleResponse(text)
      if (parsed) {
        return parsed
      }

      // Fallback if parsing failed
      return generateFallbackActionTitle(data.seriesNames, data.xAxisKey, data.description)
    } catch (error) {
      console.error('Gemini action title error:', error)
      return generateFallbackActionTitle(data.seriesNames, data.xAxisKey, data.description)
    }
  }

  async inferUnits(data: ChartData): Promise<string> {
    if (!genAI) {
      return generateFallbackUnits(data.description, data.seriesNames)
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const prompt = buildUnitsInferencePrompt(data)

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      const units = parseUnitsResponse(text)
      if (units) {
        return units
      }

      // Fallback if parsing failed
      return generateFallbackUnits(data.description, data.seriesNames)
    } catch (error) {
      console.error('Gemini units inference error:', error)
      return generateFallbackUnits(data.description, data.seriesNames)
    }
  }
}

export const geminiService = new GeminiService()
