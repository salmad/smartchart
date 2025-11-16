import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChartConfiguration } from '@/shared/types/chart'
import type { AIService, ChatResponse, WebSource } from './types'
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
    console.log('=== GeminiService.modifyChart called ===')
    console.log('Model: gemini-2.5-flash')
    console.log('useWebSearch parameter:', useWebSearch)
    console.log('userMessage:', userMessage)

    if (!genAI) {
      return {
        success: false,
        message: 'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.',
      }
    }

    try {
      const prompt = buildChartModificationPrompt(currentConfig, userMessage, useWebSearch)

      // Configure model with Google Search grounding if web search is enabled
      const modelConfig: any = { model: 'gemini-2.5-flash' }

      if (useWebSearch) {
        console.log('Configuring Gemini with Google Search grounding')
        modelConfig.tools = [
          {
            googleSearchRetrieval: {}
          }
        ]
      }

      const model = genAI.getGenerativeModel(modelConfig)

      console.log('Calling Gemini API with config:', {
        model: modelConfig.model,
        hasTools: !!modelConfig.tools,
      })

      const result = await model.generateContent(prompt)
      const response = await result.response

      console.log('Gemini API Response received')

      // Extract grounding metadata for sources (if available)
      const extractedSources: WebSource[] = []
      if (useWebSearch && response.candidates && response.candidates[0]) {
        const candidate = response.candidates[0]
        const groundingMetadata = (candidate as any).groundingMetadata

        if (groundingMetadata && groundingMetadata.groundingChunks) {
          console.log('Found grounding chunks:', groundingMetadata.groundingChunks.length)

          for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.web) {
              extractedSources.push({
                title: chunk.web.title || 'Web Source',
                url: chunk.web.uri || '',
                description: chunk.web.uri || undefined,
              })
            }
          }
          console.log('Extracted sources from grounding metadata:', extractedSources)
        }
      }

      const text = response.text()
      console.log('Extracted text from Gemini response')

      // Use shared parser
      return parseAIResponse(text, useWebSearch, extractedSources)
    } catch (error) {
      console.error('Gemini API error:', error)
      return {
        success: false,
        message: 'Gemini API request failed. Trying fallback provider...',
      }
    }
  }
}

export const geminiService = new GeminiService()
