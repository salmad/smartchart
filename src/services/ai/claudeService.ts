import Anthropic from '@anthropic-ai/sdk'
import type { ChartConfiguration } from '@/shared/types/chart'
import type { AIService, ChatResponse, WebSource } from './types'
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
    console.log('=== ClaudeService.modifyChart called ===')
    console.log('Model: claude-haiku-4-5')
    console.log('useWebSearch parameter:', useWebSearch)
    console.log('userMessage:', userMessage)

    if (!anthropic) {
      return {
        success: false,
        message: 'Claude API key is not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
      }
    }

    try {
      const prompt = buildChartModificationPrompt(currentConfig, userMessage, useWebSearch)

      const messageParams: Anthropic.MessageCreateParams = {
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }

      // Add web search tool if enabled
      if (useWebSearch) {
        console.log('Adding web_search tool to API request')
        messageParams.tools = [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          } as any,
        ]
        console.log('Tools added:', messageParams.tools)
      } else {
        console.log('Web search NOT enabled - no tools added')
      }

      console.log('Calling Claude API with params:', {
        model: messageParams.model,
        hasTools: !!messageParams.tools,
        toolsCount: messageParams.tools?.length || 0,
      })

      const message = await anthropic.messages.create(messageParams)

      // Log the full response for debugging
      console.log('Claude API Response:', JSON.stringify(message, null, 2))
      console.log('Number of content blocks:', message.content.length)

      // When web search is used, Claude returns multiple content blocks:
      // 1. Initial text explaining what it will do
      // 2. server_tool_use block (the web search)
      // 3. web_search_tool_result block (the results)
      // 4. Final text block with the JSON response
      // We need to find the LAST text block, which contains the actual JSON

      const textBlocks = message.content.filter((block) => block.type === 'text')
      console.log('Found', textBlocks.length, 'text blocks')

      if (textBlocks.length === 0) {
        throw new Error('No text response from Claude')
      }

      // Get the LAST text block (which should contain the JSON after tool use)
      const lastTextBlock = textBlocks[textBlocks.length - 1]
      if (lastTextBlock.type !== 'text') {
        throw new Error('Last block is not text type')
      }

      const text = lastTextBlock.text
      console.log('Extracted text from last block:', text)

      // Extract sources from web_search_tool_result blocks
      const extractedSources: WebSource[] = []
      if (useWebSearch) {
        const toolResultBlocks = message.content.filter(
          (block: any) => block.type === 'web_search_tool_result'
        )
        console.log('Found', toolResultBlocks.length, 'web_search_tool_result blocks')

        for (const toolResult of toolResultBlocks) {
          const content = (toolResult as any).content
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === 'web_search_result') {
                extractedSources.push({
                  title: item.title || 'Unknown source',
                  url: item.url || '',
                  description: item.snippet || item.description || undefined,
                })
              }
            }
          }
        }
        console.log('Extracted sources from tool results:', extractedSources)
      }

      // Use shared parser
      return parseAIResponse(text, useWebSearch, extractedSources)
    } catch (error) {
      console.error('Claude API error:', error)
      // Return error with enough detail to trigger fallback
      return {
        success: false,
        message: 'Claude API request failed. Trying fallback provider...',
      }
    }
  }
}

export const claudeService = new ClaudeService()
