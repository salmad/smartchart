import type { ChatResponse, WebSource } from '../types'

export function parseAIResponse(
  rawText: string,
  useWebSearch: boolean,
  extractedSources: WebSource[] = []
): ChatResponse {
  let text = rawText

  // Extract JSON from text - AI often adds explanation before the JSON
  // Find the first { and extract from there to the end
  const jsonStart = text.indexOf('{')
  if (jsonStart !== -1) {
    text = text.substring(jsonStart)
    console.log('Extracted JSON starting from first {:', text.substring(0, 100) + '...')
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

    // Include sources - prefer sources from JSON response (AI's selection) over auto-extracted sources
    if (useWebSearch) {
      if (parsed.sources && Array.isArray(parsed.sources) && parsed.sources.length > 0) {
        response.sources = parsed.sources as WebSource[]
        console.log('Using sources from JSON response (AI selected):', response.sources)
      } else if (extractedSources.length > 0) {
        // Fallback to auto-extracted sources if AI didn't provide any
        console.warn('AI did not provide sources in JSON, falling back to auto-extracted sources')
        response.sources = extractedSources.slice(0, 3) // Limit to top 3
        console.log('Using fallback sources from tool results:', response.sources)
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
}
