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
    console.log('=== ClaudeService.modifyChart called ===')
    console.log('useWebSearch parameter:', useWebSearch)
    console.log('userMessage:', userMessage)

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
1. Analyze the user's request${
        useWebSearch
          ? '\n2. IMPORTANT: Use the web_search tool to find the requested data online\n3. Extract the specific data values from the search results\n4. Update the chart configuration with the found data'
          : '\n2. Modify the chart configuration accordingly'
      }
${useWebSearch ? '5' : '3'}. Return ONLY a valid JSON object with TWO keys:
   - "configuration": The updated ChartConfiguration object with the ${useWebSearch ? 'data you found from web search' : 'modified data'}
   - "message": A friendly message that ${
     useWebSearch
       ? 'MUST include:\n     a) What data you searched for\n     b) The actual data values you found (list them out)\n     c) Brief mention of which sources you used\n     This should be 3-5 sentences explaining the data you found.'
       : 'explains what you changed (2-3 sentences)'
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
          ? '\n- CRITICAL: You MUST use web_search to find data, not make it up\n- CRITICAL: Your message MUST describe the actual data values you found\n- CRITICAL: Do NOT include a "sources" array in your JSON - sources will be extracted automatically from search results'
          : ''
      }
- Return valid JSON only, no markdown or code blocks

${
  useWebSearch
    ? `Example response with web search:
{
  "configuration": {
    "data": {
      "dataPoints": [
        { "year": "2020", "GDP": 21060 },
        { "year": "2021", "GDP": 23315 },
        { "year": "2022", "GDP": 25464 }
      ],
      "xAxisKey": "year",
      "seriesNames": ["GDP"]
    },
    "styling": { ...existing styling... }
  },
  "message": "I searched for US GDP data from 2020-2022 using the World Bank and Macrotrends. The data shows: 2020: $21.06T, 2021: $23.32T, and 2022: $25.46T. This represents steady growth over the three-year period. The data is measured in billions of USD at current prices."
}`
    : `Example response format:
{
  "configuration": { ...updated config... },
  "message": "I've changed your chart to a line chart and updated the colors to match your brand."
}`
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

      // Clean up response (remove markdown code blocks if present)
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      try {
        const parsed = JSON.parse(cleanedText)
        console.log('Parsed response:', parsed)

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

        // Include sources - prefer extracted sources from tool results over sources in JSON
        if (useWebSearch) {
          if (extractedSources.length > 0) {
            response.sources = extractedSources
            console.log('Using sources from tool results:', response.sources)
          } else if (parsed.sources && Array.isArray(parsed.sources) && parsed.sources.length > 0) {
            response.sources = parsed.sources as WebSource[]
            console.log('Using sources from JSON response:', response.sources)
          } else {
            console.warn('Web search was enabled but no sources were found')
          }
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