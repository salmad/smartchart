import Anthropic from '@anthropic-ai/sdk'
import type { ChartConfiguration } from '@/shared/types/chart'
import type { AIService, ChatResponse, WebSource } from './types'

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
      const prompt = `You are a chart configuration expert. The user wants to modify their chart${
        useWebSearch ? ' and has enabled web search to find data online' : ''
      }.

Current Chart Configuration:
${JSON.stringify(currentConfig, null, 2)}

User Request: "${userMessage}"

Your task is to:
1. Analyze the user's request${useWebSearch ? '\n2. If needed, use web search to find relevant data' : ''}
${useWebSearch ? '3' : '2'}. Modify the chart configuration accordingly
${useWebSearch ? '4' : '3'}. Return ONLY a valid JSON object with ${useWebSearch ? 'three' : 'two'} keys:
   - "configuration": The updated ChartConfiguration object
   - "message": A friendly message explaining what you changed and ${useWebSearch ? 'what data you found ' : ''}(2-3 sentences)${
        useWebSearch ? '\n   - "sources": Array of web sources used (if any) with {title, url, description}' : ''
      }

Rules:
- Keep data structure consistent (same xAxisKey format)
- Only modify what the user asked for
- Maintain premium color palette: purple (#8B5CF6), emerald (#10B981), rose (#F43F5E), blue (#3B82F6), violet (#8B5CF6)
- Chart types: 'bar', 'line', or 'combined'
- Series types: 'bar' or 'line'
- If user asks to change data, modify dataPoints array
- If user asks about styling (colors, type, labels), modify styling object
- Preserve seriesNames consistency with dataPoints keys${
        useWebSearch
          ? '\n- When using web search, include the actual data you found in your message so the user knows what was used\n- Include all sources you used in the "sources" array'
          : ''
      }
- Return valid JSON only, no markdown or code blocks

Example response format:
{
  "configuration": { ...updated config... },
  "message": "I've changed your chart to a line chart and updated the colors to match your brand."${
    useWebSearch ? ',\n  "sources": [{title: "Example", url: "https://example.com", description: "Data source"}]' : ''
  }
}`

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
        messageParams.tools = [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          } as any,
        ]
      }

      const message = await anthropic.messages.create(messageParams)

      // Extract text content from response (may come after tool use)
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

        const response: ChatResponse = {
          success: true,
          configuration: parsed.configuration,
          message: parsed.message,
        }

        // Include sources if they were provided
        if (useWebSearch && parsed.sources && Array.isArray(parsed.sources)) {
          response.sources = parsed.sources as WebSource[]
        }

        return response
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
}

export const claudeService = new ClaudeService()