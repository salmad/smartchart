import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChartConfiguration } from '@/types/chart'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  console.warn('VITE_GEMINI_API_KEY not found in environment variables')
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

export interface ModifyChartResult {
  success: boolean
  configuration?: ChartConfiguration
  message: string
  error?: string
}

/**
 * Modify chart configuration using Gemini AI based on user's natural language request
 */
export async function modifyChart(
  currentConfig: ChartConfiguration,
  userMessage: string
): Promise<ModifyChartResult> {
  if (!genAI) {
    return {
      success: false,
      message: 'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.',
      error: 'API_KEY_MISSING',
    }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `You are a chart configuration expert. The user wants to modify their chart.

Current Chart Configuration:
${JSON.stringify(currentConfig, null, 2)}

User Request: "${userMessage}"

Your task is to:
1. Analyze the user's request
2. Modify the chart configuration accordingly
3. Return ONLY a valid JSON object with two keys:
   - "configuration": The updated ChartConfiguration object
   - "message": A friendly message explaining what you changed (1-2 sentences)

Rules:
- Keep data structure consistent (same xAxisKey format)
- Only modify what the user asked for
- Maintain premium color palette: purple (#8B5CF6), emerald (#10B981), rose (#F43F5E), blue (#3B82F6), violet (#8B5CF6)
- Chart types: 'bar', 'line', or 'combined'
- Series types: 'bar' or 'line'
- If user asks to change data, modify dataPoints array
- If user asks about styling (colors, type, labels), modify styling object
- Preserve seriesNames consistency with dataPoints keys
- Return valid JSON only, no markdown or code blocks

Example response format:
{
  "configuration": { ...updated config... },
  "message": "I've changed your chart to a line chart and updated the colors to match your brand."
}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

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

      return {
        success: true,
        configuration: parsed.configuration,
        message: parsed.message,
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanedText, parseError)
      return {
        success: false,
        message: 'I had trouble understanding how to modify your chart. Could you try rephrasing your request?',
        error: 'PARSE_ERROR',
      }
    }
  } catch (error) {
    console.error('Gemini API error:', error)
    return {
      success: false,
      message: 'Something went wrong while processing your request. Please try again.',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }
  }
}
