import Anthropic from '@anthropic-ai/sdk'
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

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

if (!apiKey) {
  console.warn('VITE_ANTHROPIC_API_KEY not found in environment variables')
}

const anthropic = apiKey ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) : null

class ClaudeService implements AIService {
  async modifyChart(
    currentConfig: ChartConfiguration,
    userMessage: string,
    useWebSearch = false
  ): Promise<ChatResponse> {
    if (!anthropic) {
      return {
        success: false,
        message: 'Claude API key is not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
      }
    }

    try {
      const prompt = buildChartModificationPrompt(currentConfig, userMessage, useWebSearch)

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

      return parseAIResponse(text, useWebSearch)
    } catch (error) {
      console.error('Claude API error:', error)
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
      const prompt = buildSlideGenerationPrompt(data)

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

      return parseSlideGenerationResponse(text)
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
      return generateFallbackActionTitle(data.seriesNames, data.xAxisKey, data.description)
    }

    try {
      const prompt = buildActionTitlePrompt(insights, data)

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

      const parsed = parseActionTitleResponse(text)
      if (parsed) {
        return parsed
      }

      return generateFallbackActionTitle(data.seriesNames, data.xAxisKey, data.description)
    } catch (error) {
      console.error('Claude action title error:', error)
      return generateFallbackActionTitle(data.seriesNames, data.xAxisKey, data.description)
    }
  }

  async inferUnits(data: ChartData): Promise<string> {
    if (!anthropic) {
      return generateFallbackUnits(data.description, data.seriesNames)
    }

    try {
      const prompt = buildUnitsInferencePrompt(data)

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

      const units = parseUnitsResponse(text)
      if (units) {
        return units
      }

      return generateFallbackUnits(data.description, data.seriesNames)
    } catch (error) {
      console.error('Claude units inference error:', error)
      return generateFallbackUnits(data.description, data.seriesNames)
    }
  }
}

export const claudeService = new ClaudeService()
