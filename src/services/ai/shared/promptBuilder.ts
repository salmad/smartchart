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
- Preserve seriesNames consistency with dataPoints keys${
    useWebSearch
      ? '\n- CRITICAL: You MUST use web_search to find data, not make it up\n- CRITICAL: Your message MUST describe the actual data values you found\n- CRITICAL: The "sources" array is REQUIRED and must include ONLY the sources you actually used for data extraction (typically 1-3 sources)\n- CRITICAL: Your response must START with { and END with } - NO explanatory text before or after the JSON'
      : ''
  }
- Return valid JSON only, no markdown or code blocks
- Your response must START with the opening brace { of the JSON object

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
  "message": "I searched for US GDP data from 2020-2022 using the World Bank and Macrotrends. The data shows: 2020: $21.06T, 2021: $23.32T, and 2022: $25.46T. This represents steady growth over the three-year period. The data is measured in billions of USD at current prices.",
  "sources": [
    {
      "title": "U.S. GDP | U.S. Bureau of Economic Analysis (BEA)",
      "url": "https://www.bea.gov/data/gdp/gross-domestic-product",
      "description": "Official GDP data for 2020-2022 from the U.S. Bureau of Economic Analysis"
    },
    {
      "title": "United States GDP - Macrotrends",
      "url": "https://www.macrotrends.net/countries/USA/united-states/gdp-gross-domestic-product",
      "description": "Historical GDP data and growth rates for verification"
    }
  ]
}`
    : `Example response format:
{
  "configuration": { ...updated config... },
  "message": "I've changed your chart to a line chart and updated the colors to match your brand."
}`
}`
}
