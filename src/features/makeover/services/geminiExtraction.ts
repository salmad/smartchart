import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ExtractedChartData } from '../types'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  console.warn('VITE_GEMINI_API_KEY is not set. Chart extraction will not work.')
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '')

/**
 * Extract chart data from an image using Gemini Vision
 */
export async function extractChartFromImage(imageFile: File): Promise<ExtractedChartData> {
  // Convert File to base64
  const base64Image = await fileToBase64(imageFile)

  // Use Gemini Flash with vision
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are a chart data extraction expert. Analyze this chart image and extract:

1. Chart Type: bar, line, pie, or combined
2. Chart Title: (if visible)
3. X-Axis Label: (if visible)
4. Y-Axis Label: (if visible)
5. Data Points: Extract all values as structured JSON

Return ONLY valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "chartType": "bar",
  "title": "Quarterly Revenue 2024",
  "xAxisLabel": "Quarter",
  "yAxisLabel": "Revenue ($K)",
  "series": [
    {
      "name": "Product A",
      "data": [
        { "x": "Q1", "y": 240 },
        { "x": "Q2", "y": 300 }
      ]
    }
  ],
  "confidence": 0.95
}

Be precise with numbers. Extract ALL data points you can see.`

  const imagePart = {
    inlineData: {
      data: base64Image.split(',')[1], // Remove data:image/jpeg;base64, prefix
      mimeType: imageFile.type
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  const text = response.text()

  // Parse JSON response
  try {
    // Clean up response (remove markdown code blocks if present)
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const data = JSON.parse(cleanText) as ExtractedChartData

    // Validate required fields
    if (!data.chartType || !data.series || data.series.length === 0) {
      throw new Error('Invalid chart data structure')
    }

    return data
  } catch (error) {
    console.error('Failed to parse Gemini response:', text)
    throw new Error('Failed to extract chart data. Please try a clearer image.')
  }
}

/**
 * Convert File to base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
