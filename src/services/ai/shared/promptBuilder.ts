import type { ChartConfiguration } from '@/shared/types/chart'

export function buildChartModificationPrompt(
  currentConfig: ChartConfiguration,
  userMessage: string,
  useWebSearch: boolean
): string {
  return `You are a chart configuration expert. The user wants to modify their chart${
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
${useWebSearch ? '5' : '3'}. Return ONLY a valid JSON object with ${useWebSearch ? 'THREE' : 'TWO'} keys:
   - "configuration": The updated ChartConfiguration object with the ${useWebSearch ? 'data you found from web search' : 'modified data'}
   - "message": A friendly message that ${
     useWebSearch
       ? 'MUST include:\n     a) What data you searched for\n     b) The actual data values you found (list them out)\n     c) Brief mention of which sources you used\n     This should be 3-5 sentences explaining the data you found.'
       : 'explains what you changed (2-3 sentences)'
   }${
    useWebSearch
      ? '\n   - "sources": REQUIRED array of ONLY the sources you actually used to extract data. Each source MUST have:\n     * "title": The page/article title\n     * "url": The full URL\n     * "description": A brief description of what specific data you got from this source (e.g., "GDP data for 2020-2023")'
      : ''
  }

Rules:
- Keep data structure consistent (same xAxisKey format)
- Only modify what the user asked for
- Maintain premium color palette: purple (#8B5CF6), emerald (#10B981), rose (#F43F5E), blue (#3B82F6), violet (#8B5CF6)
- Chart types: 'bar', 'line', or 'combined'
- Series types: 'bar' or 'line'
- If user asks to change data, modify dataPoints array
- If user asks about styling (colors, type, labels), modify styling object
- Preserve seriesNames consistency with dataPoints keys
- Y-Axis Assignment (seriesYAxis): Use 'right' Y-axis for series with different units that cannot be compared on the same scale
  * Examples requiring different Y-axes:
    - Absolute values (e.g., GDP, Revenue) vs Percentages (e.g., Growth Rate, Profit Margin)
    - Large magnitude differences (e.g., Population vs Growth Rate)
    - Different units (e.g., Temperature vs Humidity, Price vs Volume)
  * Default to 'left' for all series unless units are incompatible
  * When using right Y-axis, mention this in your message to explain why${
    useWebSearch
      ? '\n- CRITICAL: You MUST use web_search to find data, not make it up\n- CRITICAL: Your message MUST describe the actual data values you found\n- CRITICAL: The "sources" array is REQUIRED and must include ONLY the sources you actually used for data extraction (typically 1-3 sources)\n- CRITICAL: Your response must START with { and END with } - NO explanatory text before or after the JSON'
      : ''
  }
- Return valid JSON only, no markdown or code blocks
- Your response must START with the opening brace { of the JSON object

${
  useWebSearch
    ? `Example response with web search (dual Y-axes for different units):
{
  "configuration": {
    "data": {
      "dataPoints": [
        { "year": "2020", "GDP": 21060, "Growth Rate": 2.3 },
        { "year": "2021", "GDP": 23315, "Growth Rate": 5.8 },
        { "year": "2022", "GDP": 25464, "Growth Rate": 2.1 }
      ],
      "xAxisKey": "year",
      "seriesNames": ["GDP", "Growth Rate"]
    },
    "styling": {
      ...existing styling...,
      "seriesYAxis": {
        "GDP": "left",
        "Growth Rate": "right"
      }
    }
  },
  "message": "I searched for US GDP data and growth rates from 2020-2022. The GDP data shows: 2020: $21.06T, 2021: $23.32T, and 2022: $25.46T. The growth rates are: 2020: 2.3%, 2021: 5.8%, and 2022: 2.1%. I've used dual Y-axes since GDP is in trillions of dollars (left axis) while growth rate is in percentages (right axis) - these different units cannot be meaningfully compared on the same scale.",
  "sources": [
    {
      "title": "U.S. GDP | U.S. Bureau of Economic Analysis (BEA)",
      "url": "https://www.bea.gov/data/gdp/gross-domestic-product",
      "description": "Official GDP data and growth rates for 2020-2022 from the U.S. Bureau of Economic Analysis"
    }
  ]
}`
    : `Example response format:
{
  "configuration": { ...updated config... },
  "message": "I've changed your chart to a line chart and updated the colors to match your brand."
}

Example with dual Y-axes (when series have different units):
{
  "configuration": {
    "data": {
      "dataPoints": [
        { "quarter": "Q1", "Revenue": 1200, "Profit Margin": 15.5 },
        { "quarter": "Q2", "Revenue": 1500, "Profit Margin": 18.2 }
      ],
      "xAxisKey": "quarter",
      "seriesNames": ["Revenue", "Profit Margin"]
    },
    "styling": {
      ...existing styling...,
      "seriesYAxis": {
        "Revenue": "left",
        "Profit Margin": "right"
      }
    }
  },
  "message": "I've set up dual Y-axes for your chart. Revenue (in dollars) uses the left axis, while Profit Margin (in percentages) uses the right axis. This allows both metrics to be clearly visualized despite their different units."
}`
}`
}
